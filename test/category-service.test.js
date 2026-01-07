const cds = require('@sap/cds');
const { expect, POST, DELETE } = cds.test().in(__dirname + '/bookshop');

describe('CategoryService', () => {
  const admin = { auth: { username: 'alice' } };
  let db;

  beforeAll(async () => {
    db = await cds.connect.to('db');
    // Ensure a book exists for buyBook
    await db.run(INSERT.into('sap.capire.bookshop.Books').entries([
      { ID: 2001, title: 'Test Book', stock: 10 }
    ]));
  });

  afterAll(async () => {
    await db.run(cds.ql.DELETE.from('sap.capire.bookshop.Books').where({ ID: 2001 }));
  });

  test('purchaseBook action returns success', async () => {
    const { status, data } = await POST('/odata/v4/category/purchaseBook', {}, admin);
    expect(status).to.equal(200);
    expect(data.value).to.equal('Book bought');
  });

  test('buyBook action returns success when book exists', async () => {
    const { status, data } = await POST('/odata/v4/category/Books(ID=2001,IsActiveEntity=true)/CategoryService.buyBook', {}, admin);
    expect(status).to.equal(200);
    expect(data.value).to.equal('Book bought');
  });

  test('buyBook action returns 404 when book does not exist', async () => {
    let error;
    try {
      await POST('/odata/v4/category/Books(ID=9999,IsActiveEntity=true)/CategoryService.buyBook', {}, admin);
    } catch (err) {
      error = err;
    }
    expect(error).to.exist;
    expect(error.status).to.equal(404);
    expect(error.message).to.match(/not found/);
  });
});
