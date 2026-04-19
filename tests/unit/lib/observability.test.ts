import { describe, expect, it, vi } from 'vitest';
import {
  getRequestLogContext,
  logWorkflowEvent,
} from '../../../src/lib/observability';

describe('observability helpers', () => {
  it('derives stable request log context', () => {
    const request = {
      id: 'req_123',
      method: 'POST',
      routeOptions: {
        url: '/api/v1/orders',
      },
      url: '/api/v1/orders',
    };

    expect(
      getRequestLogContext(
        request as Parameters<typeof getRequestLogContext>[0],
      ),
    ).toEqual({
      requestId: 'req_123',
      method: 'POST',
      route: '/api/v1/orders',
    });
  });

  it('writes workflow logs with event and request correlation fields', () => {
    const info = vi.fn();
    const request = {
      id: 'req_456',
      method: 'PATCH',
      routeOptions: {
        url: '/api/v1/orders/:orderId',
      },
      url: '/api/v1/orders/123',
      log: {
        info,
      },
    };

    logWorkflowEvent(
      request as Parameters<typeof logWorkflowEvent>[0],
      'order.amended',
      {
        orderId: 'order_123',
        alreadyApplied: false,
      },
    );

    expect(info).toHaveBeenCalledWith(
      {
        event: 'order.amended',
        requestId: 'req_456',
        method: 'PATCH',
        route: '/api/v1/orders/:orderId',
        orderId: 'order_123',
        alreadyApplied: false,
      },
      'order.amended',
    );
  });
});
