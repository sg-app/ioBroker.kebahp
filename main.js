"use strict";

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
const axios = require("axios");
// const https = require("https");

class Kebahp extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "kebahp",
		});

		this.apiClient = null;
		this.timer = null;

		this.on("ready", this.onReady.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		try {

			// The adapters config (in the instance object everything under the attribute "native") is accessible via
			// this.config:
			if (!this.config.ipAddress) {
				this.log.error(`Heatpump IP address is empty - please check configuration of ${this.namespace}`);
				return;
			}

			if (!this.config.ipAddress.match("^[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}")) {
				this.log.error(`IP address has wrong format - please check configuration of ${this.namespace}`);
				return;
			}

			this.log.debug("Adapter successful started.");
			this.apiClient = axios.create({
				baseURL: `http://${this.config.ipAddress}`,
				timeout: 1000,
				responseType: "json",
				responseEncoding: "utf8"
			});
			this.log.debug("axios instance successful created.");

			await this.loadData();
		}
		catch (err) {
			this.log.error(`Error during startup wiht message: ${err.message}`);
		}
	}

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

			this.timer = setTimeout(async () => {
				this.log.debug("Start next request.");
				this.timer = null;
				await this.loadData();
			}, this.config.refreshIntervall * 1000);
		}
		catch (err) {
			this.log.error(`Error during loading data: ${err.message}`);
		}
	}

	prepareBody() {
		return this.config.datapointsTable.map(f => ({ name: f.datapointName }));
	}

	/**
	 * Updates all states.
	 * @param {object} data JSON Data Array
	 */
	async updateAllStates(data) {
		// Zahlen und Boolen zum richtigen Typen konvertieren!
		try {
			this.log.debug("Start with Update all States.");
			for (let i = 0; i < data.length; i++) {
				const obj = data[i];
				for (const prop in obj) {
					if (Object.prototype.hasOwnProperty.call(obj, prop) && (!isNaN(obj[prop]) || obj[prop] === "false" || obj[prop] === "false")) {
						obj[prop] = JSON.parse(obj[prop]);
					}
				}
			}

			for (const obj of data) {
				const item = this.config.datapointsTable.find(f => f.datapointName == obj.name);
				if (item != undefined) {
					await this.writeDataToState(
						`${item.datapointGroup}.${item.datapointFriendlyName}`,
						item.datapointFriendlyName,
						item.datapointType,
						item.datapointUnit,
						obj.value);
				}
			}
		} catch (err) {
			this.log.error("Can't update states. " + err.message);
		}
	}
	isInt(n) {
		return Number(n) === n && n % 1 === 0;
	}
	/**
	 * @param {string | number | boolean} n
	 */
	isFloat(n) {
		return Number(n) === n && n % 1 !== 0;
	}
	/**
	 * @param {string} id
	 * @param {string} name
	 * @param {any} type
	 * @param {string | number | boolean} val
	 */
	async writeDataToState(id, name, type, unit, val) {
		await this.extendObjectAsync(id,
			{
				common: {
					name: name,
					role: "value",
					write: false,
					read: true,
					type: type,
					unit: unit
				},
				type: "state",
				native: {}
			});
		if (this.isFloat(val)) {
			await this.setStateAsync(id, Math.round(Number(val) * 100) / 100, true);
		}
		else{
			await this.setStateAsync(id, val, true);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.timer) {
				clearTimeout(this.timer);
				this.timer = null;
			}
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Kebahp(options);
} else {
	// otherwise start the instance directly
	new Kebahp();
}