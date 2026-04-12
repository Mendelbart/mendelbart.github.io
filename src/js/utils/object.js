import {arraysEqual} from "./array.js";

/**
 * @template V
 * @template W
 * @param {Record<string, V>} obj
 * @param {function(V, string, number): W} callback
 * @returns {Record<string, W>}
 */
export function map(obj, callback) {
    return Object.fromEntries(
        Object.entries(obj).map(
            ([k, v], i) => [k, callback(v, k, i)]
        )
    );
}

/**
 * @template V
 * @param {Record<string,V>} obj
 * @param {function(V,string,number): boolean} fn
 * @returns {Record<string,V>}
 */
export function filter(obj, fn) {
    return Object.fromEntries(
        Object.entries(obj).filter(
            ([k, v], i) => fn(v, k, i)
        )
    );
}

/**
 * @template V
 * @param {Record<string, V>} obj
 * @param {function(V,string,number): boolean} fn
 * @returns {string[]}
 */
export function filterKeys(obj, fn) {
    return Object.entries(obj).filter(
        ([k, v], i) => fn(v, k, i)
    ).map(([k, _]) => k);
}

/**
 * @template T
 * @param {Record<string, T>} object
 * @param {string[]|string} keys
 * @returns {Record<string, T>}
 */
export function withoutKeys(object, keys) {
    if (typeof keys === "string") {
        keys = [keys];
    }

    const result = Object.assign({}, object);
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

/**
 * @template T
 * @param {Record<string, T>} object
 * @param {Iterable<string>} keys
 * @param {boolean} warnOtherKeys
 * @returns {Record<string, T>}
 */
export function onlyKeys(object, keys, warnOtherKeys = false) {
    const keySet = new Set(keys);
    const result = {};
    for (const [key, value] of Object.entries(object)) {
        if (keySet.has(key)) {
            result[key] = value;
        } else if (warnOtherKeys) {
            console.warn(`Filtered out key "${key}".`);
        }
    }

    return result;
}

/**
 * @template V
 * @param {Record<string, V>} object
 * @param {function(string): string} callback
 * @returns {Record<string, V>} Object with {callback(key): value} entries
 */
export function mapKeys(object, callback) {
    return Object.fromEntries(Object.entries(object).map(([k, v]) => [callback(k), v]));
}

/**
 * @template V
 * @param {string[]} keys
 * @param {function(string, number, string[]): V} callback
 * @returns {Record<string, V>} Object with {key: callback(key)} entries
 */
export function fromKeys(keys, callback) {
    return Object.fromEntries(keys.map((key, index, arr) => [key, callback(key, index, arr)]));
}

/**
 * @typedef {"none"|"all"|string[]|Record<string,boolean>} SubsetSpecifier
 */

/**
 * Convenience method for standardising a subset of keys. Useful for `checked` or `disabled` inputs.
 * Returns all keys for `value=true`, an empty array for `value=false`. Otherwise return the given subset.
 * @param {SubsetSpecifier} subset
 * @param {string[]} keys
 * @returns {Record<string,boolean>}
 */
export function subsetToBoolRecord(subset, keys) {
    if (subset === "none") {
        subset = []
    } else if (subset === "all") {
        subset = keys;
    } else if (typeof subset === "string") {
        throw new Error('Invalid subset string specifier - use "none" or "all".');
    }

    if (Array.isArray(subset)) {
        const result = Object.fromEntries(keys.map(key => [key, false]));
        for (const key of subset) {
            result[key] = true;
        }
        return result;
    }

    if (!arraysEqual(Object.keys(subset).sort(), keys.sort())) {
        console.log(subset, keys);
        console.warn("Subset object keys don't match keys list.");
        console.log(Object.keys(subset).sort(), keys.sort());
    }
    return Object.fromEntries(keys.map(key => [key, !!subset[key]]));
}
