import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import DarkModeToggle from '../components/DarkModeToggle';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');

  function handleCreate() {
    if (!nickname.trim()) { setError('Enter a nickname'); return; }
    if (!password.trim()) { setError('Enter a room password'); return; }
    const code = generateCode();
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
