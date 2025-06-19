const cds = require('@sap/cds')

module.exports = class ProductService extends cds.ApplicationService{
    init(){

        this.on('purchaseBook', async req=>{
            req.info(`Book bought`);
            return "Book bought";
        })

        this.on('buyBook', async (req) => {
            const bookBought = await SELECT.from(req.entity).where({ID:req.params[0].ID})
            if (!bookBought.length) {
                req.error(404, `Book with ID ${req.params[0].ID} not found`);
            }
            req.info(`Book ${bookBought[0].title} bought`);
            return "Book bought";
        })
        super.init();
    }
}