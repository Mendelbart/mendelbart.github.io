import {range, filterIndices} from "./array";

/**
 * @param {(number[] | null)[]} subsets
 * @param {number} n
 * @returns {number[][]}
 */
export function completeIndexSubsets(subsets, n) {
    const covered = new Array(n).fill(false);
    let emptyIndex;

    for (const [index, subset] of subsets.entries()) {
        if (subset) {
            for (const i of subset) {
                if (covered[i]) console.warn(`Index ${i} covered multiple times.`)
                covered[i] = true;
            }
        } else {
            if (emptyIndex != null) {
                console.warn("Multiple empty subsets.");
            } else {
                emptyIndex = index;
            }
        }
    }

    const uncovered = filterIndices(covered, x => !x);
    if (emptyIndex != null) {
        subsets[emptyIndex] = uncovered;
    } else if (uncovered.length > 0) {
        console.warn("Subsets have uncovered indices.");
        console.log("Uncovered:", uncovered);
    }

    return subsets;
}

/**
 * @param {number[][]} subsets
 * @param {number} n
 * @returns {boolean}
 */
export function verifyIndexSubsets(subsets, n) {
    const covered = new Array(n).fill(false);

    for (const subset of subsets) {
        for (const i of subset) {
            if (covered[i]) return false;
            covered[i] = true;
        }
    }

    return covered.every(x => x);
}

/**
 * @param {any[]} a
 * @returns {boolean}
 */
export function containsDuplicates(a) {
    return new Set(a).size !== a.length;
}

/**
 * @param {string} str
 * @param {function(string): number} [parseIndex]
 * @returns {number[]}
 */
export function parseRanges(str, parseIndex) {
    if (typeof str !== "string") str = str.toString();
    return [].concat(...str.split(",").map(range => parseRange(range.trim(), parseIndex)));
}

/**
 * Julia-like range syntax: `start:stop` or `start:step:stop` (inclusive).
 * Optionally specify a function `parseIndex(string) => number` to parse the `start` and `stop`. Default is `parseInt`,
 * which is always used for `step`.
 *
 * @param {string} str
 * @param {function(string): number} [parseIndex] - opt. function to parse an index
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
    if (!ranges) return [];

    return [].concat(...ranges.split(";").map(range => parseMatrixRange(range.trim(), parseIndex)));
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
