import React, { useRef, useState, useCallback } from 'react';

export default function AudioPlayer({ onAudioStream, onSongChange, onGainNode }) {
  const [playing, setPlaying] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const fileRef = useRef(null);

  function stopCurrent() {
    try { sourceRef.current?.stop(); } catch { }
    sourceRef.current = null;
    setPlaying(false);
  }

  function createStream(buffer) {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    const gain = ctx.createGain();
    gain.gain.value = 1;
    gainRef.current = gain;
    onGainNode?.(gain);

    const dest = ctx.createMediaStreamDestination();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(dest);
    gain.connect(ctx.destination);

    sourceRef.current = source;
    onAudioStream?.(dest.stream);
    return source;
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileRef.current = file;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      try {
        const buffer = await ctx.decodeAudioData(evt.target.result);
        setCurrentFile(file.name);

        const source = createStream(buffer);
        source.start(0);
        startTimeRef.current = ctx.currentTime;
        setPlaying(true);

        onSongChange({
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Uploaded',
          duration: buffer.duration,
          art: '',
        });
      } catch (err) {
        console.error('Audio decode error:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handlePlayPause() {
    if (!audioCtxRef.current) return;

    if (playing) {
      pausedAtRef.current = audioCtxRef.current.currentTime - startTimeRef.current;
      stopCurrent();
    } else {
      if (currentFile) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const buffer = await audioCtxRef.current.decodeAudioData(evt.target.result);
          const source = createStream(buffer);
          source.start(0, pausedAtRef.current);
          startTimeRef.current = audioCtxRef.current.currentTime - pausedAtRef.current;
          setPlaying(true);
        };
        reader.readAsArrayBuffer(fileRef.current);
      }
    }
  }

  return (
    <div className="audio-player">
      <h3 className="section-title">🎧 Audio Source</h3>
      <div className="audio-controls">
        {!currentFile ? (
          <label className="upload-btn">
            📁 Upload Song
            <input type="file" accept="audio/*" onChange={handleFileUpload} hidden />
          </label>
        ) : (
          <>
            <button className="btn btn-primary btn-sm" onClick={handlePlayPause}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              📁 Change
              <input type="file" accept="audio/*" onChange={handleFileUpload} hidden />
            </label>
            <span className="audio-file-name">{currentFile}</span>
          </>
        )}
      </div>
    </div>
  );
}
