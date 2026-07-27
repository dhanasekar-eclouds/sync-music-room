import React from 'react';

export default function HostHandoffModal({ onDismiss }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>🎧 You are now the host</h2>
        <p>
          The previous host has left. You have been granted host controls.
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
