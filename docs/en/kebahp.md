# KeBa heat pump Adapter documentation

## General information

This adapter reads data from a KeBa heat pump over the local network and mirrors the values into ioBroker states. The heat pump exposes its values through a JSON interface (`/var/readWriteVars`), which the adapter polls in a configurable interval.

The adapter is a polling adapter (`dataSource: poll`), runs as a daemon and supports compact mode.

## Administration

### Configuration

| Setting              | Description                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| **IP address**       | IPv4 address of the heat pump in the local network (e.g. `192.168.1.50`). Validated as IPv4.         |
| **Refresh interval** | Polling interval in seconds. Allowed range: `120` - `3600` s (default `300` s).                       |
| **Datapoints**       | Table of datapoints to read. Each row defines a friendly name, the datapoint name, group, type and unit. |

### States

States are generated automatically when the adapter starts. The object tree mirrors the configured group and friendly name as `<group>.<friendlyName>`, for example `kebahp.0.Temperatures.Outdoor_Temp`.

The connection state is available as `kebahp.0.info.connection` (`true` = heat pump reachable).

A list of known datapoint names can be found in [Datapoints](../datapoints.md).

## Troubleshooting

- **No states are created / connection stays `false`**: check the IP address and that the heat pump is reachable in the local network.
- **Wrong values**: verify the configured `type` of the datapoint (number, boolean, string).
- **Missing datapoints**: add the datapoint name to the table in the adapter settings.
