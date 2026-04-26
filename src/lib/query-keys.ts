export const queryKeys = {
  balance: (employeeId: string, locationId: string) =>
    ['balance', employeeId, locationId] as const,

  balances: (employeeId: string) =>
    ['balances', employeeId] as const,

  requests: {
    employee: (employeeId: string) =>
      ['requests', 'employee', employeeId] as const,

    manager: (managerId: string) =>
      ['requests', 'manager', managerId] as const,

    detail: (requestId: string) =>
      ['request', requestId] as const,
  },
} as const;
