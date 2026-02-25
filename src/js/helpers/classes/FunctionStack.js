// CONVENIENCE CLASSES
export class FunctionStack {
    constructor() {
        /**
         * @type {Set<Function>}
         * @private
         */
        this._funcs = new Set();
    }

    /**
     * @param {Function} funcs
     */
    push(...funcs) {
        for (const func of funcs) {
            this._funcs.add(func);
        }
    }

    /**
     * @param {Function} func
     */
    remove(func) {
        this._funcs.delete(func);
    }

    call(...args) {
        for (const func of this._funcs) {
            func.call(...args);
        }
    }

    clear() {
        this._funcs.clear();
    }
}
