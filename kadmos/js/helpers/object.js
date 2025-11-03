import {arraysEqual} from "./array.js";

/**
 * @template V,W
 * @param {Object<string,V>} obj
 * @param {function(V,string,number): W} fn
 * @returns {Object<string,W>}
 */
export function map(obj, fn) {
    return Object.fromEntries(
        Object.entries(obj).map(
            ([k, v], i) => [k, fn(v, k, i)]
        )
    );
}

/**
 * @template V
 * @param {Object<string,V>} obj
 * @param {function(V,string,number): boolean} fn
 * @returns {Object<string,V>}
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
 * @param {Object<string,V>} obj
 * @param {function(V,string,number): boolean} fn
 * @returns {string[]}
 */
export function filterKeys(obj, fn) {
    return Object.entries(obj).filter(
        ([k, v], i) => fn(v, k, i)
    ).map(([k, _]) => k);
}

/**
 * @param {Object} object
 * @param {Array} keys
 * @returns {Object}
 */
export function withoutKeys(object, keys) {
    const result = Object.assign({}, object);
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

/**
 * @param {Object} object
 * @param {Array} keys
 * @param {boolean} [appendObject]
 * @returns {Array}
 */
export function extractKeys(object, keys, appendObject = true) {
    const arr = keys.map((key) => object[key] ?? null);
    if (appendObject)
        arr.push(withoutKeys(object, keys));
    return arr;
}

/**
 * @param {Object} object
 * @param {Iterable} keys
 * @param {boolean} warnOtherKeys
 * @returns {Object}
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

export function mapKeys(object, callback) {
    return Object.fromEntries(Object.entries(object).map(([k, v]) => [callback(k), v]));
}

export function mapKeyArrayToValues(keys, callback) {
    return Object.fromEntries(keys.map(key => [key, callback(key)]));
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
    }
    return Object.fromEntries(keys.map(key => [key, !!subset[key]]));
}
