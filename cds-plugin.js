const { increaseCounter, createObservableGauge} = require('./lib/metrics/entity-metrics')
const events = ["READ", "CREATE", "DELETE", "UPDATE"];
const userAttributes = ["user", "tenant"];

let _startup = true

const cds = require('@sap/cds')
const logger = cds.log('telemetry')
if (!(cds.cli?.command in { '': 1, serve: 1, run: 1 })) _startup = false

// cds add XXX currently also has cli.command === ''
const i = process.argv.indexOf('add')
if (i > 1 && process.argv[i - 1].match(/cds(\.js)?$/)) _startup = false

if (!!process.env.NO_TELEMETRY && process.env.NO_TELEMETRY !== 'false') _startup = false


if(cds?.requires?.telemetry?.metrics?.enableBusinessMetrics) {
    //business metrics handling

    cds.once("served", async () => {
        try {
            // Go through all services
            for (let srv of cds.services) {
                try {
                    // Go through all entities of that service
                    for (let entity of srv.entities) { 

                        await handleGaugeAnnotation(entity);
                        await handleCounterAnnotationOnEntity(entity, srv);

                        if (entity.actions) {
                            for (let boundAction of entity.actions) {
                                await handleCounterAnnotationOnBoundAction(entity, boundAction, srv)
                            }
                        }
                    }

                    for (let action of srv.actions) {
                        await handleCounterAnnotationOnUnboundAction(action, srv);
                    }
                } catch (serviceError) {
                    logger.error(`Error processing service ${srv.name}:`, serviceError.message);
                }
            }
        } catch (error) {
            logger.error('Error in served event handler:', error.message);
        }
    });
}

function getLabels(attributes, req) {
    let labels = {};

    try {
        if (attributes) {
            attributes.forEach((attribute) => {
                try {
                    const attributeName = attribute['='] || attribute;
                    
                    // Validate if the attribute is in the list of valid attributes
                    if (!userAttributes.includes(attributeName)) {
                        const errorMsg = `Invalid attribute '${attributeName}'. Valid attributes are: ${userAttributes.join(', ')}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }

                    switch (attributeName) {
                        case 'user':
                            labels.user = req?.user?.id || 'unknown';
                            break;
                        case 'tenant':
                            labels.tenant = req?.authInfo?.getSubdomain() || 'unknown';
                            break;
                        default: {
                            // This should not happen due to validation above, but keeping as fallback
                            const fallbackErrorMsg = `Unsupported attribute: ${attributeName}`;
                            console.error(fallbackErrorMsg);
                            throw new Error(fallbackErrorMsg);
                        }
                    }
                } catch (attributeError) {
                    logger.error(`Error processing attribute ${attribute['='] || attribute}:`, attributeError.message);
                    throw attributeError; // Re-throw to stop processing
                }
            });
        }
    } catch (error) {
        logger.error('Error getting labels:', error.message);
        throw error; // Re-throw to propagate the error
    }

    return labels;
}

function validateAttributes(attributes, context) {
    if (!attributes || !Array.isArray(attributes)) {
        return; // No attributes to validate
    }

    logger.debug(`Checking attributes for ${context}:`, attributes.map(attr => attr['='] || attr));

    attributes.forEach((attribute) => {
        const attributeName = attribute['='] || attribute;
        if (!userAttributes.includes(attributeName)) {
            const errorMsg = `Invalid attribute '${attributeName}' in ${context}. Valid attributes are: ${userAttributes.join(', ')}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    });
    
    logger.debug(`All attributes valid for ${context}`);
}

async function handleCounterAnnotationOnEntity(entity, srv) {
    try {
        if (entity['@Counter.attributes']) {
            // Validate attributes before setting up handlers
            validateAttributes(entity['@Counter.attributes'], `entity ${entity.name} @Counter.attributes`);
            
            // Register after handler for all events and create counter with given attributes
            for (let event of events) {
                srv.after(event, entity, async (req) => {
                    try {
                        increaseCounter(`${entity.name}_${event}_total`, getLabels(entity['@Counter.attributes'], req));
                        // createCounterMetrics({entity: entity.name, event: event, labels: getLabels(event, req)})
                    } catch (error) {
                        logger.error(`Error handling counter for entity ${entity.name}, event ${event}:`, error.message);
                    }
                });
            }
        } 

        else if (entity['@Counter']) {
            // User annotated with only events, may or may not have specified attributes
            if (entity['@Counter'].length > 0) {
                // Register after handler for only those events as annotated by user
                for (let event of entity['@Counter']) {
                    // Validate attributes if they exist
                    if (event.attributes) {
                        validateAttributes(event.attributes, `entity ${entity.name} @Counter event ${event.event}`);
                    }
                    
                    srv.after(event.event, entity, async (_, req) => {
                        try {
                            let attributes = event.attributes ? event.attributes : userAttributes;
                            increaseCounter(`${entity.name}_${event.event}_total`, getLabels(attributes, req));
                            // createCounterMetrics({entity: entity.name, event: event['='], labels: getLabels(event, req)})
                        } catch (error) {
                            logger.error(`Error handling counter for entity ${entity.name}, event ${event.event}:`, error.message);
                        }
                    });
                }
            } else {
                // User annotated without specifying the event and attributes
                for (let event of events) {
                    srv.after(event, entity, async (req) => {
                        try {
                            increaseCounter(`${entity.name}_${event}_total`, getLabels(userAttributes, req));
                            // createCounterMetrics({entity: entity.name, event: event, labels: getLabels([], req)})
                        } catch (error) {
                            logger.error(`Error handling counter for entity ${entity.name}, event ${event}:`, error.message);
                        }
                    });
                }
            }
        }
    } catch (error) {
        logger.error(`Error setting up counter annotation for entity ${entity.name}:`, error.message);
        throw error; // Re-throw validation errors to stop service initialization
    }
}

async function handleCounterAnnotationOnBoundAction(entity, boundAction, srv) {
    try {
        if (boundAction['@Counter'] || boundAction['@Counter.attributes']) {
            let attributes = boundAction['@Counter'] ? userAttributes : boundAction['@Counter.attributes'];
            
            // Validate attributes
            if (boundAction['@Counter.attributes']) {
                validateAttributes(boundAction['@Counter.attributes'], `bound action ${boundAction.name} @Counter.attributes`);
            }
            
            // Extract name from action.name => CatalogService.purchaseBook -> purchaseBook
            const actionName = boundAction.name.split('.').pop();

            srv.after(actionName, entity, async (_, req) => {
                try {
                    increaseCounter(`${boundAction.parent}_${boundAction.name}_total`, getLabels(attributes, req));
                    // createCounterMetrics({isAction: true, action: `${boundAction.parent}-${boundAction.name}`, actionResponse: res})
                } catch (error) {
                    logger.error(`Error handling counter for bound action ${boundAction.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        logger.error(`Error setting up counter annotation for bound action ${boundAction.name}:`, error.message);
        throw error; // Re-throw validation errors to stop service initialization
    }
}

async function handleCounterAnnotationOnUnboundAction(action, srv) {
    try {
        if (action['@Counter'] || action['@Counter.attributes']) {
            let attributes = action['@Counter'] ? userAttributes : action['@Counter.attributes'];
            
            // Validate attributes
            if (action['@Counter.attributes']) {
                validateAttributes(action['@Counter.attributes'], `unbound action ${action.name} @Counter.attributes`);
            }

            // Extract name from action.name => CatalogService.purchaseBook -> purchaseBook
            const actionName = action.name.split('.').pop();

            srv.after(actionName, async (_, req) => {
                try {
                    increaseCounter(`${action.name}_total`, getLabels(attributes, req));
                    // createCounterMetrics({isAction: true, action: action.name, actionReq: req})
                } catch (error) {
                    logger.error(`Error handling counter for unbound action ${action.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        logger.error(`Error setting up counter annotation for unbound action ${action.name}:`, error.message);
        throw error; // Re-throw validation errors to stop service initialization
    }
}

async function handleGaugeAnnotation(entity) {
    try {
        if (entity['@Gauge.observe'] && entity['@Gauge.key']) {
            await createObservableGauge(entity, entity['@Gauge.observe'], entity['@Gauge.key']);
        }
    } catch (error) {
        logger.error(`Error setting up gauge annotation for entity ${entity.name}:`, error.message);
    }
}

// if (_startup) require('./lib')()
