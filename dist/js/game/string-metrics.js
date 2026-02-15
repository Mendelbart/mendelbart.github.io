// https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance#Optimal_string_alignment_distance

export {default as levenshtein} from './js-levenshtein.js';
/**
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function osaDistance(a, b) {
    const d = new Array(a.length + 1).fill(0).map(() => new Array(b.length + 1));

    for (let i = 0; i < a.length + 1; ++i) {
        d[i][0] = i;
    }
    for (let j = 0; j < b.length + 1; ++j) {
        d[0][j] = j;
    }

    let cost;

    for (let i = 0; i < a.length; ++i) {
        for (let j  = 0; j < b.length; ++j) {
            cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;

            d[i+1][j+1] = Math.min(d[i][j+1] + 1, d[i+1][j] + 1, d[i][j] + cost);

            if (
                i > 0 && j > 0
                && a.charCodeAt(i) === b.charCodeAt(j-1)
                && a.charCodeAt(i-1) === b.charCodeAt(j)
                && d[i+1][j+1] > d[i-1][j-1] + cost
            ) {
                d[i+1][j+1] = d[i-1][j-1] + cost;
            }
        }
    }

    return d[a.length][b.length];
}


/**
 * @param {string} a
 * @param {string} b
 * @param {number} maxDist
 * @param {number} [aLeft]
 * @param {number} [bLeft]
 */
export function levenshteinRecurse(a, b, maxDist, aLeft = 0, bLeft = 0) {
    if (aLeft === a.length) {
        return b.length - bLeft;
    }
    if (bLeft === b.length) {
        return a.length - aLeft;
    }

    if (maxDist === 0) {
        return a.substring(aLeft) === b.substring(bLeft) ? 0 : 1;
    }

    const lenDiff = Math.abs((a.length - aLeft) - (b.length - bLeft));
    if (maxDist < lenDiff) {
        return maxDist + 1;
    }

    let index = -1;

    for (let i = 0; i < Math.min(a.length - aLeft, b.length - bLeft); i++) {
        if (a.charCodeAt(aLeft + i) !== b.charCodeAt(bLeft + i)) {
            index = i;
            break;
        }
    }

    if (index === -1) {
        return lenDiff;
    }

    return 1 + Math.min(
        levenshteinRecurse(a, b, maxDist - 1, aLeft + index + 1, bLeft + index),
        levenshteinRecurse(a, b, maxDist - 1, aLeft + index, bLeft + index + 1),
        levenshteinRecurse(a, b, maxDist - 1, aLeft + index + 1, bLeft + index + 1),
    );
}

