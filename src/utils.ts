// Pure helper functions for the KeBa heat pump adapter.
// They are kept free of ioBroker dependencies so they can be unit tested without a running instance.

/**
 * Converts a value delivered as string by the heat pump into a number or boolean.
 *
 * Values which cannot be interpreted as a number or boolean are returned unchanged.
 *
 * @param value - Raw value delivered by the heat pump
 * @returns The converted value
 */
export function parseValue(value: unknown): unknown {
    if (typeof value === 'string') {
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        if (value.trim() !== '' && !isNaN(Number(value))) {
            return Number(value);
        }
    }
    return value;
}

/**
 * Rounds a number to two decimal places.
 *
 * @param value - Number to round
 * @returns The rounded number
 */
export function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Rounds float values to two decimal places, other values are returned unchanged.
 *
 * @param value - Value to normalize
 * @returns The normalized value
 */
export function normalizeValue(value: ioBroker.StateValue): ioBroker.StateValue {
    if (typeof value === 'number' && value % 1 !== 0) {
        return roundToTwoDecimals(value);
    }
    return value;
}
