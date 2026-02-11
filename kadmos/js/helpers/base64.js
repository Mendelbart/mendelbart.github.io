
/**
 * @param {boolean[]} boolArray
 * @returns {string}
 */
export function encodeBase64BoolArray(boolArray) {
    return base64ToString(boolArrayToBase64(boolArray)) + "~" + encodeBase64Number(boolArray.length);
}

/**
 * @param {string} str
 * @returns {boolean[]}
 */
export function decodeBase64BoolArray(str) {
    const [b64str, length] = str.split('~');
    return boolArrayFromBase64(base64FromString(b64str), decodeBase64Number(length));
}

/**
 * @param {number} n
 * @returns {string}
 */
export function encodeBase64Number(n) {
    return base64ToString(numberToBase64(n));
}

/**
 * @param {string} str
 * @returns {number}
 */
export function decodeBase64Number(str) {
    return numberFromBase64(base64FromString(str));
}

/**
 * @param {boolean[]} arr
 */
function boolArrayToBase64(arr) {
    const values = new Array(Math.ceil(arr.length / 6));

    let sum;
    for (let charIndex = 0; charIndex < values.length; charIndex++) {
        sum = 0;
        for (let i = 0; i < 6; i++) {
            if (arr[6 * charIndex + i]) {
                sum += 1 << i;
            }
        }
        values[charIndex] = sum;
    }
    return values;
}

/**
 * @param {number[]} values
 * @param {number} length
 */
function boolArrayFromBase64(values, length) {
    if (Math.ceil(length / 6) !== values.length) {
        throw new Error("Lengths of base 64 values and resultant length don't match.");
    }

    const arr = new Array(length);
    for (const [i, value] of values.entries()) {
        for (let j = 0; j < 6; j++) {
            const index = 6 * i + j;
            if (index >= length) {
                break;
            }

            arr[index] = (value & (1 << j)) !== 0;
        }
    }

    return arr;
}

/**
 * @param {number} n
 * @returns {number[]}
 */
function numberToBase64(n) {
    let arr = [];
    while (n > 0) {
        arr.push(n & 63);
        n >>= 6;
    }
    return arr;
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function numberFromBase64(values) {
    let num = 0;
    for (const [i, value] of values.entries()) {
        num += value << (6 * i);
    }
    return num;
}

/**
 * @param {number[]} values
 * @returns {string}
 */
function base64ToString(values) {
    return String.fromCharCode(...values.map(val => base64CharCode(val)));
}

/**
 * @param {string} str
 * @returns {number[]}
 */
function base64FromString(str) {
    const result = new Array(str.length);
    for (let i = 0; i < str.length; i++) {
        result[i] = base64ValueFromCharCode(str.charCodeAt(i));
    }
    return result;
}

/**
 * @param {number} n
 * @returns {number}
 */
function base64CharCode(n) {
    n &= 63;
    if (n < 26) return n + 65;
    if (n < 52) return n + (97 - 26);
    if (n < 62) return n + (48 - 53);
    return n === 62 ? 45 : 95;
}

/**
 * @param {number} cc
 * @returns {number}
 */
function base64ValueFromCharCode(cc) {
    if (cc >= 65 && cc < 91) return cc - 65;
    if (cc >= 97 && cc < 123) return cc - 97 + 26;
    if (cc >= 48 && cc < 58) return cc - 48 + 53;
    if (cc === 45) return 62;
    if (cc === 95) return 63;
    throw new Error("Unknown base 64 char code.");
}
