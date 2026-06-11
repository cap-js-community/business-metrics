jest.mock('@sap/cds', () => {
    const onceHandlers = {};
    const logger = {
      error: jest.fn(),
      debug: jest.fn()
    };

    return {
      cli: { command: 'serve' },
      requires: {
        telemetry: {
          metrics: {
            enableBusinessMetrics: true
          }
        }
      },
      services: [],
      once: jest.fn((event, cb) => {
        onceHandlers[event] = cb;
      }),
      log: jest.fn(() => logger),
      __logger: logger, // expose for tests
      __trigger: async (event) => {
        if (onceHandlers[event]) {
          await onceHandlers[event]();
        }
      }
    };
  });

jest.mock('../lib/metrics/entity-metrics', () => ({
  increaseCounter: jest.fn(),
  createObservableGauge: jest.fn()
}));

/**
 * ---- IMPORTS (AFTER MOCKS) ----
 */

const cds = require('@sap/cds');
const {
  createObservableGauge
} = require('../lib/metrics/entity-metrics');

// IMPORTANT: import plugin AFTER mocks
require('../cds-plugin');

/**
 * ---- HELPERS ----
 */

function mockService({ entities = [], actions = [] } = {}) {
  return {
    name: 'TestService',
    entities,
    actions,
    after: jest.fn()
  };
}

beforeEach(() => {
  cds.services.length = 0;
  jest.clearAllMocks();
});

/**
 * ---- TESTS ----
 */

describe('cds-plugin business metrics', () => {

  test('registers counter for entity with @UsageMetering.Counting (READ)', async () => {
    const entity = {
      name: 'Books',
      '@UsageMetering.Counting#myBooksReadMetric.Dimensions.tenant': true,
      '@UsageMetering.Counting#myBooksReadMetric.Operation.CRUDType': 'Read',
      '@UsageMetering.Counting#myBooksReadMetric.Operation.Qualifier': 'List'
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalledWith(
      'READ',
      entity,
      expect.any(Function)
    );
  });

  test('registers counter for entity with @UsageMetering.Counting (DELETE)', async () => {
    const entity = {
      name: 'Books',
      '@UsageMetering.Counting#myBooksDeleteMetric.Dimensions.tenant': true,
      '@UsageMetering.Counting#myBooksDeleteMetric.Operation.CRUDType': 'Delete'
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalledWith(
      'DELETE',
      entity,
      expect.any(Function)
    );
  });

  test('skips entity counter when CRUDType is unknown', async () => {
    const entity = {
      name: 'Books',
      '@UsageMetering.Counting#bogus.Dimensions.tenant': true,
      '@UsageMetering.Counting#bogus.Operation.CRUDType': 'Frobnicate'
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).not.toHaveBeenCalled();
    expect(cds.__logger.error).toHaveBeenCalled();
  });

  test('registers counter for bound action', async () => {
    const entity = {
      name: 'Books',
      actions: [
        {
          name: 'CategoryService.buyBook',
          parent: 'Books',
          '@UsageMetering.Counting#myBuyBookCallsMetric.Dimensions.tenant': true
        }
      ]
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalledWith(
      'buyBook',
      entity,
      expect.any(Function)
    );
  });

  test('registers counter for unbound action', async () => {
    const action = {
      name: 'CategoryService.purchaseBook',
      '@UsageMetering.Counting#myPurchaseBookCallsMetric.Dimensions.tenant': true
    };

    const srv = mockService({ actions: [action] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalledWith(
      'purchaseBook',
      expect.any(Function)
    );
  });

  test('creates observable gauge when @UsageMetering.Gauge exists', async () => {
    const entity = {
      name: 'BookStock',
      '@UsageMetering.Gauge.Key': 'ID',
      '@UsageMetering.Gauge.Observe': ['stock']
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(createObservableGauge).toHaveBeenCalledWith(
      entity,
      ['stock'],
      'ID'
    );
  });

  test('logs error for invalid dimension on entity counter', async () => {
    const entity = {
      name: 'Books',
      '@UsageMetering.Counting#myBadMetric.Dimensions.invalidDimension': true,
      '@UsageMetering.Counting#myBadMetric.Operation.CRUDType': 'Read'
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    const calls = cds.__logger.error.mock.calls.flat().join(' ');
    expect(calls).toContain('Invalid');
  });

  test('logs error for invalid dimension on bound action', async () => {
    const entity = {
      name: 'Books',
      actions: [
        {
          name: 'CategoryService.buyBook',
          parent: 'Books',
          '@UsageMetering.Counting#myBadBoundMetric.Dimensions.invalid': true
        }
      ]
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(cds.__logger.error).toHaveBeenCalled();
  });

  test('logs error for invalid dimension on unbound action', async () => {
    const action = {
      name: 'CategoryService.purchaseBook',
      '@UsageMetering.Counting#myBadUnboundMetric.Dimensions.invalid': true
    };

    const srv = mockService({ actions: [action] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(cds.__logger.error).toHaveBeenCalled();
  });

  test('does not register metrics when NO_TELEMETRY is set', async () => {
    process.env.NO_TELEMETRY = 'true';

    jest.resetModules();
    require('../cds-plugin');

    await cds.__trigger('served');

    expect(cds.services.length).toBe(0);

    delete process.env.NO_TELEMETRY;
  });

  test('logs error when createObservableGauge throws', async () => {
    createObservableGauge.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const entity = {
      name: 'BookStock',
      '@UsageMetering.Gauge.Key': 'ID',
      '@UsageMetering.Gauge.Observe': ['stock']
    };

    cds.services.push(mockService({ entities: [entity] }));

    await cds.__trigger('served');

    expect(cds.__logger.error).toHaveBeenCalled();
  });

  test('registers counter for bracketed qualifier', async () => {
  const entity = {
    name: 'Books',
    '@UsageMetering.Counting#![my.metric].Dimensions.tenant': true,
    '@UsageMetering.Counting#![my.metric].Operation.CRUDType': 'Read'
  };

  const srv = mockService({ entities: [entity] });
  cds.services.push(srv);

  await cds.__trigger('served');

  expect(srv.after).toHaveBeenCalledWith(
    'READ',
    entity,
    expect.any(Function)
  );
});

test('logs error for malformed bracketed qualifier', async () => {
  const entity = {
    name: 'Books',
    '@UsageMetering.Counting#![brokenMetric.Dimensions.tenant': true
  };

  const srv = mockService({ entities: [entity] });
  cds.services.push(srv);

  await cds.__trigger('served');

  expect(cds.__logger.error).toHaveBeenCalled();
});

test('handles bracketed qualifier without path', async () => {
  const entity = {
    name: 'Books',
    '@UsageMetering.Counting#![metric]': true
  };

  const srv = mockService({ entities: [entity] });
  cds.services.push(srv);

  await cds.__trigger('served');

  expect(cds.__logger.error).toHaveBeenCalled();
});


});
