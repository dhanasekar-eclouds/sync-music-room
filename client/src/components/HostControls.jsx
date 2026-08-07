import React, { useState } from 'react';

// Every guest is a separate outbound WebRTC audio stream from the host (star
// topology), so the host's upload bandwidth is the hard scaling ceiling —
// each stream costs roughly this much regardless of guest count.
const PER_GUEST_KBPS = 32;
const WARN_GUEST_COUNT = 6;

export default function HostControls({ onEndSession, roomCode, guestCount = 0 }) {
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    const url = `${window.location.origin}/sync-music-room/room/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const estimatedKbps = guestCount * PER_GUEST_KBPS;

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
      {guestCount > 0 && (
        <p className={`bandwidth-hint ${guestCount >= WARN_GUEST_COUNT ? 'bandwidth-hint-warn' : ''}`}>
          📶 Uploading to {guestCount} guest{guestCount === 1 ? '' : 's'} (~{estimatedKbps} kbps).
          {guestCount >= WARN_GUEST_COUNT && ' Your upload speed may struggle with more listeners — audio is P2P from your PC, there\'s no server to offload to.'}
        </p>
      )}
    </div>
  );
}
