// Pure helpers for validating and describing the datapoints of the KeBa heat pump.
// They are kept free of ioBroker runtime dependencies so they can be unit tested.

/**
 * A single datapoint as returned by the KeBa heat pump.
 */
export interface KebahpDatapoint {
    /** Full name of the datapoint, e.g. `APPL.CtrlAppl.sParam.param.operatingMode`. */
    name: string;
    /** Current value of the datapoint. */
    value: ioBroker.StateValue;
    /** Additional properties delivered by the heat pump. */
    [key: string]: unknown;
}

/** ioBroker state types which are supported by the adapter. */
const SUPPORTED_TYPES: readonly ioBroker.CommonType[] = ['number', 'boolean', 'string'];

/**
 * Checks whether a value is a valid datapoint delivered by the heat pump.
 *
 * @param value - Value to check
 * @returns `true` if the value is a valid datapoint
 */
export function isValidDatapoint(value: unknown): value is KebahpDatapoint {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as KebahpDatapoint).name === 'string' &&
        (value as KebahpDatapoint).name.length > 0
    );
}

/**
 * Validates the raw response of the heat pump and drops invalid entries.
 *
 * @param data - Raw response body
 * @returns All valid datapoints, or an empty array if the response is not an array
 */
export function parseDatapoints(data: unknown): KebahpDatapoint[] {
    if (!Array.isArray(data)) {
        return [];
    }
    return data.filter(isValidDatapoint);
}

/**
 * Checks whether a value is a supported ioBroker state type.
 *
 * @param type - Value to check
 * @returns `true` if the value is a supported state type
 */
export function isValidCommonType(type: unknown): type is ioBroker.CommonType {
    return typeof type === 'string' && (SUPPORTED_TYPES as readonly string[]).includes(type);
}

/**
 * Builds a comparable signature of the state properties the adapter manages.
 *
 * @param object - State object, either from the object tree or newly built
 * @returns A string which changes whenever a managed property changes
 */
export function buildStateSignature(object: Pick<ioBroker.StateObject, 'common'>): string {
    const common = object.common;
    return JSON.stringify([common.name, common.role, common.type, common.unit, common.read, common.write]);
}
