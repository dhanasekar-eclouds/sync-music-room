import React from 'react';

export default function SourceClosedPopup({ sourceName, onDismiss }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="scp-icon">⏹</div>
        <h2>Source Stopped</h2>
        <p>
          <strong>{sourceName}</strong> has closed or stopped playing.
          The audio stream has been disconnected.
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
