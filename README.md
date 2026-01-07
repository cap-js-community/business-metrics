# Business-metrics

## About this project

**Business-metrics** is an extension library for **@cap-js/telemetry** designed for CAP (Cloud Application Programming) applications. It allows you to effortlessly track usage and performance by integrating Counter and Gauge metrics directly into your CAP service entities and actions. These metrics enable better observability and can be exported to telemetry tools for monitoring.

## Requirements and Setup

To use this library in your CAP project, ensure the following:

- Node.js (version >= 14)
- SAP CAP runtime (`@sap/cds`)
- A CAP-based Node.js project with service definitions
- Telemetry enabled in the CAP application configuration

### Installation

1. Add `business-metrics` to your dependencies via npm add `@cap-js-community/business-metrics` 

    ```bash
    npm add @cap-js-community/business-metrics
    ```

2. Enable business metrics in `package.json` under the `cds.requires.telemetry.metrics` section:

    ```json
    {
      "cds": {
        "requires": {
          "telemetry": {
            "metrics": {
              "enableBusinessMetrics": true
            }
          }
        }
      }
    }
    ```

---

## Features

- **Counter Metrics**: Track the number of times specific events (e.g., READ, DELETE) occur for entities or actions.
- **Gauge Metrics**: Monitor and observe specific fields of entities, such as stock levels or other numeric values.

### Counter Annotation

Use the `@Counter` annotation in your `services.cds` file to enable counter metrics for specific entities or actions.

```js
@(Counter: [
    {
        event     : '****',
        attributes: [
            ***
        ]
    }
])
```

Counter Metrics can be annotated for either service entities or actions in service.

Example for reference in both entity amd action scenario:
```js
    service CategoryService {
        @(Counter: [
            {
            event: 'READ',
            attributes: [
                user,
                tenant
            ]
            },
            {
            event: 'DELETE',
            attributes: [
                user,
                tenant
            ]
            }
        ])
        entity Books as projection on my.Books;

        @(Counter: {attributes: [
            user,
            tenant
        ]})
        action purchaseBook() returns String;
    }
```

- **Events**: Specify the events (e.g., READ, DELETE) for which the counter metrics should be triggered.  [See full list of available events in the CAP docs](https://cap.cloud.sap/docs/node.js/events#cds-event)
- **Attributes**: Define attributes (e.g., user, tenant) to include in the metrics. [See full list of available attributes in the CAP docs](https://cap.cloud.sap/docs/node.js/events#cds-event-context)

##### Example `counter metrics` outputs:

The counter metric name always follows the pattern `<service name>.<entity name>_<event>_total`. This pattern is fixed and cannot be changed or overridden.

```
[telemetry] - CategoryService.Books_READ_total: {
  attributes: { user: '', tenant: '' },
  startTime: [ 100000000, 400000000 ],
  endTime: [ 100000000, 600000000 ],
  value: 3
}
```

### Gauge Annotation

Use the `@Gauge` annotation in your `services.cds` file to enable gauge metrics for specific entities which is mentioned below:
```js
    @(Gauge: {
        key    : '****',
        observe: ['****']
    })
```
Example for reference in both entity amd action scenario:
```js
    service CategoryService {
        @(Gauge: {
            key: 'ID',
            observe: ['stock']
        })
        entity BookStock as
            projection on my.Books {
            ID,
            title,
            stock
            };
    }
```
##### Example `gauge metrics` outputs:

The guage metric name always follows the pattern `<service name>.<entity name>`. This pattern is fixed and cannot be changed or overridden.

```
[telemetry] - CategoryService.BookStock: {
  attributes: { entity_gauge: 'CategoryService.BookStock', key: 271 },
  startTime: [ 1755508380, 604000000 ],
  endTime: [ 1755508380, 604000000 ],
  value: 22
}
```
- **Key**: Specify the unique key for the entity.
- **Observe**: Define the fields to observe for gauge metrics.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js-community/<your-project>/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and <your-project> contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js-community/<your-project>).
