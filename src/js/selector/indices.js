import {range, filterIndices} from "../helpers/array";


/**
 * @param {(string | number[])[]} subsets
 * @param {number} n
 * @param {function(string): number} [parseIndex]
 * @returns {number[][]}
 */
export function processIndexSubsets(subsets, n, parseIndex) {
    const result = [];
    const covered = new Array(n).fill(false);

    for (const [i, subset] of subsets.entries()) {
        if (subset === "rest") {
            if (i !== subsets.length - 1) console.error("Can only have subset 'rest' at the end.");

            result.push(filterIndices(covered, x => !x));
            break;
        }
        const indices = [];

        for (const index of processIndices(subset, parseIndex)) {
            indices.push(index);

            if (index == null) continue;
            if (covered[index]) throw new Error(`Duplicate subset index ${index}.`);

            covered[index] = true;
        }
        result.push(indices);
    }

    const uncovered = filterIndices(subsets, x => !x);
    if (uncovered.length !== 0) {
        throw new Error(`Not all indices were covered: missing ${uncovered}.`);
    }

    return result;
}


/**
 * @param {number | number[] | string} indices
 * @param {function(string): number} [parseIndex]
 * @returns {number[]}
 */
export function processIndices(indices, parseIndex) {
    if (typeof indices === "string") {
        return parseRanges(indices, parseIndex);
    }

    if (Number.isInteger(indices)) {
        return [indices];
    }

    if (!Array.isArray(indices) || indices.some(x => !Number.isInteger(x))) {
        throw new Error("Invalid indices datatype: need string, number or number[].")
    }

    if (containsDuplicates(indices)) {
        console.warn("Indices contain duplicates.");
    }

    return indices;
}

function containsDuplicates(a) {
    return new Set(a).size !== a.length;
}

/**
 * @param {string} str
 * @param {function(string): number} [parseIndex]
 * @returns {number[]}
 */
export function parseRanges(str, parseIndex) {
    return [].concat(...str.split(/,\s*/g).map(range => parseRange(range, parseIndex)));
}

/**
 * Julia-like range syntax: `start:stop` or `start:step:stop` (inclusive).
 * Optionally specify a function `parseIndex(string) => number` to parse the `start` and `stop`. Default is `parseInt`,
 * which is always used for `step`.
 *
 * @param {string} str
 * @param {function(string): number} [parseIndex] - opt. Function to split
 * @returns {number[]}
 *
 * @example
 * parseRange("2")
 * // -> [2]
 * parseRange("1:5")
 * // -> [1, 2, 3, 4, 5]
 * parseRange("6:2:-2")
 * // -> [6, 4, 2]
 * parseRange("a:z", c => c.charCodeAt(0))
 * // -> [97, 98, ..., 121, 122]
 */
export function parseRange(str, parseIndex = parseInt) {
    const numStrs = str.split(":");
    const nArgs = numStrs.length;
    if (nArgs.length === 0 || nArgs.length > 3) {
        throw new Error("Invalid range, 2-3 numbers.");
    }

    const vals = numStrs.map((x, i) => {
        const index = nArgs === 3 && i === 1 ? parseInt(x) : parseIndex(x);
        if (!Number.isInteger(index)) {
            throw new Error(`Parsed non-integer index ${index}.`);
        }
        return index;
    });

    if (nArgs === 1) return vals;

    return range(
        vals[0],
        vals[nArgs - 1] + 1,
        nArgs === 3 ? vals[1] : 1
    );
}

/**
 * @param {number[][]} subsets
 * @param {number} n
 * @returns {[number, number][]}
 *
 * @example
 * const [s, j] = invertSubsets(subsets)[i]
 * // => subsets[s][j] == i
 */
export function invertSubsets(subsets, n) {
    const ind = new Array(n);
    for (const [s, subset] of subsets.entries()) {
        for (const [j, i] of subset.entries()) {
            ind[i] = [s, j];
        }
    }

    return ind;
}


/**
 * @param {string} ranges
 * @param {function(string): number} [parseIndex]
 */
export function parseMatrixRanges(ranges, parseIndex) {
    if (!ranges || ranges.length === 0) {
        return [];
    }
    return [].concat(...ranges.split(/;\s*/g).map(range => parseMatrixRange(range, parseIndex)));
}

/**
 * Format: ({ROWS-RANGE}|{COLUMNS-RANGE})
 * @param {string} range
 * @param {function(string): number} [parseIndex]
 */
function parseMatrixRange(range, parseIndex) {
    if (range.charAt(0) !== '(' || range.charAt(range.length - 1) !== ')') {
        throw new Error(`Invalid matrix range syntax: Need enclosing parentheses.`);
    }

    const ranges = range.substring(1, range.length - 1).split('|');
    if (ranges.length !== 2) throw new Error("Invalid matrix range syntax: Need (ROWS|COLUMNS)");

    return matrixIndices(...ranges.map(range => parseRanges(range, parseIndex)));
}

export function matrixIndices(rows, columns) {
    const keys = [];
    for (const row of rows) {
        for (const col of columns) {
            keys.push([row, col]);
        }
    }

    return keys;
}