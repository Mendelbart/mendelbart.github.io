// CONVENIENCE CLASSES
export class FunctionStack {
    constructor() {
        /**
         * @type {Function[]}
         * @private
         */
        this._funcs = [];
    }

    /**
     * @param {Function} funcs
     */
    push(...funcs) {
        this._funcs.push(...funcs);
    }

    /**
     * @param {Function} func
     */
    remove(func) {
        const index = this._funcs.indexOf(func);
        if (index !== -1) {
            this._funcs.splice(index, 1);
        } else {
            throw new Error(`Unknown func ${func}.`);
        }
    }

    call(...args) {
        for (const func of this._funcs) {
            func.call(...args);
        }
    }
}
