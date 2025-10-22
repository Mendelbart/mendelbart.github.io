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