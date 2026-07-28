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
  const [isHost] = useState(getInitial('isHost', false));
  const [volume, setVolume] = useState(1);
  const [showLeaveGuard, setShowLeaveGuard] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sourceMode, setSourceMode] = useState(null);

  const relay = useLocalRelay();

  const {
    myPeerId, users, messages, setMessages,
    reactions, currentSong, playbackState,
    playlist, connectionQuality, error, setError,
    setAudioStream, sendChat, sendReaction,
    kickUser, endSession, transferHost,
    updateSync, updateSong, updatePlaylist,
  } = usePeerConnection({ roomCode, nickname, isHost });

  const syncTimerRef = useRef(null);

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
    } else if (error === 'becameHost') {
      setShowHandoff(true);
      setError(null);
    }
  }, [error]);

  useEffect(() => {
    if (isHost && playbackState.isPlaying) {
      syncTimerRef.current = setInterval(() => {
        updateSync(playbackState.position + 1, true);
      }, 1000);
      return () => clearInterval(syncTimerRef.current);
    }
  }, [isHost, playbackState.isPlaying]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isHost) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isHost]);

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
    setShowLeaveGuard(false);
    navigate('/');
  }

  function handleSendChat(text) { sendChat(text); }

  function handleReaction(emoji) { sendReaction(emoji); }

  function handleVolumeChange(v) {
    setVolume(v);
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
            position={playbackState.position}
            isPlaying={playbackState.isPlaying}
          />

          <VolumeSlider volume={volume} onChange={handleVolumeChange} />

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
        <HostHandoffModal onDismiss={() => { setShowHandoff(false); window.location.reload(); }} />
      )}

      {relay.sourceClosed && (
        <SourceClosedPopup
          sourceName={relay.sourceClosed}
          onDismiss={handleSourceClosedDismiss}
        />
      )}
    </div>
  );
}
