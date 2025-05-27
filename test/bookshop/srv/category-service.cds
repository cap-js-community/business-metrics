using { sap.capire.bookshop as my } from '../db/schema';

@impl: './category-service.js'
service CategoryService {
    @odata.draft.enabled

    @(Counter: [
        {
            event     : 'READ',
            attributes: [
                user,
                tenant
            ]
        },
        {
            event     : 'DELETE',
            attributes: [
                user,
                tenant
            ]
        }
    ])
    entity Books     as projection on my.Books
        actions {
            @(Counter: {attributes: [
            user,
            tenant
            ]})
            action buyBook() returns String;
        }

    @(Counter: {attributes: [
        user,
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