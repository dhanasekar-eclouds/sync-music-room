import React from 'react';

export default function SessionEndedOverlay({ onHome }) {
  return (
    <div className="session-ended">
      <div className="session-ended-card">
        <div className="se-icon">⏹</div>
        <h1>Session Ended</h1>
        <p>The host has ended this listening session.</p>
        <button className="btn btn-primary" onClick={onHome}>
          🏠 Back to Home
        </button>
      </div>
    </div>
  );
}
