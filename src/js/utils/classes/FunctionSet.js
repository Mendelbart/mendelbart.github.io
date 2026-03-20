// CONVENIENCE CLASSES
export class FunctionSet {
    constructor() {
        /**
         * @type {Set<Function>}
         * @private
         */
        this.set = new Set();
    }

    /**
     * @param {Function} funcs
     */
    push(...funcs) {
        for (const func of funcs) {
            this.set.add(func);
        }
    }

    /**
     * @param {Function} funcs
     */
    remove(...funcs) {
        for (const func of funcs) {
            this.set.delete(func);
        }
    }

    call(...args) {
        for (const func of this.set) {
            func(...args);
        }
    }

    clear() {
        this.set.clear();
    }
}
