"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
var import_node_net = require("node:net");
var import_utils = require("./utils");
const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1e3;
const WRITE_BATCH_SIZE = 50;
class Kebahp extends utils.Adapter {
  /** REST client for the KeBa heat pump. */
  apiClient = null;
  /** Timer of the next scheduled update. */
  timer = null;
  /** Whether the adapter is shutting down. */
  unloaded = false;
  /** Signature of the state object which is currently stored for a state id. */
  stateSignatures = /* @__PURE__ */ new Map();
  /** Last written value per state id, used to skip unchanged values. */
  valueCache = /* @__PURE__ */ new Map();
  /** Timestamp of the last full write cycle. */
  lastFullWrite = 0;
  /**
   * @param options - Adapter options provided by ioBroker
   */
  constructor(options = {}) {
    super({
      ...options,
      name: "kebahp"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    try {
      if (!this.config.ipAddress) {
        this.log.error(`Heatpump IP address is empty - please check configuration of ${this.namespace}`);
        return;
      }
      if (!(0, import_node_net.isIPv4)(this.config.ipAddress)) {
        this.log.error(`IP address has wrong format - please check configuration of ${this.namespace}`);
        return;
      }
      this.log.debug("Adapter successful started.");
      this.apiClient = import_axios.default.create({
        baseURL: `http://${this.config.ipAddress}`,
        timeout: 5e3,
        responseType: "json",
        responseEncoding: "utf8"
      });
      this.log.debug("axios instance successful created.");
      await this.loadExistingObjects();
      await this.loadData();
    } catch (error) {
      this.log.error(`Error during startup with message: ${this.getErrorMessage(error)}`);
    }
  }
  /**
   * Loads the configured datapoints from the heat pump and schedules the next run.
   */
  async loadData() {
    try {
      this.log.debug("Load data from heatpump.");
      if (!this.apiClient) {
        this.log.error("Apiclient not instanced.");
        return;
      }
      const body = this.prepareBody();
      this.log.debug(`Parameters for request: ${JSON.stringify(body)}`);
      const response = await this.apiClient.post("/var/readWriteVars?languageCode=de", JSON.stringify(body));
      this.log.debug(`response ${response.status}: ${JSON.stringify(response.data)}`);
      if (response.status === 200) {
        await this.updateAllStates(response.data);
      }
    } catch (error) {
      this.log.error(`Error during loading data: ${this.getErrorMessage(error)}`);
    } finally {
      if (!this.unloaded && !this.timer) {
        this.timer = this.setTimeout(async () => {
          this.log.debug("Start next request.");
          this.timer = null;
          await this.loadData();
        }, this.config.refreshIntervall * 1e3);
      }
    }
  }
  /**
   * Builds the request body from the configured datapoints.
   *
   * @returns The list of datapoint names to request
   */
  prepareBody() {
    return this.config.datapointsTable.map((f) => ({ name: f.datapointName }));
  }
  /**
   * Loads all existing objects of this adapter once at startup.
   *
   * This avoids per state `getObject` calls and allows the adapter to detect
   * which objects are already present and which definition changed.
   */
  async loadExistingObjects() {
    const objects = await this.getAdapterObjectsAsync();
    const prefix = `${this.namespace}.`;
    for (const [id, object] of Object.entries(objects)) {
      const localId = id.startsWith(prefix) ? id.slice(prefix.length) : id;
      if (object.type === "state") {
        this.stateSignatures.set(localId, this.stateSignature(object));
      }
    }
    this.log.debug(`[loadExistingObjects] Found ${this.stateSignatures.size} states.`);
  }
  /**
   * Builds a comparable signature of the state properties the adapter manages.
   *
   * @param object - State object, either from the object tree or newly built
   * @returns A string which changes whenever a managed property changes
   */
  stateSignature(object) {
    const common = object.common;
    return JSON.stringify([common.name, common.role, common.type, common.unit, common.read, common.write]);
  }
  /**
   * Updates all states.
   *
   * @param data - JSON data array returned by the heat pump
   */
  async updateAllStates(data) {
    try {
      this.log.debug("Start with Update all States.");
      if (Date.now() - this.lastFullWrite >= HEARTBEAT_INTERVAL_MS) {
        this.valueCache.clear();
        this.lastFullWrite = Date.now();
      }
      for (const obj of data) {
        for (const prop of Object.keys(obj)) {
          obj[prop] = (0, import_utils.parseValue)(obj[prop]);
        }
      }
      const pending = [];
      for (const obj of data) {
        const item = this.config.datapointsTable.find((f) => f.datapointName === obj.name);
        if (item) {
          const id = `${item.datapointGroup}.${item.datapointFriendlyName}`;
          await this.createStateObject(
            id,
            item.datapointFriendlyName,
            item.datapointType,
            item.datapointUnit
          );
          const value = this.normalizeValue(obj.value);
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
  async createStateObject(id, name, type, unit) {
    const stateObject = {
      common: { name, role: "value", write: false, read: true, type, unit },
      type: "state",
      native: {}
    };
    const signature = this.stateSignature(stateObject);
    if (this.stateSignatures.get(id) === signature) {
      return;
    }
    await this.extendObject(id, stateObject);
    this.stateSignatures.set(id, signature);
  }
  /**
   * Rounds float values to two decimal places.
   *
   * @param val - Value to normalize
   * @returns The normalized value
   */
  normalizeValue(val) {
    if (typeof val === "number" && val % 1 !== 0) {
      return (0, import_utils.roundToTwoDecimals)(val);
    }
    return val;
  }
  /**
   * Checks whether a value changed since the last write.
   *
   * @param id - Id of the state
   * @param value - Value to check
   * @returns `true` if the value should be written
   */
  shouldWrite(id, value) {
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
  async writeStates(pending) {
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
  getErrorMessage(error) {
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
  onUnload(callback) {
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
  module.exports = (options) => new Kebahp(options);
} else {
  (() => new Kebahp())();
}
//# sourceMappingURL=main.js.map
