'use client';

import { useThemeStore } from '@/store';
import type { ThemeMode } from '@/store';

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center rounded-full border px-1 py-1 text-xs backdrop-blur"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.id === mode;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setMode(opt.id)}
            aria-pressed={isActive}
            className="rounded-full px-2.5 py-1 font-medium transition"
            style={{
              color: isActive ? 'var(--text)' : 'var(--muted)',
              background: isActive ? 'var(--surface-2)' : 'transparent',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

