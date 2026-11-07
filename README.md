![Logo](admin/kebahp.png)
# ioBroker.kebahp

[![NPM version](https://img.shields.io/npm/v/iobroker.kebahp.svg)](https://www.npmjs.com/package/iobroker.kebahp)
[![Downloads](https://img.shields.io/npm/dm/iobroker.kebahp.svg)](https://www.npmjs.com/package/iobroker.kebahp)
![Number of Installations](https://iobroker.live/badges/kebahp-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/kebahp-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.kebahp.png?downloads=true)](https://nodei.co/npm/iobroker.kebahp/)

**Tests:** ![Test and Release](https://github.com/sg-app/ioBroker.kebahp/workflows/Test%20and%20Release/badge.svg)

## kebahp adapter for ioBroker

This adapter reads data from a **KeBa heat pump** over the local network and mirrors the values into ioBroker states. The heat pump exposes its values through a JSON interface (`/var/readWriteVars`), which the adapter polls in a configurable interval.

The adapter is a polling adapter (`dataSource: poll`), runs as a daemon and supports compact mode.

Features:

- reads a configurable list of datapoints from the heat pump
- creates the ioBroker object tree (channels and states) automatically on the first start
- converts numeric and boolean values delivered as strings into the correct ioBroker types
- rounds float values to two decimal places
- low load on heat pump and ioBroker: unchanged values are not rewritten (only a periodic heartbeat), and updates are written in parallel batches
- robust against broken responses: invalid entries are dropped instead of creating nonsense states
- reports the connection state through `info.connection`

## How it works

1. On start the adapter validates the configuration (IPv4 address and refresh interval).
2. It requests the configured datapoints from the heat pump.
3. For every datapoint a **state** object is created below the configured group. Objects are only extended/updated when the managed definition (name, role, type, unit, read, write) changed.
4. Values are written with `ack: true`. A value is only written when it actually changed; unchanged values are still refreshed at least every 10 minutes (heartbeat) so that timestamps do not become stale.
5. The next run is scheduled using the configured refresh interval.

## Configuration

To establish a connection, the IP address of the KeBa heat pump is required. The refresh interval and the list of datapoints can also be adjusted.

| Setting              | Description                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **IP address**       | IPv4 address of the heat pump in the local network (e.g. `192.168.1.50`). Validated as IPv4.         |
| **Refresh interval** | Polling interval in seconds. Allowed range: `120` - `3600` s (default `300` s).                       |
| **Datapoints**       | Table of datapoints to read. Each row defines a friendly name, the datapoint name, group, type and unit. |

## States

States are generated automatically when the adapter starts. The object tree mirrors the configured group and friendly name as `<group>.<friendlyName>`, for example `kebahp.0.Temperatures.Outdoor_Temp` (the instance number may differ).

The connection state is available as `kebahp.0.info.connection` (`true` = heat pump reachable).

A list of known datapoint names can be found in [Datapoints](./docs/datapoints.md).

## Troubleshooting

- **No states are created / connection stays `false`**: check the IP address and that the heat pump is reachable in the local network. The adapter logs the first error as `error` and repeated errors as `debug` to avoid flooding the log.
- **Wrong values**: verify the configured `type` of the datapoint (number, boolean, string).
- **Missing datapoints**: add the datapoint name to the table in the adapter settings.

## Development

The adapter is written in TypeScript. The compiled output is generated into `build/`, which is the directory shipped with the npm package.

Source layout:

- `src/main.ts` - adapter lifecycle, polling loop and state updates
- `src/datapoints.ts` - datapoint validation and state signature helpers
- `src/utils.ts` - value conversion and rounding helpers

Useful npm scripts:

- `npm run build` compiles the sources
- `npm run watch` recompiles on every change
- `npm run check` runs the strict type check (`tsc --noEmit`)
- `npm run lint` runs ESLint
- `npm run test` runs the unit tests (`test:ts`) and the ioBroker package tests (`test:package`)
- `npm run test:integration` runs the integration tests

For live validation use the [@iobroker/dev-server](https://github.com/ioBroker/dev-server) instead of a productive instance: run `setup` once, then `watch` or `debug` to verify runtime behavior, reconnects, object updates and the Admin UI.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 1.0.0 (2026-11-07)
* (sg-app) migrate the adapter sources to TypeScript, compiled output is generated into `build/`
* (sg-app) update dependencies, Node.js and js-controller/admin requirements
* (sg-app) validate the configured IP address strictly as IPv4 and the refresh interval as 120-3600 s
* (sg-app) validate the heat pump response and drop invalid entries instead of creating nonsense states
* (sg-app) only write states when the value changed, with a heartbeat to refresh the timestamps
* (sg-app) write state updates in parallel batches to lower the CPU load
* (sg-app) cache the existing objects at startup and only extend objects when the definition changed
* (sg-app) add the `info.connection` state and reduce log spam on repeated connection errors
* (sg-app) reuse the HTTP connection with keep-alive
* (sg-app) use the adapter timers so the adapter works in compact mode
* (sg-app) add unit tests for the datapoint and value helpers
* (sg-app) extend the README with a detailed adapter description, configuration, state overview and troubleshooting

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2024-2026 sg-app <info@sg-app.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.