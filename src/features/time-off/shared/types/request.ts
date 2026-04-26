export type RequestStatus =
  | 'draft'
  | 'pending-hcm'
  | 'pending-manager'
  | 'approved'
  | 'denied'
  | 'rolled-back';

export type OptimisticState =
  | 'submitting'
  | 'pending-confirmation'
  | 'confirming'
  | 'rolled-back';

export type TimeOffRequest = {
  id: string;
  employeeId: string;
  locationId: string;
  days: number;
  startDate: string;
  endDate: string;
  status: RequestStatus;
  optimisticState?: OptimisticState;
  hcmRejectionReason?: string;
};
