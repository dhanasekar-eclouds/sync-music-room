import React, { useState } from 'react';

export default function PlaylistQueue({ playlist, currentSong, onPlaySong, onAddSong, onRemoveSong }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState('');

  function handleAdd() {
    if (!title.trim()) return;
    onAddSong({
      title: title.trim(),
      artist: artist.trim() || 'Unknown',
      duration: parseFloat(duration) || 0,
    });
    setTitle('');
    setArtist('');
    setDuration('');
  }

  return (
    <div className="playlist-queue">
      <h3 className="section-title">📋 Playlist Queue</h3>

      <div className="playlist-add">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Song title"
        />
        <input
          type="text"
          value={artist}
          onChange={e => setArtist(e.target.value)}
          placeholder="Artist"
        />
        <input
          type="number"
          value={duration}
          onChange={e => setDuration(e.target.value)}
          placeholder="Duration (sec)"
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!title.trim()}>
          Add
        </button>
      </div>

      <div className="playlist-items">
        {playlist.length === 0 && (
          <div className="playlist-empty">Queue is empty. Add songs!</div>
        )}
        {playlist.map((song, i) => (
          <div
            key={song.id}
            className={`playlist-item ${currentSong?.title === song.title ? 'active' : ''}`}
          >
            <span className="playlist-idx">{i + 1}.</span>
            <div className="playlist-info">
              <span className="playlist-title">{song.title}</span>
              {song.artist && <span className="playlist-artist">{song.artist}</span>}
            </div>
            <button className="btn btn-xs btn-primary" onClick={() => onPlaySong(song)}>
              ▶
            </button>
            <button className="btn btn-xs btn-danger" onClick={() => onRemoveSong(song.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
