import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import usePeerConnection from '../hooks/usePeerConnection';
import useLocalRelay from '../hooks/useLocalRelay';
import { useDarkMode } from '../context/DarkModeContext';
import DarkModeToggle from '../components/DarkModeToggle';
import SourcePicker from '../components/SourcePicker';
import NowPlaying from '../components/NowPlaying';
import VolumeSlider from '../components/VolumeSlider';
import Chat from '../components/Chat';
import EmojiReactions from '../components/EmojiReactions';
import UserList from '../components/UserList';
import HostControls from '../components/HostControls';
import LeaveGuardModal from '../components/LeaveGuardModal';
import HostHandoffModal from '../components/HostHandoffModal';
import PlaylistQueue from '../components/PlaylistQueue';
import SessionEndedOverlay from '../components/SessionEndedOverlay';
import SourceClosedPopup from '../components/SourceClosedPopup';
import ConnectionBadge from '../components/ConnectionBadge';
import { computeDisplayPosition } from '../utils/roomLogic';

const SESSION_KEY = 'sync-music-room-session';

export default function RoomPage() {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const getInitial = (key, fallback) => {
    if (state[key]) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        nickname: state.nickname || '',
        password: state.password || '',
        isHost: state.isHost || false,
        roomCode,
      }));
      return state[key];
    }
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.roomCode === roomCode) return parsed[key];
      }
    } catch {}
    return fallback;
  };

  const [nickname] = useState(getInitial('nickname', ''));
  const [password] = useState(getInitial('password', ''));
  const [isHost, setIsHost] = useState(getInitial('isHost', false));
  const wasOriginalHostRef = useRef(isHost);
  const [volume, setVolume] = useState(1);
  const [showLeaveGuard, setShowLeaveGuard] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sourceMode, setSourceMode] = useState(null);
  const [displayPosition, setDisplayPosition] = useState(0);
  const [showInactivityNudge, setShowInactivityNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const aloneSinceRef = useRef(Date.now());

  const relay = useLocalRelay();

  const {
    myPeerId, users, messages, setMessages,
    reactions, currentSong, playbackState,
    playlist, connectionQuality, skipVotes, error, setError,
    setAudioStream, setVolume: setGainVolume, sendChat, sendReaction, sendSkipVote,
    kickUser, endSession, transferHost,
    updateSong, updatePlaylist,
  } = usePeerConnection({
    roomCode, nickname, isHost, password,
    isTakeover: isHost && !wasOriginalHostRef.current,
  });

  useEffect(() => {
    if (!nickname) navigate('/');
  }, [nickname, navigate]);

  useEffect(() => {
    if (relay.stream && sourceMode === 'relay') {
      setAudioStream(relay.stream);
      updateSong({ title: relay.captureName || 'PC Audio', artist: 'Live Capture', duration: 0, art: '' });
    }
  }, [relay.stream, sourceMode, relay.captureName]);

  useEffect(() => {
    if (!relay.capturing && sourceMode === 'relay') {
      setAudioStream(null);
    }
  }, [relay.capturing, sourceMode]);

  useEffect(() => {
    if (error === 'kicked' || error === 'ended') {
      relay.disconnect();
      setSessionEnded(true);
    } else if (error === 'authFailed') {
      relay.disconnect();
      sessionStorage.removeItem(SESSION_KEY);
      navigate('/', { state: { homeError: 'Incorrect room password.' } });
    } else if (error === 'hostLost') {
      relay.disconnect();
      sessionStorage.removeItem(SESSION_KEY);
      navigate('/', { state: { homeError: "Lost connection to the host. The room may have ended." } });
    } else if (error === 'becameHost') {
      setIsHost(true);
      try {
        const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...saved, isHost: true, roomCode }));
      } catch { }
      setShowHandoff(true);
      setError(null);
    }
  }, [error]);

  // Derive a smooth, drift-free display position locally instead of trusting
  // a networked per-second tick: position/timestamp mark a fixed reference
  // point, and elapsed wall-clock time is added on the client.
  useEffect(() => {
    if (!playbackState.isPlaying) {
      setDisplayPosition(playbackState.position);
      return;
    }
    const tick = () => setDisplayPosition(computeDisplayPosition(playbackState));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [playbackState.isPlaying, playbackState.position, playbackState.timestamp]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isHost) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isHost]);

  // Nudge the host if the room has sat empty (host-only) for a while — an
  // open room keeps a WebRTC/relay pipeline running for no one, so it's
  // worth surfacing rather than silently burning the host's bandwidth/CPU.
  const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000;
  useEffect(() => {
    if (!isHost) return;
    const guestCount = users.filter(u => u.id !== myPeerId).length;
    if (guestCount > 0) {
      aloneSinceRef.current = Date.now();
      setShowInactivityNudge(false);
      setNudgeDismissed(false);
      return;
    }
    const id = setInterval(() => {
      if (!nudgeDismissed && Date.now() - aloneSinceRef.current >= INACTIVITY_THRESHOLD_MS) {
        setShowInactivityNudge(true);
      }
    }, 30000);
    return () => clearInterval(id);
  }, [isHost, users, myPeerId, nudgeDismissed]);

  function handleLeave() {
    if (isHost && users.filter(u => u.id !== myPeerId).length > 0) {
      setShowLeaveGuard(true);
    } else {
      if (isHost) endSession();
      relay.disconnect();
      sessionStorage.removeItem(SESSION_KEY);
      navigate('/');
    }
  }

  function handleEndSession() {
    relay.disconnect();
    endSession();
    setSessionEnded(true);
  }

  function handleKick(targetId) { kickUser(targetId); }

  function handleTransferHost(newHostId) {
    transferHost(newHostId);
    relay.disconnect();
    setShowLeaveGuard(false);
    sessionStorage.removeItem(SESSION_KEY);
    navigate('/');
  }

  function handleSendChat(text) { sendChat(text); }

  function handleReaction(emoji) { sendReaction(emoji); }

  function handleVolumeChange(v) {
    setVolume(v);
    setGainVolume(v);
  }

  function handleSkipVote() {
    sendSkipVote();
  }

  function handleStartCapture(sessionId) {
    relay.startCapture(sessionId);
    setSourceMode('relay');
  }

  function handleStopCapture() {
    relay.stopCapture();
    setSourceMode(null);
    setAudioStream(null);
  }

  function handleSourceClosedDismiss() {
    relay.clearSourceClosed();
    setSourceMode(null);
    setAudioStream(null);
  }

  if (sessionEnded) {
    return <SessionEndedOverlay onHome={() => { sessionStorage.removeItem(SESSION_KEY); navigate('/'); }} />;
  }

  const amHost = isHost || users.find(u => u.id === myPeerId)?.isHost;

  return (
    <div className="room-page">
      <div className="room-header">
        <div className="room-header-left">
          <h2 className="room-code">Room: {roomCode}</h2>
          <ConnectionBadge quality={connectionQuality} />
        </div>
        <div className="room-header-right">
          <DarkModeToggle />
          <button className="btn btn-ghost btn-sm" onClick={handleLeave}>🚪 Leave</button>
        </div>
      </div>

      <div className="room-grid">
        <div className="room-main">
          {amHost && (
            <div className="source-tabs">
              <button
                className={`source-tab ${sourceMode === 'relay' ? 'active' : ''}`}
                onClick={() => setSourceMode('relay')}
              >
                💻 PC Audio
              </button>
            </div>
          )}

          {amHost && sourceMode === 'relay' && (
            <SourcePicker
              relayConnected={relay.connected}
              sessions={relay.sessions}
              capturing={relay.capturing}
              captureName={relay.captureName}
              onStartCapture={handleStartCapture}
              onStopCapture={handleStopCapture}
              onRefresh={relay.refreshSessions}
            />
          )}

          {!amHost && <div className="listener-info">🎧 Listening to host's stream</div>}

          <NowPlaying
            song={currentSong}
            position={displayPosition}
            isPlaying={playbackState.isPlaying}
          />

          <VolumeSlider volume={volume} onChange={handleVolumeChange} />

          {!amHost && playlist.length > 0 && (
            <button className="btn btn-secondary btn-sm skip-vote-btn" onClick={handleSkipVote}>
              ⏭ Vote to Skip {skipVotes.needed > 0 ? `(${skipVotes.count}/${skipVotes.needed})` : ''}
            </button>
          )}

          {amHost && (
            <PlaylistQueue
              playlist={playlist}
              currentSong={currentSong}
              onPlaySong={(song) => updateSong(song)}
              onAddSong={(song) => {
                const updated = [...playlist, { ...song, id: Date.now().toString(36) }];
                updatePlaylist(updated);
              }}
              onRemoveSong={(songId) => {
                const updated = playlist.filter(s => s.id !== songId);
                updatePlaylist(updated);
              }}
            />
          )}

          <EmojiReactions reactions={reactions} onReact={handleReaction} />
        </div>

        <div className="room-sidebar">
          <UserList users={users} myId={myPeerId} amHost={amHost} onKick={handleKick} />

          {amHost && (
            <HostControls
              onEndSession={() => {
                if (window.confirm('End session for everyone?')) handleEndSession();
              }}
              roomCode={roomCode}
              guestCount={users.filter(u => u.id !== myPeerId).length}
            />
          )}

          <Chat messages={messages} onSend={handleSendChat} nickname={nickname} />
        </div>
      </div>

      {showLeaveGuard && (
        <LeaveGuardModal
          users={users.filter(u => u.id !== myPeerId)}
          onTransfer={handleTransferHost}
          onLeaveAnyway={() => { endSession(); navigate('/'); }}
          onCancel={() => setShowLeaveGuard(false)}
        />
      )}

      {showHandoff && (
        <HostHandoffModal onDismiss={() => setShowHandoff(false)} />
      )}

      {relay.sourceClosed && (
        <SourceClosedPopup
          sourceName={relay.sourceClosed}
          onDismiss={handleSourceClosedDismiss}
        />
      )}

      {showInactivityNudge && (
        <div className="inactivity-nudge">
          <span>💤 No one's been in this room for a while. Still listening?</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowInactivityNudge(false); setNudgeDismissed(true); }}
          >
            Keep it open
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm('End session for everyone?')) handleEndSession();
            }}
          >
            End session
          </button>
        </div>
      )}
    </div>
  );
}
