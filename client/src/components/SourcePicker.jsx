import React, { useEffect } from 'react';

export default function SourcePicker({
  relayConnected, sessions, capturing, captureName,
  onStartCapture, onStopCapture, onRefresh,
}) {
  useEffect(() => {
    if (relayConnected) {
      const interval = setInterval(onRefresh, 3000);
      return () => clearInterval(interval);
    }
  }, [relayConnected, onRefresh]);

  if (!relayConnected) {
    return (
      <div className="source-picker disconnected">
        <h3 className="section-title">🎧 Audio Source</h3>
        <div className="sp-status">
          <span className="sp-dot off" />
          Local Relay not running
        </div>
        <p className="sp-hint">
          Download and run <strong>SyncAudioRelay.exe</strong> on your PC to capture Spotify, YouTube, etc.
        </p>
      </div>
    );
  }

  return (
    <div className="source-picker">
      <h3 className="section-title">🎧 Audio Source</h3>

      <div className="sp-status">
        <span className={`sp-dot ${capturing ? 'on' : 'idle'}`} />
        {capturing ? `Capturing: ${captureName}` : 'Relay connected — select a source'}
        {capturing && <button className="btn btn-xs btn-danger sp-stop" onClick={onStopCapture}>⏹ Stop</button>}
      </div>

      {!capturing && (
        <div className="sp-sessions">
          {sessions.length === 0 && <div className="sp-empty">No audio sources detected. Play something!</div>}
          {sessions.map(s => (
            <button
              key={s.id}
              className="sp-session"
              onClick={() => onStartCapture(s.id)}
            >
              <span className="sp-session-icon">🔊</span>
              <span className="sp-session-name">{s.name}</span>
              <span className="sp-session-proc">{s.processName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
