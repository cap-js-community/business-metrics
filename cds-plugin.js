const { increaseCounter, createObservableGauge } = require('./lib/metrics/entity-metrics')
const Dimensions = ["tenant"];
const CRUD = ["READ", "CREATE", "DELETE", "UPDATE"];
let _startup = true
const cds = require('@sap/cds')
const logger = cds.log('telemetry')
/* istanbul ignore next */
if (!(cds.cli?.command in { '': 1, serve: 1, run: 1 })) _startup = false
/* istanbul ignore next */
const i = process.argv.indexOf('add')
/* istanbul ignore next */
if (i > 1 && process.argv[i - 1].match(/cds(\.js)?$/)) _startup = false
/* istanbul ignore next */
if (!!process.env.NO_TELEMETRY && process.env.NO_TELEMETRY !== 'false') _startup = false

if (_startup && cds?.requires?.telemetry?.metrics?.enableBusinessMetrics) {
    cds.once("served", async () => {
        try {
            for (let srv of cds.services) {
                try {
                    for (let entity of srv.entities) {
                        await handleGaugeAnnotation(entity);
                        await handleCountingAnnotationOnEntity(entity, srv);
                        if (entity.actions) {
                            for (let boundAction of entity.actions) {
                                await handleCountingAnnotationOnBoundAction(entity, boundAction, srv);
                            }
                        }
                    }
                    for (let action of srv.actions) {
                        await handleCountingAnnotationOnUnboundAction(action, srv);
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
// Find all '@UsageMetering.Counting#<qualifier>...' keys (flat, dotted) and
// group them back into nested objects keyed by qualifier.
function getCountingAnnotations(target) {
    const grouped = {};
    if (!target) return [];
    const prefix = '@UsageMetering.Counting#';
    for (const key of Object.keys(target)) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.substring(prefix.length);
        let qualifier;
        let path;

        const dimensionsIdx = rest.lastIndexOf('.Dimensions');
        const operationIdx = rest.lastIndexOf('.Operation');

        const boundary = Math.max(dimensionsIdx, operationIdx);

        if (boundary !== -1) {
            qualifier = rest.substring(0, boundary);
            path = rest.substring(boundary + 1).split('.');
        } else {
            qualifier = rest;
            path = [];
        }

        if (!grouped[qualifier]) grouped[qualifier] = {};
        let cur = grouped[qualifier];
        for (let i = 0; i < path.length - 1; i++) {
            if (typeof cur[path[i]] !== 'object' || cur[path[i]] === null) cur[path[i]] = {};
            cur = cur[path[i]];
        }
        if (path.length > 0) cur[path[path.length - 1]] = target[key];
    }
    return Object.entries(grouped).map(([qualifier, value]) => ({ qualifier, value }));
}
function getDimensions(value) {
    return Array.isArray(value?.Dimensions)
        ? value.Dimensions
        : Object.keys(value?.Dimensions || {});
}
function getLabels(dimensions, req) {
    const labels = {};
    if (!dimensions) return labels;
    dimensions.forEach((name) => {
        const dimensionName = name['='] || name;
        if (!Dimensions.includes(dimensionName)) {
            const errorMsg = `Invalid dimension '${dimensionName}'. Valid dimensions are: ${Dimensions.join(', ')}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        switch (dimensionName) {
            case 'tenant':
                labels.tenant = req?.authInfo?.getSubdomain() || 'unknown';
                break;
            /* istanbul ignore next */
            default:
                throw new Error(`Unsupported dimension: ${dimensionName}`);
        }
    });
    return labels;
}

function validateDimensions(dimensions, context) {
    if (!dimensions || !Array.isArray(dimensions)) return;
    dimensions.forEach((name) => {
        const dimensionName = name['='] || name;
        if (!Dimensions.includes(dimensionName)) {
            const errorMsg = `Invalid dimension '${dimensionName}' in ${context}. Valid dimensions are: ${Dimensions.join(', ')}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
    });
}
async function handleCountingAnnotationOnEntity(entity, srv) {
    try {
        const annotations = getCountingAnnotations(entity);
        for (const { qualifier, value } of annotations) {
            const event = value?.Operation?.CRUDType?.toUpperCase();
            if (!CRUD.includes(event)) {
                logger.error(`Unknown CRUDType '${value?.Operation?.CRUDType}' for ${entity.name} #${qualifier}`);
                continue;
            }
            const dimensions = getDimensions(value);
            validateDimensions(dimensions, `entity ${entity.name} #${qualifier}`);
            srv.after(event, entity, async (_, req) => {
                try {
                    increaseCounter(qualifier, getLabels(dimensions, req));
                } catch (error) {
                    logger.error(`Error handling counter ${qualifier} on ${entity.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        logger.error(`Error setting up counting on entity ${entity.name}:`, error.message);
        throw error;
    }
}
async function handleCountingAnnotationOnBoundAction(entity, boundAction, srv) {
    try {
        const annotations = getCountingAnnotations(boundAction);
        for (const { qualifier, value } of annotations) {
            const dimensions = getDimensions(value);
            validateDimensions(dimensions, `bound action ${boundAction.name} #${qualifier}`);
            const actionName = boundAction.name.split('.').pop();
            srv.after(actionName, entity, async (_, req) => {
                try {
                    increaseCounter(qualifier, getLabels(dimensions, req));
                } catch (error) {
                    logger.error(`Error handling counter ${qualifier} on bound action ${boundAction.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        logger.error(`Error setting up counting on bound action ${boundAction.name}:`, error.message);
        throw error;
    }
}
async function handleCountingAnnotationOnUnboundAction(action, srv) {
    try {
        const annotations = getCountingAnnotations(action);
        for (const { qualifier, value } of annotations) {
            const dimensions = getDimensions(value);
            validateDimensions(dimensions, `unbound action ${action.name} #${qualifier}`);
            const actionName = action.name.split('.').pop();
            srv.after(actionName, async (_, req) => {
                try {
                    increaseCounter(qualifier, getLabels(dimensions, req));
                } catch (error) {
                    logger.error(`Error handling counter ${qualifier} on unbound action ${action.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        logger.error(`Error setting up counting on unbound action ${action.name}:`, error.message);
        throw error;
    }
}
async function handleGaugeAnnotation(entity) {
    try {
        const observe = entity['@UsageMetering.Gauge.Observe'];
        const key = entity['@UsageMetering.Gauge.Key'];
        if (observe && key) {
            await createObservableGauge(entity, observe, key);
        }
    } catch (error) {
        logger.error(`Error setting up gauge on entity ${entity.name}:`, error.message);
    }
}
