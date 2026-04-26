import { create } from 'zustand';

export type NotificationType =
  | 'rollback'
  | 'balance-refreshed-up'
  | 'balance-refreshed-down'
  | 'error';

export type Notification = {
  key: string;
  type: NotificationType;
  message: string;
  employeeId?: string;
  locationId?: string;
  newAvailable?: number;
};

type NotificationsState = {
  queue: Notification[];
  push: (notification: Notification) => void;
  dismiss: (key: string) => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  queue: [],

  push: (notification) =>
    set((state) => {
      const isDuplicate = state.queue.some((n) => n.key === notification.key);
      if (isDuplicate) return state;
      return { queue: [...state.queue, notification] };
    }),

  dismiss: (key) =>
    set((state) => ({
      queue: state.queue.filter((n) => n.key !== key),
    })),
}));
