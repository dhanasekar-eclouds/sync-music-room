import React from 'react';

export default function VolumeSlider({ volume, onChange }) {
  function getIcon() {
    if (volume === 0) return '🔇';
    if (volume < 0.3) return '🔈';
    if (volume < 0.7) return '🔉';
    return '🔊';
  }

  return (
    <div className="volume-slider">
      <span className="volume-icon">{getIcon()}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="volume-range"
      />
      <span className="volume-value">{Math.round(volume * 100)}%</span>
    </div>
  );
}
