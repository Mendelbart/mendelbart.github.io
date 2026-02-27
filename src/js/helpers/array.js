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
 * Range from `start` (inclusive) to `stop` (exclusive), with an optional `step` size (default `1`).
 * @param {number} start
 * @param {number} [stop]
 * @param {number} step
 * @returns {number[]}
 */
export function range(start, stop, step = 1) {
    if (stop == null) {
        stop = start;
        start = 0;
    }

    if (step === 0) throw new Error("Range step cannot be 0.");

    const n = Math.ceil((stop - start) / step);
    if (n <= 0) return [];

    return full(n, i => start + step * i);
}

/**
 * Returns all integers between `a` and `b` including `a` and `b`.
 * Equivalent to `range(Math.min(a, b), Math.max(a, b))`
 * @param {number} a
 * @param {number} b
 * @returns {number[]}
 */
export function rangeBetween(a, b) {
    if (a > b) {
        [a, b] = [b, a];
    }
    return range(a, b + 1);
}

/**
 * @template T
 * @param {number} length
 * @param {function(number, number[]): T} callback
 * @returns {T[]} `arr` with `arr[i] = callback(i)`
 */
export function full(length, callback) {
    const arr = new Array(length);
    for (let i = 0; i < length; i++) {
        arr[i] = callback(i, arr);
    }
    return arr;
}
