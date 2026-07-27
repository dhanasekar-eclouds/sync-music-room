import React from 'react';

export default function UserList({ users, myId, amHost, onKick }) {
  return (
    <div className="user-list">
      <h3 className="section-title">
        👥 Users ({users.length})
      </h3>
      <div className="user-items">
        {users.map(u => (
          <div key={u.id} className={`user-item ${u.id === myId ? 'me' : ''} ${u.isHost ? 'host' : ''}`}>
            <div className="user-info">
              <span className={`user-status ${u.connected ? 'online' : 'offline'}`} />
              <span className="user-nick">{u.nickname}</span>
              {u.isHost && <span className="user-badge">Host</span>}
              {u.id === myId && <span className="user-badge subtle">You</span>}
            </div>
            {amHost && !u.isHost && (
              <button className="btn btn-xs btn-danger" onClick={() => onKick(u.id)}>
                👢 Kick
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
