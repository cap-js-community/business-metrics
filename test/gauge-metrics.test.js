process.env.cds_requires_telemetry_metrics_config = JSON.stringify({ exportIntervalMillis: 100 });

const cds = require('@sap/cds');
const { expect, GET, PATCH } = cds.test().in(__dirname + '/bookshop');
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
    await db.run(cds.ql.DELETE.from('sap.capire.bookshop.Books').where({ ID: 1001 }));
  });

  test('Gauge observes initial stock value', async () => {
    const { status } = await GET('/odata/v4/Category/BookStock', admin);
    expect(status).to.equal(200);

    await wait(500); // Allow gauge observation time to log

    expect(log.output).to.match(
        /CategoryService\.BookStock: {\s+attributes: { entity_gauge: 'CategoryService\.BookStock', key: 1001 },[\s\S]+?value: 10/i
      );
  });

  test('Gauge updates when stock changes', async () => {
    // Update stock value in the database
    await db.run(UPDATE('sap.capire.bookshop.Books').set({ stock: 5 }).where({ ID: 1001 }));

    const { status } = await GET('/odata/v4/Category/BookStock', admin);
    expect(status).to.equal(200);

    await wait(500);

    // Ensure that stock value changes are logged properly
    expect(log.output).to.match(
        /CategoryService\.BookStock: {\s+attributes: { entity_gauge: 'CategoryService\.BookStock', key: 1001 },[\s\S]+?value: 5/i
      );
  });
});
