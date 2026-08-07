import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import DarkModeToggle from '../components/DarkModeToggle';
import { generateRoomCode } from '../utils/roomLogic';

const RELAY_DOWNLOAD_URL = 'https://github.com/dhanasekar-eclouds/sync-music-room/raw/master/local-relay/dist/SyncAudioRelay.exe';

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(null);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(location.state?.homeError || '');

  function handleCreate() {
    if (!nickname.trim()) { setError('Enter a nickname'); return; }
    if (!password.trim()) { setError('Enter a room password'); return; }
    const code = generateRoomCode();
    navigate(`/room/${code}`, {
      state: { nickname, password, isHost: true },
    });
  }

  function handleJoin() {
    if (!nickname.trim()) { setError('Enter a nickname'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    if (!password.trim()) { setError('Enter the room password'); return; }
    navigate(`/room/${roomCode.toUpperCase()}`, {
      state: { nickname, password, isHost: false },
    });
  }

  return (
    <div className="home-page">
      <div className="home-card">
        <div className="home-header">
          <h1 className="home-title">🎵 Sync Music Room</h1>
          <DarkModeToggle />
        </div>
        <p className="home-subtitle">Listen together, anywhere in the world</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="form-group">
          <label>Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            maxLength={20}
          />
        </div>

        <div className="form-group">
          <label>Room Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter room password"
          />
        </div>

        {mode === 'join' && (
          <div className="form-group">
            <label>Room Code</label>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={6}
            />
          </div>
        )}

        <div className="form-actions">
          {!mode && (
            <>
              <button className="btn btn-primary btn-block" onClick={() => setMode('create')}>
                🎧 Create New Room
              </button>
              <button className="btn btn-secondary btn-block" onClick={() => setMode('join')}>
                🔗 Join a Room
              </button>
            </>
          )}
          {mode === 'create' && (
            <>
              <button className="btn btn-primary btn-block" onClick={handleCreate}>
                🎧 Create Room
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(''); }}>
                Back
              </button>
              <p className="home-hint">
                💡 Want to share PC audio (Spotify, browser tabs, etc.)?{' '}
                <a href={RELAY_DOWNLOAD_URL} download="SyncAudioRelay.exe">
                  Download the relay app
                </a>{' '}
                and run it as host.
              </p>
            </>
          )}
          {mode === 'join' && (
            <>
              <button className="btn btn-primary btn-block" onClick={handleJoin}>
                🔗 Join Room
              </button>
              <button className="btn btn-ghost" onClick={() => { setMode(null); setError(''); }}>
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
