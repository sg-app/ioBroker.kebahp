// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import axios, { type AxiosInstance } from 'axios';
import { Agent } from 'node:http';
import { isIPv4 } from 'node:net';
import { buildStateSignature, isValidCommonType, parseDatapoints, type KebahpDatapoint } from './datapoints';
import { normalizeValue, parseValue } from './utils';

/** States which did not change are rewritten at least once within this interval. */
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000;
/** Number of state writes which are dispatched in parallel. */
const WRITE_BATCH_SIZE = 50;
/** Minimum allowed refresh interval in seconds. */
const MIN_REFRESH_INTERVAL = 120;
/** Maximum allowed refresh interval in seconds. */
const MAX_REFRESH_INTERVAL = 3600;

class Kebahp extends utils.Adapter {
    /** REST client for the KeBa heat pump. */
    private apiClient: AxiosInstance | null = null;
    /** Timer of the next scheduled update. */
    private timer: ioBroker.Timeout | null | undefined = null;
    /** Whether the adapter is shutting down. */
    private unloaded = false;
    /** Signature of the state object which is currently stored for a state id. */
    private readonly stateSignatures: Map<string, string> = new Map<string, string>();
    /** Last written value per state id, used to skip unchanged values. */
    private readonly valueCache: Map<string, ioBroker.StateValue> = new Map<string, ioBroker.StateValue>();
    /** Timestamp of the last full write cycle. */
    private lastFullWrite = 0;
    /** Last known connection state, `null` while unknown. */
    private connectionState: boolean | null = null;

    /**
     * @param options - Adapter options provided by ioBroker
     */
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'kebahp',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        try {
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            if (!this.config.ipAddress) {
                this.log.error(`Heatpump IP address is empty - please check configuration of ${this.namespace}`);
                return;
            }

            if (!isIPv4(this.config.ipAddress)) {
                this.log.error(`IP address has wrong format - please check configuration of ${this.namespace}`);
                return;
            }

            if (
                !Number.isFinite(this.config.refreshIntervall) ||
                this.config.refreshIntervall < MIN_REFRESH_INTERVAL ||
                this.config.refreshIntervall > MAX_REFRESH_INTERVAL
            ) {
                this.log.error(
                    `Refresh interval only allows a range from ${MIN_REFRESH_INTERVAL}s to ${MAX_REFRESH_INTERVAL}s - please check configuration of ${this.namespace}`,
                );
                return;
            }

            this.log.debug('Adapter successful started.');
            this.apiClient = axios.create({
                baseURL: `http://${this.config.ipAddress}`,
                timeout: 5000,
                responseType: 'json',
                responseEncoding: 'utf8',
                httpAgent: new Agent({ keepAlive: true }),
            });
            this.log.debug('axios instance successful created.');

            await this.setObjectNotExistsAsync('info.connection', {
                type: 'state',
                common: {
                    name: 'Connection',
                    type: 'boolean',
                    role: 'indicator.connected',
                    read: true,
                    write: false,
                    def: false,
                },
                native: {},
            });

            await this.loadExistingObjects();
            await this.loadData();
        } catch (error) {
            this.log.error(`Error during startup with message: ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Loads the configured datapoints from the heat pump and schedules the next run.
     */
    private async loadData(): Promise<void> {
        try {
            this.log.debug('Load data from heatpump.');
            if (!this.apiClient) {
                this.log.error('Apiclient not instanced.');
                return;
            }
            const body = this.prepareBody();
            this.log.debug(`Parameters for request: ${JSON.stringify(body)}`);

            const response = await this.apiClient.post('/var/readWriteVars?languageCode=de', JSON.stringify(body));

            this.log.debug(`response ${response.status}: ${JSON.stringify(response.data)}`);

            if (response.status === 200) {
                const datapoints = parseDatapoints(response.data);
                await this.updateAllStates(datapoints);
                if (this.connectionState !== true) {
                    this.log.info('Connected to the heat pump.');
                }
                await this.setConnected(true);
            }
        } catch (error) {
            const message = this.getErrorMessage(error);
            if (this.connectionState !== false) {
                this.log.error(`Error during loading data: ${message}`);
            } else {
                this.log.debug(`Error during loading data: ${message}`);
            }
            await this.setConnected(false);
        } finally {
            // Restart request load Data!
            if (!this.unloaded && !this.timer) {
                this.timer = this.setTimeout(async () => {
                    this.log.debug('Start next request.');
                    this.timer = null;
                    await this.loadData();
                }, this.config.refreshIntervall * 1000);
            }
        }
    }

    /**
     * Builds the request body from the configured datapoints.
     *
     * @returns The list of datapoint names to request
     */
    private prepareBody(): { name: string }[] {
        return this.config.datapointsTable.map(f => ({ name: f.datapointName }));
    }

    /**
     * Loads all existing objects of this adapter once at startup.
     *
     * This avoids per state `getObject` calls and allows the adapter to detect
     * which objects are already present and which definition changed.
     */
    private async loadExistingObjects(): Promise<void> {
        const objects = await this.getAdapterObjectsAsync();
        const prefix = `${this.namespace}.`;

        for (const [id, object] of Object.entries(objects)) {
            const localId = id.startsWith(prefix) ? id.slice(prefix.length) : id;
            if (object.type === 'state') {
                this.stateSignatures.set(localId, buildStateSignature(object));
            }
        }

        this.log.debug(`[loadExistingObjects] Found ${this.stateSignatures.size} states.`);
    }

    /**
     * Updates all states.
     *
     * @param data - JSON data array returned by the heat pump
     */
    private async updateAllStates(data: KebahpDatapoint[]): Promise<void> {
        // Convert numbers and booleans to the correct types!
        try {
            this.log.debug('Start with Update all States.');

            // Refresh unchanged values at least once within the heartbeat interval.
            if (Date.now() - this.lastFullWrite >= HEARTBEAT_INTERVAL_MS) {
                this.valueCache.clear();
                this.lastFullWrite = Date.now();
            }

            for (const obj of data) {
                for (const prop of Object.keys(obj)) {
                    obj[prop] = parseValue(obj[prop]);
                }
            }

            const pending: { id: string; val: ioBroker.StateValue }[] = [];
            for (const obj of data) {
                const item = this.config.datapointsTable.find(f => f.datapointName === obj.name);
                if (item) {
                    const id = `${item.datapointGroup}.${item.datapointFriendlyName}`;
                    const type = isValidCommonType(item.datapointType) ? item.datapointType : 'string';
                    await this.createStateObject(id, item.datapointFriendlyName, type, item.datapointUnit);
                    const value = normalizeValue(obj.value);
                    if (this.shouldWrite(id, value)) {
                        pending.push({ id, val: value });
                    }
                }
            }

            await this.writeStates(pending);
        } catch (error) {
            this.log.error(`Can't update states. ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Creates or updates the state object when its definition changed.
     *
     * @param id - Id of the state
     * @param name - Human readable name of the state
     * @param type - ioBroker type of the state
     * @param unit - Unit of the state
     */
    private async createStateObject(id: string, name: string, type: ioBroker.CommonType, unit: string): Promise<void> {
        const stateObject: Pick<ioBroker.StateObject, 'type' | 'common' | 'native'> = {
            common: { name, role: 'value', write: false, read: true, type, unit },
            type: 'state',
            native: {},
        };
        const signature = buildStateSignature(stateObject);
        if (this.stateSignatures.get(id) === signature) {
            return;
        }

        await this.extendObject(id, stateObject);
        this.stateSignatures.set(id, signature);
    }

    /**
     * Updates the connection indicator state.
     *
     * @param connected - Whether the heat pump is reachable
     */
    private async setConnected(connected: boolean): Promise<void> {
        if (this.connectionState === connected) {
            return;
        }
        this.connectionState = connected;
        await this.setState('info.connection', { val: connected, ack: true });
    }

    /**
     * Checks whether a value changed since the last write.
     *
     * @param id - Id of the state
     * @param value - Value to check
     * @returns `true` if the value should be written
     */
    private shouldWrite(id: string, value: ioBroker.StateValue): boolean {
        if (this.valueCache.get(id) === value) {
            return false;
        }
        this.valueCache.set(id, value);
        return true;
    }

    /**
     * Writes the pending state values in parallel batches.
     *
     * @param pending - State values to write
     */
    private async writeStates(pending: { id: string; val: ioBroker.StateValue }[]): Promise<void> {
        for (let index = 0; index < pending.length; index += WRITE_BATCH_SIZE) {
            const batch = pending.slice(index, index + WRITE_BATCH_SIZE);
            await Promise.all(batch.map(({ id, val }) => this.setState(id, { val, ack: true })));
        }
    }

    /**
     * Resolves the message of an unknown error.
     *
     * @param error - Caught error
     * @returns The error message
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback - Callback function
     */
    private onUnload(callback: () => void): void {
        try {
            this.unloaded = true;
            if (this.timer) {
                this.clearTimeout(this.timer);
                this.timer = null;
            }
            callback();
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined): Kebahp => new Kebahp(options);
} else {
    // otherwise start the instance directly
    (() => new Kebahp())();
}
