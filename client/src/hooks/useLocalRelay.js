import { useState, useEffect, useRef, useCallback } from 'react';

export default function useLocalRelay() {
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [captureName, setCaptureName] = useState('');
  const [sourceClosed, setSourceClosed] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const destRef = useRef(null);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  function connect() {
    try {
      const ws = new WebSocket('ws://localhost:9876');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };

      ws.onclose = () => {
        setConnected(false);
        setCapturing(false);
        setStream(null);
      };

      ws.onerror = () => {
        setError('Could not connect to local relay');
        setConnected(false);
      };

      ws.onmessage = (e) => {
        if (typeof e.data === 'string') {
          try {
            const msg = JSON.parse(e.data);

            switch (msg.type) {
              case 'sessions':
                setSessions(msg.sessions || []);
                if (msg.capturing) {
                  setCapturing(true);
                  setCaptureName(msg.selectedSessionId
                    ? (msg.sessions?.find(s => s.id === msg.selectedSessionId)?.name || '')
                    : '');
                }
                break;

              case 'capture-status':
                if (msg.data.status === 'started') {
                  setCapturing(true);
                  setCaptureName(msg.data.sessionName || '');
                  setSourceClosed(null);
                } else {
                  setCapturing(false);
                  setCaptureName('');
                  setStream(null);
                }
                break;

              case 'source-closed':
                setSourceClosed(msg.data.sessionName);
                setCapturing(false);
                setCaptureName('');
                setStream(null);
                break;
            }
          } catch { }
        } else if (e.data instanceof Blob) {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext({ sampleRate: 44100 });
            destRef.current = audioCtxRef.current.createMediaStreamDestination();
            setStream(destRef.current.stream);
          }

          e.data.arrayBuffer().then((buf) => {
            const float32 = new Float32Array(buf);
            if (!destRef.current) return;

            try {
              const buffer = audioCtxRef.current.createBuffer(1, float32.length, 44100);
              buffer.getChannelData(0).set(float32);

              const source = audioCtxRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(destRef.current);
              source.start();
            } catch { }
          });
        }
      };
    } catch (err) {
      setError(err.message);
    }
  }

  function disconnect() {
    try {
      sendMsg({ type: 'stop-capture' });
    } catch { }
    wsRef.current?.close();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    destRef.current = null;
    setConnected(false);
    setCapturing(false);
    setStream(null);
    setSessions([]);
  }

  function sendMsg(data) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }

  const startCapture = useCallback((sessionId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Relay not connected');
      return;
    }
    sendMsg({ type: 'start-capture', sessionId });
    sendMsg({ type: 'list-sessions' });
  }, []);

  const stopCapture = useCallback(() => {
    sendMsg({ type: 'stop-capture' });
    setCapturing(false);
    setCaptureName('');
    setStream(null);
  }, []);

  const refreshSessions = useCallback(() => {
    sendMsg({ type: 'list-sessions' });
  }, []);

  const clearSourceClosed = useCallback(() => {
    setSourceClosed(null);
  }, []);

  return {
    connected, sessions, capturing, captureName,
    sourceClosed, stream, error,
    startCapture, stopCapture, refreshSessions,
    clearSourceClosed, disconnect,
  };
}
