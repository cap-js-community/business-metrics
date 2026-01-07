const cds = require('@sap/cds')
const logger = cds.log('telemetry')

const { metrics } = require('@opentelemetry/api')

const METER = '@cap-js/telemetry:business-metrics';

//Store counters to avoid recreating it for the same entity-event
const counters = new Map();

function getOrCreateCounter(counterName, args) {
    try {
        if (counters.has(counterName)) {
            return counters.get(counterName);
        }
        const meter = metrics.getMeter(METER);
        let counter;
        counter = meter.createCounter(counterName, args);
        counters.set(counterName, counter);
        return counter;
    } catch (error) {
        logger.error('Error creating or retrieving counter:', { counterName, error: error.message });
        throw error;
    }
}

function increaseCounter(counterName, args) {
    try {
        const counter = getOrCreateCounter(counterName);
        counter.add(1, args);
    } catch (error) {
        logger.error('Error increasing counter:', { counterName, args, error: error.message });
        // Don't re-throw to avoid breaking the application flow
    }
}

async function createObservableGauge(entity, fieldToObserve, key) {
    try {
        const meter = metrics.getMeter(METER);
        const gaugeEntities = meter.createObservableGauge(entity.name, {
            description: entity.description ? entity.description : 'No description available',
        });

        const callback = async (result) => {
            let tx;
            try {
                tx = cds.transaction();
                const gaugeEntity = await tx.run(SELECT.from(entity));

                gaugeEntity.forEach(e => {
                    try {
                        fieldToObserve.forEach(field => {
                            if (e[field] !== undefined && e[field] !== null) {
                                result.observe(e[field], { "entity_gauge": entity.name, "key": e[key] });
                            }
                        });
                    } catch (observeError) {
                        logger.error('Error observing gauge value:', { 
                            entity: entity.name, 
                            key: e[key], 
                            error: observeError.message 
                        });
                    }
                });

                await tx.rollback();
            } catch (error) {
                logger.error('Error in gauge callback:', { entity: entity.name, error: error.message });
                if (tx) {
                    try {
                        await tx.rollback();
                    } catch (rollbackError) {
                        logger.error('Error rolling back transaction:', { error: rollbackError.message });
                    }
                }
            }
        };

        gaugeEntities.addCallback(callback);

        return { gaugeEntities, callback };
    } catch (error) {
        logger.error('Error creating observable gauge:', { entity: entity.name, error: error.message });
        throw error;
    }
}

module.exports = {
    increaseCounter,
    createObservableGauge
}
