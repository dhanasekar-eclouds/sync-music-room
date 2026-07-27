import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';

const PEER_OPTIONS = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
};

export default function usePeerConnection({ roomCode, nickname, isHost }) {
  const peerRef = useRef(null);
  const connectionsRef = useRef({});
  const audioStreamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const [myPeerId, setMyPeerId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playbackState, setPlaybackState] = useState({ isPlaying: false, position: 0 });
  const [playlist, setPlaylist] = useState([]);
  const [connectionQuality, setConnectionQuality] = useState('good');
  const [error, setError] = useState(null);

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

  function broadcastMe(type, data) {
    broadcast(type, data);
  }

  useEffect(() => {
    if (!roomCode) return;

    const peerId = isHost ? hostPeerId : undefined;
    const peer = new Peer(peerId, PEER_OPTIONS);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      if (isHost) {
        setUsers([{ id, nickname, isHost: true, connected: true }]);
      }
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setError('Room code already in use. Try a different code.');
      } else {
        setError(err.message);
      }
    });

    if (!isHost) {
      peer.on('open', () => {
        const conn = peer.connect(hostPeerId, { reliable: true });
        conn.on('open', () => {
          connectionsRef.current[hostPeerId] = conn;
          sendTo(hostPeerId, 'join', { id: peer.id, nickname });
        });
        conn.on('data', (raw) => handleMessage(raw, conn));
        conn.on('close', () => {
          delete connectionsRef.current[hostPeerId];
        });
      });

      peer.on('call', (call) => {
        call.answer();
        call.on('stream', (stream) => {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const gain = ctx.createGain();
          gain.gain.value = 1;
          src.connect(gain);
          gain.connect(ctx.destination);
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
            setUsers(prev => {
              const updated = prev.filter(u => u.id !== leaver);
              broadcast('users', updated);
              return updated;
            });
          }
        });
      });
    }

    function handleMessage(raw, conn) {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { type, data } = msg;

      switch (type) {
        case 'join': {
          if (!isHost) return;
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
          if (currentSong) {
            sendTo(data.id, 'song', currentSong);
          }
          sendTo(data.id, 'playback', playbackState);
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
        case 'sync': {
          setPlaybackState(prev => ({ ...prev, position: data.position, isPlaying: data.isPlaying }));
          if (data.song) setCurrentSong(data.song);
          break;
        }
        case 'users':
          if (!isHost) setUsers(data);
          break;
        case 'yourInfo':
          setMyPeerId(data.id);
          break;
        case 'kicked':
          setError('kicked');
          break;
        case 'sessionEnded':
          setError('ended');
          break;
        case 'playlist':
          setPlaylist(data);
          break;
        case 'handoff':
          setUsers(prev => prev.map(u => ({
            ...u,
            isHost: u.id === data.newHostId,
          })));
          setError('becameHost');
          break;
      }
    }

    function callPeer(peerId) {
      if (!audioStreamRef.current) return;
      try {
        peer.call(peerId, audioStreamRef.current);
      } catch { }
    }

    return () => {
      peer.destroy();
      audioCtxRef.current?.close();
    };
  }, [roomCode, nickname, isHost]);

  function setAudioStream(stream) {
    audioStreamRef.current = stream;
    if (isHost) {
      Object.keys(connectionsRef.current).forEach(pid => {
        try {
          peerRef.current?.call(pid, stream);
        } catch { }
      });
    }
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

  function kickUser(targetId) {
    if (!isHost) return;
    sendTo(targetId, 'kicked', {});
    const conn = connectionsRef.current[targetId];
    if (conn) conn.close();
    delete connectionsRef.current[targetId];
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
    setUsers([]);
  }

  function transferHost(newHostId) {
    if (!isHost) return;
    broadcast('handoff', { newHostId });
    setUsers(prev => prev.map(u => ({
      ...u,
      isHost: u.id === newHostId,
    })));
    setMyPeerId(newHostId);
  }

  function updateSync(position, isPlaying) {
    if (!isHost) return;
    setPlaybackState({ position, isPlaying });
    broadcast('sync', { position, isPlaying, song: currentSong });
  }

  function updateSong(song) {
    if (!isHost) return;
    setCurrentSong(song);
    broadcast('song', song);
    broadcast('playback', { isPlaying: true, position: 0 });
  }

  function updatePlaylist(newPlaylist) {
    if (!isHost) return;
    setPlaylist(newPlaylist);
    broadcast('playlist', newPlaylist);
  }

  return {
    myPeerId, users, messages, setMessages,
    reactions, currentSong, playbackState,
    playlist, connectionQuality, error, setError,
    setAudioStream, sendChat, sendReaction,
    kickUser, endSession, transferHost,
    updateSync, updateSong, updatePlaylist,
  };
}
