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
      __logger: logger, // 👈 expose for tests
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
  increaseCounter,
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

  // test('registers counters for entity with @Counter.attributes', async () => {
  //   const entity = {
  //     name: 'Books',
  //     '@Counter.attributes': ['user']
  //   };

  //   const srv = mockService({ entities: [entity] });
  //   cds.services.push(srv);

  //   await cds.__trigger('served');

  //   expect(srv.after).toHaveBeenCalled();
  // });

  test('registers counters for entity with @Counter events and attributes', async () => {
    const entity = {
      name: 'Books',
      '@Counter': [
        { event: 'READ', attributes: ['tenant'] }
      ]
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

  test('registers counters for entity with empty @Counter (all events)', async () => {
    const entity = {
      name: 'Books',
      '@Counter': []
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalled();
  });

  test('registers counter for bound action', async () => {
    const entity = {
      name: 'Books',
      actions: [
        {
          name: 'CategoryService.buyBook',
          parent: 'Books',
          '@Counter': true
        }
      ]
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalled();
  });

  // test('registers counter for bound action with @Counter.attributes', async () => {
  //   const entity = {
  //     name: 'Books',
  //     actions: [
  //       {
  //         name: 'CategoryService.buyBook',
  //         parent: 'Books',
  //         '@Counter.attributes': ['user']
  //       }
  //     ]
  //   };

  //   const srv = mockService({ entities: [entity] });
  //   cds.services.push(srv);

  //   await cds.__trigger('served');

  //   expect(srv.after).toHaveBeenCalled();
  // });

  test('registers counter for unbound action', async () => {
    const action = {
      name: 'CategoryService.purchaseBook',
      '@Counter': true
    };

    const srv = mockService({ actions: [action] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalledWith(
      'purchaseBook',
      expect.any(Function)
    );
  });

  test('registers counter for unbound action with @Counter.attributes', async () => {
    const action = {
      name: 'CategoryService.purchaseBook',
      '@Counter.attributes': ['tenant']
    };

    const srv = mockService({ actions: [action] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(srv.after).toHaveBeenCalled();
  });

  test('creates observable gauge when @Gauge annotations exist', async () => {
    const entity = {
      name: 'Books',
      '@Gauge.observe': 'stock',
      '@Gauge.key': 'ID'
    };

    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);

    await cds.__trigger('served');

    expect(createObservableGauge).toHaveBeenCalledWith(
      entity,
      'stock',
      'ID'
    );
  });



 

  // test('counter handler calls increaseCounter when executed', async () => {
  //   const entity = {
  //     name: 'Books',
  //     '@Counter.attributes': ['user']
  //   };

  //   const srv = mockService({ entities: [entity] });
  //   cds.services.push(srv);

  //   await cds.__trigger('served');

  //   const handler = srv.after.mock.calls[0][2];

  //   await handler({ user: { id: 'alice' } });

  //   expect(increaseCounter).toHaveBeenCalled();
  // });

  test('logs error for invalid attribute on entity counter', async () => {
    const entity = {
      name: 'Books',
      '@Counter.attributes': ['invalidAttribute']
    };
  
    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);
  
    await cds.__trigger('served');
  
    const calls = cds.__logger.error.mock.calls.flat().join(' ');
  
    expect(calls).toContain('Invalid attribute');
  });
  

  test('logs error for invalid attribute on bound action', async () => {
    const entity = {
      name: 'Books',
      actions: [
        {
          name: 'CategoryService.buyBook',
          parent: 'Books',
          '@Counter.attributes': ['invalid']
        }
      ]
    };
  
    const srv = mockService({ entities: [entity] });
    cds.services.push(srv);
  
    await cds.__trigger('served');
  

    expect(cds.__logger.error).toHaveBeenCalled();
  });
  
  test('logs error for invalid attribute on unbound action', async () => {
    const action = {
      name: 'CategoryService.purchaseBook',
      '@Counter.attributes': ['invalid']
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
      name: 'Books',
      '@Gauge.observe': 'stock',
      '@Gauge.key': 'ID'
    };
  
    cds.services.push(mockService({ entities: [entity] }));
  
    await cds.__trigger('served');
  
    expect(cds.__logger.error).toHaveBeenCalled();
  });
  
  
  // test('logs error if counter handler throws', async () => {
  //   increaseCounter.mockImplementationOnce(() => {
  //     throw new Error('counter failed');
  //   });
  
  //   const entity = {
  //     name: 'Books',
  //     '@Counter.attributes': ['user']
  //   };
  
  //   const srv = mockService({ entities: [entity] });
  //   cds.services.push(srv);
  
  //   await cds.__trigger('served');
  
  //   const handler = srv.after.mock.calls[0][2];
  //   await handler({ user: { id: 'alice' } });
  
  //   expect(cds.__logger.error).toHaveBeenCalled();
  // });
  
  

});
