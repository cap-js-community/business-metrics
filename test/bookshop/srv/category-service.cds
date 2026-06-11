using { sap.capire.bookshop as my } from '../db/schema';

@impl: './category-service.js'
service CategoryService {
    @odata.draft.enabled
    entity Books as projection on my.Books actions {
        action buyBook() returns String;
    };

    action purchaseBook() returns String;

    entity BookStock as projection on my.Books {
        ID,
        title,
        stock
    };
}

// =====================================================
// METERING ANNOTATIONS 
// =====================================================


// UNBOUND ACTION
//---------------
annotate CategoryService.purchaseBook with @UsageMetering.Counting #myPurchaseBookCallsMetric : {
    Dimensions : { tenant }
};

// BOUND ACTION
//-------------
annotate CategoryService.Books with actions {
    buyBook @UsageMetering.Counting #myBuyBookCallsMetric : {
        Dimensions : { tenant }
    };
};

// ENTITY — CRUD METRICS (READ + DELETE)
//--------------------------------------
annotate CategoryService.Books with @(
    UsageMetering.Counting #myBooksReadMetric : {
        Dimensions : { tenant },
        Operation  : {
            CRUDType  : 'Read'
            // Qualifier : 'List'
        }
    },

    UsageMetering.Counting #myBooksDeleteMetric : {
        Dimensions : { tenant },
        Operation  : {
            CRUDType : 'Delete'
        }
    },
     // Bracketed qualifier per CDS spec (https://cap.cloud.sap/docs/cds/cdl#identifiers).
    // Allows characters not legal in plain identifiers (here, a dash and a dot).
    UsageMetering.Counting #![my-cool.metric] : {
        Dimensions : { tenant },
        Operation  : { CRUDType : 'Read' }
    },

    // Bracketed qualifier with multiple periods. Stress-test for parsers
    // that only split at the first dot.
    UsageMetering.Counting #![com.example.deep.metric] : {
        Dimensions : { tenant },
        Operation  : { CRUDType : 'Read' }
    },

    // Bracketed qualifier whose name ends with a reserved word (`Operation`).
    // The parser must use right-to-left scanning so the boundary between
    // qualifier and path lands on the SECOND `Operation`, not the first.
    UsageMetering.Counting #![my.Operation] : {
        Dimensions : { tenant },
        Operation  : { CRUDType : 'Read' }
    },

    // Array-form Dimensions (alternate CDS shorthand). Compiles to a single
    // key with array value: `Dimensions: [{'=': 'tenant'}]`, distinct from
    // the object-form `Dimensions: { tenant }` which compiles to one flat
    // key per dim. Exercises the array branch of getDimensions().
    UsageMetering.Counting #myArrayDimMetric : {
        Dimensions : [ tenant ],
        Operation  : { CRUDType : 'Read' }
    }

);

// GAUGE (BookStock)
//------------------
annotate CategoryService.BookStock with @UsageMetering.Gauge : {
    Key     : 'ID',
    Observe : ['stock']
};
