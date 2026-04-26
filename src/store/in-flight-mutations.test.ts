import { describe, it, expect, beforeEach } from 'vitest';
import { useInFlightMutationsStore } from './in-flight-mutations';

describe('useInFlightMutationsStore', () => {
  beforeEach(() => {
    useInFlightMutationsStore.setState({ mutations: new Set() });
  });

  it('reports false for a key that has never been added', () => {
    expect(useInFlightMutationsStore.getState().has('emp-1:loc-1')).toBe(false);
  });

  it('reports true after a key is added', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    expect(useInFlightMutationsStore.getState().has('emp-1:loc-1')).toBe(true);
  });

  it('reports false after a key is removed', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    useInFlightMutationsStore.getState().remove('emp-1:loc-1');
    expect(useInFlightMutationsStore.getState().has('emp-1:loc-1')).toBe(false);
  });

  it('removing a key that does not exist is a no-op', () => {
    expect(() => useInFlightMutationsStore.getState().remove('emp-1:loc-1')).not.toThrow();
  });

  it('tracks multiple keys independently', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    useInFlightMutationsStore.getState().add('emp-1:loc-2');

    expect(useInFlightMutationsStore.getState().has('emp-1:loc-1')).toBe(true);
    expect(useInFlightMutationsStore.getState().has('emp-1:loc-2')).toBe(true);
  });

  it('removing one key does not affect other in-flight keys', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    useInFlightMutationsStore.getState().add('emp-1:loc-2');
    useInFlightMutationsStore.getState().remove('emp-1:loc-1');

    expect(useInFlightMutationsStore.getState().has('emp-1:loc-1')).toBe(false);
    expect(useInFlightMutationsStore.getState().has('emp-1:loc-2')).toBe(true);
  });

  it('adding the same key twice is idempotent', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    expect(useInFlightMutationsStore.getState().mutations.size).toBe(1);
  });

  it('gates background refresh — has() returns true while mutation is registered', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');

    // This is the exact check in useBalance.ts onSuccess
    const shouldHoldBackgroundUpdate = useInFlightMutationsStore.getState().has('emp-1:loc-1');
    expect(shouldHoldBackgroundUpdate).toBe(true);
  });

  it('allows background refresh after mutation settles', () => {
    useInFlightMutationsStore.getState().add('emp-1:loc-1');
    useInFlightMutationsStore.getState().remove('emp-1:loc-1');

    const shouldHoldBackgroundUpdate = useInFlightMutationsStore.getState().has('emp-1:loc-1');
    expect(shouldHoldBackgroundUpdate).toBe(false);
  });
});
