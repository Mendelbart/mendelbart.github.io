// Source: https://github.com/gustf/js-levenshtein/tree/v1.1.6

function _min(d0, d1, d2, bx, ay) {
    return d0 < d1 || d2 < d1
        ? d0 > d2
            ? d2 + 1
            : d0 + 1
        : bx === ay
            ? d1
            : d1 + 1;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levDist(a, b) {
    if (a === b) {
        return 0;
    }

    if (a.length > b.length) {
        const tmp = a;
        a = b;
        b = tmp;
    }

    let la = a.length;
    let lb = b.length;

    while (la > 0 && (a.charCodeAt(la - 1) === b.charCodeAt(lb - 1))) {
        la--;
        lb--;
    }

    let offset = 0;

    while (offset < la && (a.charCodeAt(offset) === b.charCodeAt(offset))) {
        offset++;
    }

    la -= offset;
    lb -= offset;

    if (la === 0 || lb < 3) {
        return lb;
    }

    let x = 0;
    let y;
    let d0;
    let d1;
    let d2;
    let d3;
    let dd;
    let dy;
    let ay;
    let bx0;
    let bx1;
    let bx2;
    let bx3;

    const vector = [];

    for (y = 0; y < la; y++) {
        vector.push(y + 1);
        vector.push(a.charCodeAt(offset + y));
    }

    const len = vector.length - 1;

    for (; x < lb - 3;) {
        bx0 = b.charCodeAt(offset + (d0 = x));
        bx1 = b.charCodeAt(offset + (d1 = x + 1));
        bx2 = b.charCodeAt(offset + (d2 = x + 2));
        bx3 = b.charCodeAt(offset + (d3 = x + 3));
        dd = (x += 4);
        for (y = 0; y < len; y += 2) {
            dy = vector[y];
            ay = vector[y + 1];
            d0 = _min(dy, d0, d1, bx0, ay);
            d1 = _min(d0, d1, d2, bx1, ay);
            d2 = _min(d1, d2, d3, bx2, ay);
            dd = _min(d2, d3, dd, bx3, ay);
            vector[y] = dd;
            d3 = d2;
            d2 = d1;
            d1 = d0;
            d0 = dy;
        }
    }

    for (; x < lb;) {
        bx0 = b.charCodeAt(offset + (d0 = x));
        dd = ++x;
        for (y = 0; y < len; y += 2) {
            dy = vector[y];
            vector[y] = dd = _min(dy, d0, dd, bx0, vector[y + 1]);
            d0 = dy;
        }
    }

    return dd;
}

// https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance#Optimal_string_alignment_distance
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

            if (i > 0 && j > 0 && a.charCodeAt(i) === b.charCodeAt(j-1) && a.charCodeAt(i-1) === b.charCodeAt(j)) {
                d[i+1][j+1] = Math.min(d[i+1][j+1], d[i-1][j-1] + cost);
            }
        }
    }

    return d[a.length][b.length];
}
