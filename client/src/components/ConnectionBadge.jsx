import React from 'react';

const LABELS = {
  excellent: { icon: '🟢', text: 'Excellent' },
  good: { icon: '🟡', text: 'Good' },
  poor: { icon: '🔴', text: 'Poor' },
};

export default function ConnectionBadge({ quality }) {
  const info = LABELS[quality] || LABELS.poor;
  return (
    <span className={`connection-badge ${quality}`} title={`Connection: ${info.text}`}>
      {info.icon} {info.text}
    </span>
  );
}
