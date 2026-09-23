'use client';

import { useTheme } from './ThemeProvider';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
      {mounted && theme === 'dark' ? (
        // Sun Icon for Dark Mode (switch to light)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ) : mounted && theme === 'light' ? (
        // Moon Icon for Light Mode (switch to dark)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      ) : (
        <div style={{ width: 20, height: 20 }} /> // Placeholder during SSR
      )}
      <style jsx>{`
        .theme-toggle {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: inset 1px 1px 2px var(--glass-highlight);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .theme-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 4px 15px var(--glass-shadow),
            inset 1px 1px 2px var(--glass-highlight);
        }
      `}</style>
    </button>
  );
}
