import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { classifyConnectionQuality, computeSkipVotesNeeded } from '../utils/roomLogic';

// TURN fallback uses Open Relay Project's public demo credentials (free, shared,
// ~20GB/month across all users of this well-known credential). It's a real
// fallback for guests behind restrictive/symmetric NATs where STUN alone fails,
// but it's not private capacity — self-host coturn if you need guaranteed uptime.
const PEER_OPTIONS = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:openrelay.metered.ca:80' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};

const HOST_TAKEOVER_MAX_RETRIES = 6;
const HOST_TAKEOVER_RETRY_MS = 1000;
const GUEST_RECONNECT_MAX_ATTEMPTS = 8;
const GUEST_RECONNECT_MAX_DELAY_MS = 4000;
const QUALITY_POLL_MS = 4000;

export default function usePeerConnection({ roomCode, nickname, isHost, password, isTakeover }) {
  const peerRef = useRef(null);
  const connectionsRef = useRef({});
  const callsRef = useRef({});
  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const volumeRef = useRef(1);
  const kickedNicknamesRef = useRef(new Set());
  const skipVotersRef = useRef(new Set());

  const [myPeerId, setMyPeerId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playbackState, setPlaybackState] = useState({ isPlaying: false, position: 0, timestamp: Date.now() });
  const [playlist, setPlaylist] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [skipVotes, setSkipVotes] = useState({ count: 0, needed: 0 });
  const [error, setError] = useState(null);

  // Mirrors of state readable from inside the connection effect's closures,
  // which only re-run when [roomCode, nickname, isHost, password, isTakeover]
  // change. Without these, handleMessage would keep reading whatever
  // currentSong/playbackState/playlist/users were at mount time forever.
  const currentSongRef = useRef(null);
  const playbackStateRef = useRef(playbackState);
  const playlistRef = useRef([]);
  const usersRef = useRef([]);

  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { playbackStateRef.current = playbackState; }, [playbackState]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { usersRef.current = users; }, [users]);

  const hostPeerId = `syncroom-${roomCode}`;

  function broadcast(type, data) {
    const msg = JSON.stringify({ type, data, time: Date.now() });
    Object.values(connectionsRef.current).forEach(c => {
      try { c.send(msg); } catch { }
    });
  }

  function sendTo(peerId, type, data) {
    const conn = connectionsRef.current[peerId];
    if (conn) {
      try { conn.send(JSON.stringify({ type, data, time: Date.now() })); } catch { }
    }
  }

  useEffect(() => {
    if (!roomCode) return;

    let destroyed = false;
    let terminalError = false;
    const reconnectAttempts = { current: 0 };

    function handleMessage(raw, conn) {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { type, data } = msg;

      switch (type) {
        case 'join': {
          if (!isHost) return;
          if (kickedNicknamesRef.current.has((data.nickname || '').toLowerCase())) {
            try { conn.send(JSON.stringify({ type: 'kicked', data: {}, time: Date.now() })); } catch { }
            setTimeout(() => { try { conn.close(); } catch { } }, 250);
            return;
          }
          if (data.password !== password) {
            try { conn.send(JSON.stringify({ type: 'auth-failed', data: {}, time: Date.now() })); } catch { }
            setTimeout(() => { try { conn.close(); } catch { } }, 250);
            return;
          }
          const newUser = { id: data.id, nickname: data.nickname, isHost: false, connected: true };
          setUsers(prev => {
            const updated = [...prev, newUser];
            broadcast('users', updated);
            broadcast('chat', { text: `${data.nickname} joined the room`, system: true });
            return updated;
          });
          connectionsRef.current[data.id] = conn;
          sendTo(data.id, 'yourInfo', { id: data.id });
          if (audioStreamRef.current) {
            callPeer(data.id);
          }
          if (currentSongRef.current) {
            sendTo(data.id, 'song', currentSongRef.current);
          }
          sendTo(data.id, 'playback', playbackStateRef.current);
          sendTo(data.id, 'skipVotes', skipVotes);
          break;
        }
        case 'auth-failed': {
          terminalError = true;
          setError('authFailed');
          break;
        }
        case 'chat': {
          if (isHost) {
            broadcast('chat', { ...data, from: data.from || data.nickname });
          } else {
            setMessages(prev => [...prev, {
              id: Date.now().toString(36),
              text: data.text,
              nickname: data.from || data.nickname,
              time: data.time || Date.now(),
              system: data.system,
            }]);
          }
          break;
        }
        case 'reaction': {
          if (isHost) {
            broadcast('reaction', data);
          } else {
            setReactions(prev => [...prev, { ...data, id: Date.now() }]);
          }
          break;
        }
        case 'song':
          setCurrentSong(data);
          break;
        case 'playback':
          setPlaybackState(data);
          break;
        case 'users':
          if (!isHost) setUsers(data);
          break;
        case 'yourInfo':
          setMyPeerId(data.id);
          break;
        case 'kicked':
          terminalError = true;
          setError('kicked');
          break;
        case 'sessionEnded':
          terminalError = true;
          setError('ended');
          break;
        case 'playlist':
          setPlaylist(data);
          break;
        case 'skipVotes':
          setSkipVotes(data);
          break;
        case 'voteSkip': {
          if (!isHost) return;
          const voterId = Object.entries(connectionsRef.current).find(([, c]) => c === conn)?.[0];
          if (!voterId || skipVotersRef.current.has(voterId)) break;
          skipVotersRef.current.add(voterId);

          const needed = computeSkipVotesNeeded(usersRef.current.length);
          const count = skipVotersRef.current.size;

          if (count >= needed) {
            const list = playlistRef.current;
            const next = list.find(s => s.id !== currentSongRef.current?.id);
            skipVotersRef.current = new Set();
            if (next) {
              updatePlaylist(list.filter(s => s.id !== next.id));
              updateSong(next);
            } else {
              broadcast('skipVotes', { count: 0, needed });
              setSkipVotes({ count: 0, needed });
            }
          } else {
            broadcast('skipVotes', { count, needed });
            setSkipVotes({ count, needed });
          }
          break;
        }
        case 'handoff': {
          setUsers(prev => prev.map(u => ({
            ...u,
            isHost: u.id === data.newHostId,
          })));
          if (peerRef.current && data.newHostId === peerRef.current.id) {
            terminalError = true;
            setError('becameHost');
          }
          break;
        }
      }
    }

    function callPeer(peerId) {
      if (!audioStreamRef.current) return;
      try {
        const call = peerRef.current?.call(peerId, audioStreamRef.current);
        if (call) callsRef.current[peerId] = call;
      } catch { }
    }

    async function pollConnectionQuality() {
      const calls = Object.values(callsRef.current);
      if (calls.length === 0) return;
      let worstRtt = 0;
      let sawAny = false;
      for (const call of calls) {
        const pc = call?.peerConnection;
        if (!pc || typeof pc.getStats !== 'function') continue;
        try {
          const stats = await pc.getStats();
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') {
              sawAny = true;
              worstRtt = Math.max(worstRtt, report.currentRoundTripTime);
            }
          });
        } catch { }
      }
      if (!sawAny || destroyed) return;
      setConnectionQuality(classifyConnectionQuality(worstRtt));
    }

    function connectToHost(peer) {
      if (destroyed) return;
      const conn = peer.connect(hostPeerId, { reliable: true });
      conn.on('open', () => {
        reconnectAttempts.current = 0;
        connectionsRef.current[hostPeerId] = conn;
        sendTo(hostPeerId, 'join', { id: peer.id, nickname, password });
      });
      conn.on('data', (raw) => handleMessage(raw, conn));
      conn.on('close', () => {
        delete connectionsRef.current[hostPeerId];
        if (destroyed || terminalError) return;
        if (reconnectAttempts.current >= GUEST_RECONNECT_MAX_ATTEMPTS) {
          terminalError = true;
          setError('hostLost');
          return;
        }
        reconnectAttempts.current += 1;
        const delay = Math.min(reconnectAttempts.current * 1000, GUEST_RECONNECT_MAX_DELAY_MS);
        setTimeout(() => connectToHost(peer), delay);
      });
      conn.on('error', () => { try { conn.close(); } catch { } });
    }

    function wirePeer(peer, attempt) {
      peer.on('open', (id) => {
        setMyPeerId(id);
        if (isHost && !isTakeover) {
          setUsers([{ id, nickname, isHost: true, connected: true }]);
        }
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          if (isHost && isTakeover && attempt < HOST_TAKEOVER_MAX_RETRIES && !destroyed) {
            try { peer.destroy(); } catch { }
            setTimeout(() => { if (!destroyed) createPeer(attempt + 1); }, HOST_TAKEOVER_RETRY_MS);
            return;
          }
          setError('Room code already in use. Try a different code.');
          return;
        }
        setError(err.message);
      });

      if (!isHost) {
        peer.on('open', () => connectToHost(peer));

        peer.on('call', (call) => {
          call.answer();
          callsRef.current['host'] = call;
          call.on('close', () => { delete callsRef.current['host']; });

          call.on('stream', (stream) => {
            const ctx = new AudioContext();
            audioCtxRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            const gain = ctx.createGain();
            gain.gain.value = volumeRef.current;
            gainRef.current = gain;
            src.connect(gain);
            gain.connect(ctx.destination);

            // Modern Chrome supports a receiver-side jitter buffer hint. This
            // is a partial mitigation only — it smooths out small jitter, it
            // does not synchronize audio arrival across guests on different
            // networks. Full cross-guest sync would need measured per-peer
            // latency compensation, which isn't safely implementable without
            // real multi-network testing.
            try {
              call.peerConnection?.getReceivers().forEach(r => {
                if (r.track?.kind === 'audio' && 'playoutDelayHint' in r) {
                  r.playoutDelayHint = 0.2;
                }
              });
            } catch { }
          });
        });
      }

      if (isHost) {
        peer.on('connection', (conn) => {
          conn.on('data', (raw) => handleMessage(raw, conn));
          conn.on('close', () => {
            const leaver = Object.entries(connectionsRef.current).find(([, c]) => c === conn)?.[0];
            if (leaver) {
              delete connectionsRef.current[leaver];
              delete callsRef.current[leaver];
              setUsers(prev => {
                const updated = prev.filter(u => u.id !== leaver);
                broadcast('users', updated);
                return updated;
              });
            }
          });
        });
      }
    }

    function createPeer(attempt) {
      const peerId = isHost ? hostPeerId : undefined;
      const peer = new Peer(peerId, PEER_OPTIONS);
      peerRef.current = peer;
      connectionsRef.current = {};
      callsRef.current = {};
      wirePeer(peer, attempt);
    }

    createPeer(0);
    const qualityInterval = setInterval(pollConnectionQuality, QUALITY_POLL_MS);

    return () => {
      destroyed = true;
      clearInterval(qualityInterval);
      peerRef.current?.destroy();
      audioCtxRef.current?.close();
    };
  }, [roomCode, nickname, isHost, password, isTakeover]);

  function setAudioStream(stream) {
    audioStreamRef.current = stream;
    if (isHost) {
      Object.keys(connectionsRef.current).forEach(pid => {
        try {
          const call = peerRef.current?.call(pid, stream);
          if (call) callsRef.current[pid] = call;
        } catch { }
      });
    }
  }

  function setVolume(v) {
    volumeRef.current = v;
    if (gainRef.current) gainRef.current.gain.value = v;
  }

  function sendChat(text) {
    if (isHost) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(36),
        text,
        nickname,
        time: Date.now(),
      }]);
      broadcast('chat', { text, from: nickname, time: Date.now() });
    } else {
      sendTo(hostPeerId, 'chat', { text, nickname, time: Date.now() });
    }
  }

  function sendReaction(emoji) {
    if (isHost) {
      setReactions(prev => [...prev, { emoji, nickname, id: Date.now() }]);
      broadcast('reaction', { emoji, nickname, time: Date.now() });
    } else {
      sendTo(hostPeerId, 'reaction', { emoji, nickname, time: Date.now() });
    }
  }

  function sendSkipVote() {
    if (isHost) return;
    sendTo(hostPeerId, 'voteSkip', {});
  }

  function kickUser(targetId) {
    if (!isHost) return;
    const target = users.find(u => u.id === targetId);
    if (target?.nickname) kickedNicknamesRef.current.add(target.nickname.toLowerCase());
    sendTo(targetId, 'kicked', {});
    const conn = connectionsRef.current[targetId];
    if (conn) conn.close();
    delete connectionsRef.current[targetId];
    delete callsRef.current[targetId];
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== targetId);
      broadcast('users', updated);
      return updated;
    });
  }

  function endSession() {
    if (!isHost) return;
    broadcast('sessionEnded', {});
    Object.values(connectionsRef.current).forEach(c => {
      try { c.close(); } catch { }
    });
    connectionsRef.current = {};
    callsRef.current = {};
    setUsers([]);
  }

  function transferHost(newHostId) {
    if (!isHost) return;
    broadcast('handoff', { newHostId });
    setUsers(prev => prev.map(u => ({
      ...u,
      isHost: u.id === newHostId,
    })));
  }

  function updateSong(song) {
    if (!isHost) return;
    const base = { isPlaying: true, position: 0, timestamp: Date.now() };
    setCurrentSong(song);
    setPlaybackState(base);
    broadcast('song', song);
    broadcast('playback', base);

    skipVotersRef.current = new Set();
    const needed = computeSkipVotesNeeded(usersRef.current.length);
    setSkipVotes({ count: 0, needed });
    broadcast('skipVotes', { count: 0, needed });
  }

  function updatePlaylist(newPlaylist) {
    if (!isHost) return;
    setPlaylist(newPlaylist);
    broadcast('playlist', newPlaylist);
  }

  return {
    myPeerId, users, messages, setMessages,
    reactions, currentSong, playbackState,
    playlist, connectionQuality, skipVotes, error, setError,
    setAudioStream, setVolume, sendChat, sendReaction, sendSkipVote,
    kickUser, endSession, transferHost,
    updateSong, updatePlaylist,
  };
}
