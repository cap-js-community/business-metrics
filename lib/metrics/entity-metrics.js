const cds = require('@sap/cds')
const LOG = cds.log('telemetry')

const { metrics, ValueType } = require('@opentelemetry/api')

const METER = '@cap-js/telemetry:business-metrics';

//Store counters to avoid recreating it for the same entity-event
const counters = new Map();

function getOrCreateCounter(counterName, args) {
    if (counters.has(counterName)) {
        return counters.get(counterName);
    }
    const meter = metrics.getMeter(METER);
    let counter;
    counter = meter.createCounter(counterName, args);
    counters.set(counterName, counter);
    return counter;
}

function increaseCounter(counterName, args) {
    const counter = getOrCreateCounter(counterName);
    counter.add(1, args);
}

async function createObservableGauge(entity, fieldToObserve, key) {
    const meter = metrics.getMeter(METER);
    const gaugeEntities = meter.createObservableGauge(entity.name, {
        description: entity.description ? entity.description : 'No description available',
    });

    const callback = async (result) => {
        const tx = cds.transaction();
        const gaugeEntity = await tx.run(SELECT.from(entity));

        gaugeEntity.forEach(e => {
            fieldToObserve.forEach(field => {
                result.observe(e[field], { "entity_gauge": entity.name, "key": e[key] });
            });
        });

        await tx.rollback();
    };

    gaugeEntities.addCallback(callback);

    return { gaugeEntities, callback };
}

module.exports = {
    increaseCounter,
    createObservableGauge
}
