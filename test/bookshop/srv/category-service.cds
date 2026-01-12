using { sap.capire.bookshop as my } from '../db/schema';

@impl: './category-service.js'
service CategoryService {
    @odata.draft.enabled

    @(Counter: [
        {
            event     : 'READ',
            attributes: [
                tenant
            ]
        },
        {
            event     : 'DELETE',
            attributes: [
                tenant
            ]
        }
    ])
    entity Books     as projection on my.Books
        actions {
            @(Counter: {attributes: [
            tenant
            ]})
            action buyBook() returns String;
        }

    @(Counter: {attributes: [
        tenant
    ]})
    action purchaseBook() returns String;


    @(Gauge: {
        key    : 'ID',
        observe: ['stock']
    })
    entity BookStock as
        projection on my.Books {
            ID,
            title,
            stock
        }
}