'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: Variant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
};

export function Button({
  variant = 'primary',
  isLoading = false,
  leftIcon,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  const baseStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.2,
    boxShadow: variant === 'primary' ? 'var(--shadow-xs)' : undefined,
    border: variant === 'secondary' ? '1px solid var(--border)' : '1px solid transparent',
    background: variant === 'primary' ? 'var(--brand-teal)' : 'transparent',
    color: variant === 'primary' ? 'white' : 'var(--ink-1)',
    opacity: isDisabled ? 0.55 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'filter var(--duration-fast) var(--ease-out)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    userSelect: 'none',
  };

  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      className="focus:outline-none"
      style={baseStyle}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.95)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = '';
      }}
    >
      {leftIcon}
      {isLoading ? 'Working…' : children}
    </button>
  );
}

