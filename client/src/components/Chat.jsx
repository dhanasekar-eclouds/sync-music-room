import React, { useState, useRef, useEffect } from 'react';

export default function Chat({ messages, onSend, nickname }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <div className="chat">
      <h3 className="section-title">💬 Chat</h3>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Say hello!</div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-msg ${m.nickname === nickname ? 'own' : ''}`}>
            <span className="chat-nick">{m.nickname}</span>
            <span className="chat-text">{m.text}</span>
            <span className="chat-time">
              {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
        />
        <button type="submit" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
