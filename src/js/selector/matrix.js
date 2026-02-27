import {full} from "../helpers/array";


/** Representation of a nxm matrix, stored in row-major order. */
export default class Matrix {
    /**
     * @param {number} n - number of rows
     * @param {number} m - number of columns
     * @param {Array} [data] - values in row-major order, optional
     */
    constructor(n, m, data) {
        if (!data) {
            data = new Array(n * m);
        }

        if (!Array.isArray(data) || data.length !== n * m) {
            throw new Error("Need array of size n * m.");
        }

        this.data = data;
        this.n = n;
        this.m = m;
    }

    /**
     * @param {number} i
     * @param {number} j
     * @returns {number}
     */
    getIndex(i, j) {
        return i * this.m + j;
    }

    /**
     * @param {number} i
     * @param {number} j
     * @returns {number}
     */
    getColumnMajorIndex(i, j) {
        return j * this.n + i;
    }

    /**
     * @param {number} index
     * @returns {[number, number]}
     */
    getCartesian(index) {
        return [Math.floor(index / this.m), index % this.m];
    }

    /**
     * @param {number} index
     * @returns {any}
     */
    getFromIndex(index) {
        return this.get(...this.getCartesian(index));
    }

    /**
     * @param {number} index
     * @returns {[number, number]}
     */
    getCartesianColumnMajor(index) {
        return [index % this.n, Math.floor(index / this.n)];
    }

    /**
     * @param {number} index
     * @returns {number}
     */
    rowToColumnMajor(index) {
        return this.getColumnMajorIndex(...this.getCartesian(index));
    }

    /**
     * @param {number} index
     * @returns {number}
     */
    columnToRowMajor(index) {
        return this.getIndex(...this.getCartesianColumnMajor(index));
    }

    /**
     * @param {number} i
     * @param {number} j
     * @returns {*}
     */
    get(i, j) {
        return this.data[this.getIndex(i, j)];
    }

    set(i, j, value) {
        this.data[this.getIndex(i, j)] = value;
    }

    fill(value) {
        this.data.fill(value);
        return this;
    }

    /**
     * @param {Array} values
     * @param {number} length
     * @private
     */
    _assertValues(values, length) {
        if (!values) {
            return new Array(length);
        }
        if (!Array.isArray(values)) {
            throw new Error("Row/column values must be array.");
        }
        if (values.length !== length) {
            throw new Error(`Row/column length ${values.length} and matrix dimension ${length} do not match.`);
        }
        return values;
    }

    /**
     * @param {number} i
     * @param {number} deleteCount
     * @param {Array} [values]
     */
    spliceRow(i, deleteCount = 0, values) {
        values = this._assertValues(values, this.m);
        this.data.splice(i * this.m, deleteCount * this.m, ...values);
        this.n += 1;
    }

    /**
     * @param {number} j
     * @param {number} [deleteCount]
     * @param {Array} [values]
     */
    spliceColumn(j, deleteCount = 0, values) {
        values = this._assertValues(values, this.n);
        for (let i = 0; i < this.n; i++) {
            this.data.splice(i * (this.m + 1) + j, deleteCount, values[i]);
        }
        this.m += 1;
    }

    transpose() {
        const data = full(this.length, index => {
            const [i, j] = this.getCartesian(index);
            return this.get(j, i);
        });
        return new this.constructor(this.m, this.n, data);
    }

    /**
     * @returns {any[][]}
     */
    toRows() {
        return full(this.n, i => full(this.m, j => this.get(i, j)));
    }

    /**
     * @param {any[][]} rows
     */
    static fromRows(rows) {
        return new this(rows.length, rows[0].length, rows.flat());
    }

    toString() {
        return this.toRows().toString();
    }

    /**
     * @param {function(any, number, number): any} callback
     */
    map(callback) {
        return new this.constructor(this.n, this.m, this.data.map((value, index) => callback(value, ...this.getCartesian(index))));
    }

    /**
     * @returns {any[]}
     */
    values() {
        return this.data;
    }

    /**
     * @returns {[number,number][]}
     */
    keys() {
        return full(this.length, index => this.getCartesian(index));
    }

    keysColumnsFirst() {
        return full(this.length, index => this.getCartesianColumnMajor(index));
    }

    /**
     * @returns {[[number,number],any][]}
     */
    entries() {
        return this.data.map((value, index) => [this.getCartesian(index), value]);
    }

    entriesColumnsFirst() {
        return full(this.length, index => {
            const [i, j] = this.getCartesianColumnMajor(index);
            return [[i, j], this.get(i, j)];
        });
    }

    /**
     * @param {function(any, number, number, Matrix): void} callback
     */
    forEach(callback) {
        this.data.forEach((value, index) => callback(value, ...this.getCartesian(index), this));
    }

    get length() {
        return this.n * this.m;
    }

    copy() {
        return new this.constructor(this.n, this.m, this.data.slice());
    }

    getRow(i) {
        return full(this.m, j => this.get(i, j));
    }

    getColumn(j) {
        return full(this.n, i => {
            return this.get(i, j);
        });
    }

    static full(n, m, callback) {
        const matrix = new this(n, m);
        for (const [i, j] of matrix.keys()) {
            matrix.set(i, j, callback(i, j));
        }
        return matrix;
    }
}