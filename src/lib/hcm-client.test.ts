import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hcmClient, HCMTimeoutError, HCMError } from './hcm-client';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('hcmClient', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Timeout ──────────────────────────────────────────────────────────────

  // The mock must respect the AbortSignal: when controller.abort() fires, real
  // fetch rejects with an AbortError. Our mock must do the same.
  function makeAbortableFetchMock() {
    return vi.mocked(fetch).mockImplementation((_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    );
  }

  it('throws HCMTimeoutError when fetch does not resolve within 8s', async () => {
    vi.useFakeTimers();
    makeAbortableFetchMock();

    const promise = hcmClient.getBalance('emp-1', 'loc-annual');
    vi.advanceTimersByTime(8_001);

    await expect(promise).rejects.toThrow(HCMTimeoutError);
  });

  it('HCMTimeoutError has the correct name', async () => {
    vi.useFakeTimers();
    makeAbortableFetchMock();

    const promise = hcmClient.getBalance('emp-1', 'loc-annual');
    vi.advanceTimersByTime(8_001);

    await expect(promise).rejects.toMatchObject({ name: 'HCMTimeoutError' });
  });

  it('does NOT throw HCMTimeoutError when response arrives before 8s', async () => {
    const fakeBalance = {
      employeeId: 'emp-1', locationId: 'loc-annual',
      locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: 0,
    };
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(fakeBalance));

    await expect(hcmClient.getBalance('emp-1', 'loc-annual')).resolves.toBeDefined();
  });

  // ── fetchedAt stamping ────────────────────────────────────────────────────

  it('stamps fetchedAt with Date.now() on getBalance', async () => {
    const fakeBalance = {
      employeeId: 'emp-1', locationId: 'loc-annual',
      locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: 0,
    };
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(fakeBalance));

    const before = Date.now();
    const balance = await hcmClient.getBalance('emp-1', 'loc-annual');
    const after = Date.now();

    expect(balance.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(balance.fetchedAt).toBeLessThanOrEqual(after);
  });

  it('overwrites the server fetchedAt (0) with the client-side timestamp', async () => {
    const fakeBalance = {
      employeeId: 'emp-1', locationId: 'loc-annual',
      locationName: 'Annual Leave', available: 15, pending: 0,
      fetchedAt: 0, // server returns 0
    };
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(fakeBalance));

    const balance = await hcmClient.getBalance('emp-1', 'loc-annual');
    expect(balance.fetchedAt).toBeGreaterThan(0);
  });

  it('stamps fetchedAt on every balance in getBalances', async () => {
    const fakeBalances = [
      { employeeId: 'emp-1', locationId: 'loc-annual', locationName: 'Annual Leave', available: 15, pending: 0, fetchedAt: 0 },
      { employeeId: 'emp-1', locationId: 'loc-sick',   locationName: 'Sick Leave',   available: 10, pending: 0, fetchedAt: 0 },
    ];
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(fakeBalances));

    const balances = await hcmClient.getBalances('emp-1');
    for (const b of balances) {
      expect(b.fetchedAt).toBeGreaterThan(0);
    }
  });

  // ── Error classification ──────────────────────────────────────────────────

  it('throws HCMError with INSUFFICIENT_BALANCE code on 409', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: 'INSUFFICIENT_BALANCE', available: 3 }, 409),
    );

    await expect(
      hcmClient.submitRequest({ employeeId: 'emp-1', locationId: 'loc-annual', days: 10, startDate: '2026-05-01', endDate: '2026-05-10' }),
    ).rejects.toMatchObject({ name: 'HCMError', status: 409, code: 'INSUFFICIENT_BALANCE' });
  });

  it('throws HCMError with BALANCE_CHANGED code on 409 approval conflict', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: 'BALANCE_CHANGED', currentBalance: 1 }, 409),
    );

    await expect(hcmClient.approveRequest('req-1')).rejects.toMatchObject({
      name: 'HCMError',
      status: 409,
      code: 'BALANCE_CHANGED',
    });
  });

  it('throws HCMError with INVALID_DIMENSION code on 400', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: 'INVALID_DIMENSION' }, 400),
    );

    await expect(
      hcmClient.submitRequest({ employeeId: 'emp-1', locationId: 'loc-bad', days: 1, startDate: '2026-05-01', endDate: '2026-05-01' }),
    ).rejects.toMatchObject({ name: 'HCMError', status: 400, code: 'INVALID_DIMENSION' });
  });

  it('throws HCMError on 503 server error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: 'SERVER_ERROR' }, 503),
    );

    await expect(hcmClient.getBalance('emp-1', 'loc-annual')).rejects.toMatchObject({
      name: 'HCMError',
      status: 503,
    });
  });

  it('HCMError preserves the full response body in data', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ error: 'INSUFFICIENT_BALANCE', available: 3 }, 409),
    );

    try {
      await hcmClient.submitRequest({ employeeId: 'emp-1', locationId: 'loc-annual', days: 10, startDate: '2026-05-01', endDate: '2026-05-10' });
    } catch (err) {
      expect(err).toBeInstanceOf(HCMError);
      expect((err as HCMError).data).toMatchObject({ available: 3 });
    }
  });

  // ── Request construction ──────────────────────────────────────────────────

  it('calls the correct URL for getBalance with simulate param', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ employeeId: 'emp-1', locationId: 'loc-annual', available: 15, pending: 0, fetchedAt: 0 }),
    );

    await hcmClient.getBalance('emp-1', 'loc-annual', 'slow');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('simulate=slow'),
      expect.anything(),
    );
  });

  it('sends JSON body on submitRequest', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ requestId: 'req-1', status: 'accepted' }),
    );

    await hcmClient.submitRequest({
      employeeId: 'emp-1', locationId: 'loc-annual',
      days: 2, startDate: '2026-05-01', endDate: '2026-05-02',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/mock/hcm/requests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });
});
