import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationsStore } from './notifications';
import type { Notification } from './notifications';

const makeNotification = (overrides?: Partial<Notification>): Notification => ({
  key: 'rollback-emp-1-loc-1',
  type: 'rollback',
  message: 'Balance unchanged — please try again',
  ...overrides,
});

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ queue: [] });
  });

  it('adds a notification to the queue', () => {
    useNotificationsStore.getState().push(makeNotification());
    expect(useNotificationsStore.getState().queue).toHaveLength(1);
  });

  it('stores the notification with all its fields', () => {
    const notification = makeNotification({ employeeId: 'emp-1', locationId: 'loc-1' });
    useNotificationsStore.getState().push(notification);
    expect(useNotificationsStore.getState().queue[0]).toEqual(notification);
  });

  it('deduplicates by key — pushing the same key twice results in one entry', () => {
    useNotificationsStore.getState().push(makeNotification());
    useNotificationsStore.getState().push(makeNotification());
    expect(useNotificationsStore.getState().queue).toHaveLength(1);
  });

  it('allows different notifications with different keys', () => {
    useNotificationsStore.getState().push(makeNotification({ key: 'n-1' }));
    useNotificationsStore.getState().push(makeNotification({ key: 'n-2' }));
    expect(useNotificationsStore.getState().queue).toHaveLength(2);
  });

  it('dismisses a notification by key', () => {
    useNotificationsStore.getState().push(makeNotification({ key: 'n-1' }));
    useNotificationsStore.getState().dismiss('n-1');
    expect(useNotificationsStore.getState().queue).toHaveLength(0);
  });

  it('only removes the matching notification when dismissing', () => {
    useNotificationsStore.getState().push(makeNotification({ key: 'n-1' }));
    useNotificationsStore.getState().push(makeNotification({ key: 'n-2', type: 'balance-refreshed-up' }));

    useNotificationsStore.getState().dismiss('n-1');

    const { queue } = useNotificationsStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].key).toBe('n-2');
  });

  it('dismissing a key that does not exist is a no-op', () => {
    useNotificationsStore.getState().push(makeNotification({ key: 'n-1' }));
    useNotificationsStore.getState().dismiss('non-existent');
    expect(useNotificationsStore.getState().queue).toHaveLength(1);
  });

  it('two rollbacks for different locations produce two toasts', () => {
    useNotificationsStore.getState().push(makeNotification({ key: 'rollback-emp-1-loc-1' }));
    useNotificationsStore.getState().push(makeNotification({ key: 'rollback-emp-1-loc-2' }));
    expect(useNotificationsStore.getState().queue).toHaveLength(2);
  });
});
