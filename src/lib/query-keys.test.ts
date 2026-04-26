import { describe, it, expect } from 'vitest';
import { queryKeys } from './query-keys';

describe('queryKeys', () => {
  describe('balance', () => {
    it('produces the correct tuple shape', () => {
      expect(queryKeys.balance('emp-1', 'loc-1')).toEqual(['balance', 'emp-1', 'loc-1']);
    });

    it('is unique per locationId', () => {
      expect(queryKeys.balance('emp-1', 'loc-1')).not.toEqual(queryKeys.balance('emp-1', 'loc-2'));
    });

    it('is unique per employeeId', () => {
      expect(queryKeys.balance('emp-1', 'loc-1')).not.toEqual(queryKeys.balance('emp-2', 'loc-1'));
    });
  });

  describe('balances', () => {
    it('produces the correct tuple shape', () => {
      expect(queryKeys.balances('emp-1')).toEqual(['balances', 'emp-1']);
    });

    it('is unique per employeeId', () => {
      expect(queryKeys.balances('emp-1')).not.toEqual(queryKeys.balances('emp-2'));
    });
  });

  describe('requests.employee', () => {
    it('produces the correct tuple shape', () => {
      expect(queryKeys.requests.employee('emp-1')).toEqual(['requests', 'employee', 'emp-1']);
    });
  });

  describe('requests.manager', () => {
    it('produces the correct tuple shape', () => {
      expect(queryKeys.requests.manager('mgr-1')).toEqual(['requests', 'manager', 'mgr-1']);
    });
  });

  describe('requests.detail', () => {
    it('produces the correct tuple shape', () => {
      expect(queryKeys.requests.detail('req-abc')).toEqual(['request', 'req-abc']);
    });
  });

  it('balance and balances root segments do not collide', () => {
    expect(queryKeys.balance('emp-1', 'loc-1')[0]).not.toBe(queryKeys.balances('emp-1')[0]);
  });

  it('requests.employee and requests.manager do not collide', () => {
    expect(queryKeys.requests.employee('emp-1')).not.toEqual(queryKeys.requests.manager('emp-1'));
  });
});
