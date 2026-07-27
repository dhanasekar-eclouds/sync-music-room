import React from 'react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlaying({ song, position, isPlaying }) {
  if (!song) {
    return (
      <div className="now-playing empty">
        <div className="np-icon">🎵</div>
        <div className="np-info">
          <div className="np-title">No song playing</div>
          <div className="np-artist">Waiting for the host to start</div>
        </div>
      </div>
    );
  }

  const duration = song.duration || 0;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="now-playing">
      <div className="np-art">
        {song.art ? (
          <img src={song.art} alt="" className="np-art-img" />
        ) : (
          <div className="np-art-placeholder">🎵</div>
        )}
      </div>
      <div className="np-info">
        <div className="np-title">{song.title || 'Unknown'}</div>
        <div className="np-artist">{song.artist || 'Unknown artist'}</div>
        {song.album && <div className="np-album">{song.album}</div>}
        <div className="np-progress">
          <div className="np-time">{formatTime(position)}</div>
          <div className="np-bar">
            <div className="np-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="np-time">{formatTime(duration)}</div>
        </div>
        <div className={`np-status ${isPlaying ? 'playing' : 'paused'}`}>
          {isPlaying ? '▶ Playing' : '⏸ Paused'}
        </div>
      </div>
    </div>
  );
}
