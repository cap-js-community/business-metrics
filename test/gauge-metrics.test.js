process.env.cds_requires_telemetry_metrics_config = JSON.stringify({ exportIntervalMillis: 100 });

const cds = require('@sap/cds');
const { expect, GET } = cds.test().in(__dirname + '/bookshop');
const log = cds.test.log();
const wait = require('util').promisify(setTimeout);

describe('Gauge Metrics - BookStock Entity', () => {
  const admin = { auth: { username: 'alice' } };
  let db; // Reference to the database connection

  beforeAll(async () => {
    db = await cds.connect.to('db'); // Connect to the database
  });

  beforeEach(async () => {
    // Ensure test book exists
    const existingBook = await db.run(SELECT.from('sap.capire.bookshop.Books').where({ ID: 1001 }));
    if (existingBook.length === 0) {
      await db.run(INSERT.into('sap.capire.bookshop.Books').entries([
        { ID: 1001, title: 'Test Book', stock: 10 }
      ]));
    }
    log.clear();
  });

  afterEach(async () => {
    try {
      await db.run(cds.ql.DELETE.from('sap.capire.bookshop.Books').where({ ID: 1001 }));
    } catch (e) {
      // Ignore errors during cleanup to avoid failing tests if the record does not exist
      log && log.error && log.error('Cleanup DELETE failed for book ID 1001:', e);
    }
  });

  test('Gauge observes initial stock value', async () => {
    const { status } = await GET('/odata/v4/Category/BookStock', admin);
    expect(status).to.equal(200);

    await wait(500); // Allow gauge observation time to log

    expect(log.output).to.contain("CategoryService.BookStock");
    expect(log.output).to.contain("entity_gauge: 'CategoryService.BookStock'");
    expect(log.output).to.contain("key: 1001");
    expect(log.output).to.contain("value: 10");
  });

  test('Gauge updates when stock changes', async () => {
    // Update stock value in the database
    await db.run(UPDATE('sap.capire.bookshop.Books').set({ stock: 5 }).where({ ID: 1001 }));

    const { status } = await GET('/odata/v4/Category/BookStock', admin);
    expect(status).to.equal(200);

    await wait(500);

    // Ensure that stock value changes are logged properly
    expect(log.output).to.contain("CategoryService.BookStock");
    expect(log.output).to.contain("entity_gauge: 'CategoryService.BookStock'");
    expect(log.output).to.contain("key: 1001");
    expect(log.output).to.contain("value: 5");
  });

  test('Logs and throws error when gauge creation fails', async () => {
    const { metrics } = require('@opentelemetry/api');
    const { createObservableGauge } = require('../lib/metrics/entity-metrics');
    const originalGetMeter = metrics.getMeter;
    metrics.getMeter = () => { throw new Error('Gauge meter failure'); };

    // Clear log before test
    log.clear();

    const fakeEntity = { name: 'FakeEntity' };
    let thrownError;
    try {
      await createObservableGauge(fakeEntity, undefined, 'key');
    } catch (err) {
      thrownError = err;
    }
    expect(thrownError).to.exist;
    expect(thrownError.message).to.equal('Gauge meter failure');
    expect(log.output).to.match(/Error creating observable gauge/);
    expect(log.output).to.match(/FakeEntity/);

    // Restore original
    metrics.getMeter = originalGetMeter;
  });

   test('createObservableGauge observes gauge values for valid fields', async () => {
    const { createObservableGauge } = require('../lib/metrics/entity-metrics');
    // Mock entity, field, and key
    const entity = { name: 'TestEntity', description: 'desc' };
    const fieldToObserve = ['value'];
    const key = 'id';

    // Mock cds.transaction and SELECT
    const mockRow = { value: 42, id: 'abc' };
    const tx = {
      run: async () => [mockRow],
      rollback: async () => {}
    };
    const originalTransaction = cds.transaction;
    cds.transaction = () => tx;

    // Mock result.observe
    const observed = [];
    const result = {
      observe: (val, labels) => observed.push({ val, labels })
    };

    // Mock meter and gauge
    const { metrics } = require('@opentelemetry/api');
    const fakeGauge = { addCallback: (cb) => cb(result) };
    const fakeMeter = { createObservableGauge: () => fakeGauge };
    const originalGetMeter = metrics.getMeter;
    metrics.getMeter = () => fakeMeter;

    // Call createObservableGauge
    await createObservableGauge(entity, fieldToObserve, key);

    // Assert observe was called with correct values
    expect(observed).to.deep.include({
      val: 42,
      labels: { entity_gauge: 'TestEntity', key: 'abc' }
    });

    // Restore mocks
    metrics.getMeter = originalGetMeter;
    cds.transaction = originalTransaction;
  });

  test('createObservableGauge skips null/undefined fields', async () => {
    const { createObservableGauge } = require('../lib/metrics/entity-metrics');
    const entity = { name: 'TestEntity', description: 'desc' };
    const fieldToObserve = ['value', 'other'];
    const key = 'id';
    const mockRow = { value: null, other: undefined, id: 'abc' };
    const tx = {
      run: async () => [mockRow],
      rollback: async () => {}
    };
    const originalTransaction = cds.transaction;
    cds.transaction = () => tx;
    const observed = [];
    const result = {
      observe: (val, labels) => observed.push({ val, labels })
    };
    const { metrics } = require('@opentelemetry/api');
    const fakeGauge = { addCallback: (cb) => cb(result) };
    const fakeMeter = { createObservableGauge: () => fakeGauge };
    const originalGetMeter = metrics.getMeter;
    metrics.getMeter = () => fakeMeter;
    await createObservableGauge(entity, fieldToObserve, key);
    expect(observed).to.deep.equal([]);
    metrics.getMeter = originalGetMeter;
    cds.transaction = originalTransaction;
  });

  test('createObservableGauge logs error if observe throws', async () => {
    const { createObservableGauge } = require('../lib/metrics/entity-metrics');
    const entity = { name: 'TestEntity', description: 'desc' };
    const fieldToObserve = ['value'];
    const key = 'id';
    const mockRow = { value: 42, id: 'abc' };
    const tx = {
      run: async () => [mockRow],
      rollback: async () => {}
    };
    const originalTransaction = cds.transaction;
    cds.transaction = () => tx;
    const result = {
      observe: () => { throw new Error('observe error'); }
    };
    const { metrics } = require('@opentelemetry/api');
    const fakeGauge = { addCallback: (cb) => cb(result) };
    const fakeMeter = { createObservableGauge: () => fakeGauge };
    const originalGetMeter = metrics.getMeter;
    metrics.getMeter = () => fakeMeter;
    log.clear();
    await createObservableGauge(entity, fieldToObserve, key);
    expect(log.output).to.match(/Error observing gauge value/);
    metrics.getMeter = originalGetMeter;
    cds.transaction = originalTransaction;
  });

  test('createObservableGauge logs error if rollback fails', async () => {
    const { createObservableGauge } = require('../lib/metrics/entity-metrics');
    const entity = { name: 'TestEntity', description: 'desc' };
    const fieldToObserve = ['value'];
    const key = 'id';
    const tx = {
      run: async () => { throw new Error('tx error'); },
      rollback: async () => { throw new Error('rollback error'); }
    };
    const originalTransaction = cds.transaction;
    cds.transaction = () => tx;
    const result = {
      observe: () => {}
    };
    const { metrics } = require('@opentelemetry/api');
    const fakeGauge = { addCallback: (cb) => cb(result) };
    const fakeMeter = { createObservableGauge: () => fakeGauge };
    const originalGetMeter = metrics.getMeter;
    metrics.getMeter = () => fakeMeter;
    log.clear();
    await createObservableGauge(entity, fieldToObserve, key);
    expect(log.output).to.match(/Error in gauge callback/);
    metrics.getMeter = originalGetMeter;
    cds.transaction = originalTransaction;
  });

});