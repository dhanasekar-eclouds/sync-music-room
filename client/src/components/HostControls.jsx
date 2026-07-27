import React, { useState } from 'react';

export default function HostControls({ onEndSession, roomCode }) {
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    const url = `${window.location.origin}/sync-music-room/room/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="host-controls">
      <h3 className="section-title">⚙️ Host Controls</h3>
      <div className="host-actions">
        <button className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
          {copied ? '✅ Copied!' : '📋 Copy Invite Link'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={onEndSession}>
          ⏹ End Session
        </button>
      </div>
    </div>
  );
}
