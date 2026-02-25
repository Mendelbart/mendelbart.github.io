import {range, filterIndices} from "../helpers/array";


export function transposeIndices(indices, n, m) {
    if (indices.length !== n * m) {
        throw new Error("Dimensions don't match.");
    }
    return transposedRange(n, m).map(i => indices[i]);
}

export function transposedRange(n, m) {
    const result = new Array(n*m);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            result[i * m + j] = j * n + i;
        }
    }
    return result;
}

/**
 * @param {(string | number[])[]} subsets
 * @param {number} n
 * @returns {number[][]}
 */
export function processIndexSubsets(subsets, n) {
    const result = [];
    const covered = new Array(n).fill(false);

    for (const [i, subset] of subsets.entries()) {
        if (subset === "rest") {
            if (i !== subsets.length - 1) {
                console.error("Can only have subset 'rest' at the end.");
            }
            result.push(filterIndices(covered, x => !x));
            break;
        }
        const indices = [];

        for (const index of processIndices(subset)) {
            indices.push(index);

            if (index === null) {
                continue;
            }
            if (covered[index]) {
                throw new Error(`Duplicate subset index ${index}.`);
            }
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
 * @returns {(number|null)[]}
 */
export function processIndices(indices) {
    if (typeof indices === "string") {
        return parseRanges(indices);
    }

    if (typeof indices === "number") {
        return [indices];
    }

    if (!Array.isArray(indices)) {
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
 * @returns {(number|null)[]}
 */
export function parseRanges(str) {
    return [].concat(...str.split(",").map(parseRange));
}

/**
 * @param {string} str
 * @returns {number[]}
 */
export function parseRange(str) {
    const vals = str.split(":").map(parseIntThrowNaN);
    if (vals.length === 1) {
        return vals;
    }

    if (vals.length === 0 || vals.length > 3) {
        throw new Error("Invalid range, 2-3 numbers.");
    }

    const start = vals[0];
    const stop = vals[vals.length - 1];
    const step = vals.length === 3 ? vals[1] : 1;

    if (stop < start || step < 1) {
        throw new Error("Invalid range, must have start <= stop and step >= 1.");
    }

    return range(start, stop + 1, step);
}

/**
 * Parse int, throws Error if the value is NaN.
 * @param {string} str
 * @returns {number}
 */
export function parseIntThrowNaN(str) {
    const result = parseInt(str);
    if (isNaN(result)) {
        throw new Error("Not a number.");
    }
    return result;
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
