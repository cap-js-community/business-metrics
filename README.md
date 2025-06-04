# cap-js-community Repository Template

Default templates for cap-js-community open source repositories, including LICENSE, .reuse/dep5, Code of Conduct, etc... All repositories on github.com/cap-js-community will be created based on this template.

## To-Do

In case you are the maintainer of a new cap-js-community open source project, these are the steps to do with the template files:

- Check if the default license (Apache 2.0) also applies to your project. A license change should only be required in exceptional cases. If this is the case, please change the [license file](LICENSE).
- Enter the correct metadata for the REUSE tool. See our [wiki page](https://wiki.wdf.sap.corp/wiki/display/ospodocs/Using+the+Reuse+Tool+of+FSFE+for+Copyright+and+License+Information) for details how to do it. You can find an initial .reuse/dep5 file to build on. Please replace the parts inside the single angle quotation marks < > by the specific information for your repository and be sure to run the REUSE tool to validate that the metadata is correct.
- Adjust the contribution guidelines (e.g. add coding style guidelines, pull request checklists, different license if needed etc.)
- Add information about your project to this README (name, description, requirements etc). Especially take care for the <your-project> placeholders - those ones need to be replaced with your project name. See the sections below the horizontal line and [our guidelines on our wiki page](https://wiki.wdf.sap.corp/wiki/display/ospodocs/Guidelines+for+README.md+file) what is required and recommended.
- Remove all content in this README above and including the horizontal line ;)

***

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

- **Key**: Specify the unique key for the entity.
- **Observe**: Define the fields to observe for gauge metrics.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js-community/<your-project>/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright (20xx-)20xx SAP SE or an SAP affiliate company and <your-project> contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js-community/<your-project>).
