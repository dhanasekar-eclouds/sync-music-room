import React, { useState, useEffect } from 'react';

const EMOJIS = ['👍', '❤️', '🎉', '🔥', '😎', '🎸', '💃', '🙌'];

export default function EmojiReactions({ reactions, onReact }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (reactions.length > 0) {
      const latest = reactions[reactions.length - 1];
      setVisible(prev => [...prev, { ...latest, key: Date.now() + Math.random() }]);
      setTimeout(() => {
        setVisible(prev => prev.slice(1));
      }, 3000);
    }
  }, [reactions]);

  return (
    <div className="emoji-reactions">
      <div className="reactions-float">
        {visible.map(r => (
          <span key={r.key} className="reaction-bubble">
            {r.nickname}: {r.emoji}
          </span>
        ))}
      </div>
      <div className="reactions-bar">
        {EMOJIS.map(emoji => (
          <button key={emoji} className="reaction-btn" onClick={() => onReact(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
