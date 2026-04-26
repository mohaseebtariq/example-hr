import { create } from 'zustand';

type RequestModalState = {
  isOpen: boolean;
  locationId: string | null;
  openModal: (locationId: string) => void;
  closeModal: () => void;
};

export const useRequestModalStore = create<RequestModalState>((set) => ({
  isOpen: false,
  locationId: null,
  openModal: (locationId) => set({ isOpen: true, locationId }),
  closeModal: () => set({ isOpen: false, locationId: null }),
}));
