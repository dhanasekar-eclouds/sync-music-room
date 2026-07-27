import React from 'react';
import { useDarkMode } from '../context/DarkModeContext';

export default function DarkModeToggle() {
  const { dark, toggle } = useDarkMode();
  return (
    <button className="btn btn-icon" onClick={toggle} title="Toggle dark mode">
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
