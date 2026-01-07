const proxyquire = require('proxyquire').noCallThru();
const { expect } = require('chai');
const sinon = require('sinon');

describe('cds-plugin.js', () => {
  let cds, logger, increaseCounterStub, createObservableGaugeStub, plugin;

  beforeEach(() => {
    increaseCounterStub = sinon.stub();
    createObservableGaugeStub = sinon.stub().resolves();
    logger = { error: sinon.stub(), debug: sinon.stub() };
    cds = {
      log: () => logger,
      once: sinon.stub(),
      services: [],
      requires: { telemetry: { metrics: { enableBusinessMetrics: true } } },
      cli: { command: 'serve' }
    };
    plugin = proxyquire('../cds-plugin.js', {
      '@sap/cds': cds,
      './lib/metrics/entity-metrics': {
        increaseCounter: increaseCounterStub,
        createObservableGauge: createObservableGaugeStub
      }
    });
  });

  it('should not start if NO_TELEMETRY is set', () => {
    process.env.NO_TELEMETRY = '1';
    cds.cli.command = 'serve';
    plugin;
    expect(cds.once.called).to.be.false;
    delete process.env.NO_TELEMETRY;
  });

  it('should not start if cli.command is not serve/run', () => {
    cds.cli.command = 'build';
    plugin;
    expect(cds.once.called).to.be.false;
  });

  it('should not start if enableBusinessMetrics is false', () => {
    cds.requires.telemetry.metrics.enableBusinessMetrics = false;
    cds.cli.command = 'serve';
    plugin;
    expect(cds.once.called).to.be.false;
  });
});
