import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders label', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('disables when isLoading', () => {
    render(<Button isLoading>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Working…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

