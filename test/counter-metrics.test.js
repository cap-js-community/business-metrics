process.env.cds_requires_telemetry_metrics_config = JSON.stringify({ exportIntervalMillis: 100 });

const cds = require('@sap/cds');
const { expect, GET, POST, DELETE } = cds.test().in(__dirname + '/bookshop');
const log = cds.test.log();

const wait = require('util').promisify(setTimeout);

describe('Counter Metrics', () => {
  const admin = { auth: { username: 'alice' } };
  let db; // Reference to the database connection

  beforeAll(async () => {
    db = await cds.connect.to('db'); // Connect to the database
  });

  beforeEach(async () => {
    // Check if the book already exists
    const existingBook = await db.run(SELECT.from('sap.capire.bookshop.Books').where({ ID: 1001 }));
    if (existingBook.length === 0) {
      await db.run(INSERT.into('sap.capire.bookshop.Books').entries([
        { ID: 1001, title: 'Test Book', stock: 10, price: 20, currency_code: 'USD' }
      ]));
    }
    log.clear();
  });

  afterEach(async () => {
    await db.run(cds.ql.DELETE.from('sap.capire.bookshop.Books').where({ ID: 1001 }));
  });

  test('Counter increments on READ event', async () => {
    const { status } = await GET('/odata/v4/category/Books', admin);
    expect(status).to.equal(200);

    await wait(100);

    expect(log.output).to.match(/Books_READ_total/i);
  });

  test('Counter increments on DELETE event', async () => {
    const { status } = await DELETE('/odata/v4/category/Books(ID=1001,IsActiveEntity=true)', admin);
    expect(status).to.equal(204);

    await wait(100);

    expect(log.output).to.match(/Books_DELETE_total/i);
  });

  test('Counter increments on action purchaseBook', async () => {
    const { status } = await POST('/odata/v4/category/purchaseBook', {}, admin);
    expect(status).to.equal(200);

    await wait(100);

    expect(log.output).to.match(/purchaseBook_total/i);
  });

  test('Counter increments on bound action buyBook', async () => {
    const { status } = await POST('/odata/v4/category/Books(ID=1001,IsActiveEntity=true)/CategoryService.buyBook', {}, admin);
    expect(status).to.equal(200);

    await wait(100);

    expect(log.output).to.match(/Books_buyBook_total/i);
  });
});
