import {bisectLeft, cumSums} from "./array.js";

/**
 * Generate a PRNG seed from `str`.
 * @param {string} str
 * @returns {[number, number, number, number]}
 */
function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;

    for (let i = 0; i < str.length; i++) {
        const k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }

    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

    h1 ^= (h2 ^ h3 ^ h4);
    h2 ^= h1;
    h3 ^= h1;
    h4 ^= h1;

    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Simple Fast Counter. A pseudo-random number generator, initialized with
 * four 32-bit integers.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @param {number} d
 * @returns {function(): number}
 */
function sfc32(a, b, c, d) {
    return function() {
        a |= 0; b |= 0; c |= 0; d |= 0;
        const t = (a + b | 0) + d | 0;
        d = d + 1 | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}

/**
 * @param {string} seed
 * @returns {function(): number}
 */
export function seededPRNG(seed) {
    return sfc32(...cyrb128(seed));
}

/**
 * @param {Array} array - Array to be shuffled
 * @param {function(): number} rand - RNG returning values in [0,1).
 */

export function shuffle(array, rand = Math.random) {
    for (let length = array.length; length > 0; length--) {
        const randomIndex = Math.floor(rand() * length);
        if (randomIndex !== length - 1) {
            [array[length - 1], array[randomIndex]] = [
                array[randomIndex], array[length - 1]
            ];
        }
    }
}

/**
 * Return a random integer n with `min <= n < max`.
 * @param {number} min
 * @param {number} max
 * @param {function(): number} rand - RNG returning values in [0,1)
 * @returns
 */
export function randInt(min, max, rand = Math.random) {
    return Math.floor(rand() * (max - min) + min);
}

/**
 * Returns a random index with probabilities proportional to the `weights`.
 * @param {number[]} weights
 * @param {function(): number} rand - RNG returning values in [0,1)
 * @returns {number}
 */
export function randIndexFromWeights(weights, rand = Math.random) {
    const sums = cumSums(weights);
    return bisectLeft(rand() * sums[sums.length - 1], sums);
}
