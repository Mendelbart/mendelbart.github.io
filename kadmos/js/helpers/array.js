/**
 * Returns array `sums` of cumulative sums: `sums[index] = arr[0] + ... + arr[index]`.
 * @param {number[]} arr
 * @returns number[]
 */
export function cumSums(arr) {
    return arr.map((sum => value => sum += value)(0));
}

/**
 * Return the smallest `index` such that `val <= arr[index]`
 * @param {number} val
 * @param {number[]} arr
 * @returns number
 */
export function bisectLeft(val, arr) {
    let lo = 0;
    let hi = arr.length;
    let mid;

    while (lo < hi) {
        mid = (lo + hi) >> 1;
        if (arr[mid] < val) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }

    return lo;
}

/**
 * Return the sum of the array values.
 * @param {number[]} arr
 * @returns {number}
 */
export function sum(arr) {
    return arr.reduce((sum, cur) => sum + cur, 0);
}

/**
 * Return the average of the array values.
 * @param {number[]} arr
 * @returns {number}
 */
export function avg(arr) {
    if (arr.length === 0) {
        console.error("Cannot compute average of empty array.");
        return 0;
    }
    return sum(arr) / arr.length;
}


/**
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
export function arraysEqual(a, b) {
    return a.length === b.length &&
        a.every((element, index) => element === b[index]);
}

/**
 * @template T
 * @param {Array<T>} arr
 * @param {function(T, number, Array<T>)} callback
 * @returns {number[]}
 */
export function filterIndices(arr, callback) {
    return Array.from(arr.entries())
            .filter(([i, v]) => callback(v, i, arr))
            .map(([i, _]) => i);
}

/**
 * @param {number} start
 * @param {?number} [stop]
 * @param {number} step
 */
export function range(start, stop = null, step = 1) {
    if (stop === null) {
        stop = start;
        start = 0;
    }

    const n = Math.ceil((stop - start) / step);

    return new Array(n).fill(0).map((_, i) => start + step * i);
}