import {invertSubsets, processIndexSubsets} from "./indices";
import SelectorBlock from "./block";
import SelectorGridBlock from "./grid";
import {range, sum} from "../helpers/array";
import {DOMHelper, FunctionStack} from "../helpers";

export default class Selector {
    /**
     * @template T
     * @param {T[]} items
     * @param {(string | number[])[]} subsets
     * @param {?function(T[], number): SelectorBlock} [createBlockCallback] Default: `(items, subsetIndex) => new SelectorBlock(items)`
     */
    constructor(items, subsets, createBlockCallback = null) {
        this.items = items;
        this.subsets = processIndexSubsets(subsets, items.length);
        this.subsetsInverse = invertSubsets(this.subsets, items.length);

        /** @type {SelectorBlock[]} */
        this.blocks = this.subsets.map((subset, s) => {
            const items = subset.map(i => this.items[i]);
            return createBlockCallback ? createBlockCallback(items, s) : new SelectorBlock(items);
        });

        this.updateListeners = new FunctionStack();
        this._callUpdateListeners = this._callUpdateListeners.bind(this);
        this.blocks.forEach(block => block.updateListeners.push(this._callUpdateListeners));
    }

    _callUpdateListeners() {
        this.updateListeners.call(this, this.getChecked());
    }

    /**
     * @param {function(SelectorBlock, function)} blockFunc
     * @param callback
     * @private
     */
    _buttonCallback(blockFunc, callback) {
        this.blocks.forEach((block, s) => {
            blockFunc(block, (button, item, j) => callback(button, item, this.subsets[s][j]));
        });
    }

    /**
     * @param {function(SelectorBlock, function)} blockFunc
     * @param {function} callback
     * @private
     */
    _itemCallback(blockFunc, callback) {
        this.blocks.forEach((block, s) => {
            blockFunc(block, (item, j) => callback(item, this.subsets[s][j]));
        });
    }

    /**
     * @param {function(any, number): HTMLElement} callback
     */
    setupButtonContents(callback) {
        this._itemCallback((b, f) => b.setupButtonContents(f), callback)
    }

    _setupNode() {
        this.node = DOMHelper.createElement("div.selector");
        this.node.append(...this.blocks.map(block => block.node));
    }

    finishSetup() {
        this.blocks.forEach(block => block.finishSetup());
        this._setupNode();
    }

    /**
     * @param {function(HTMLDivElement, any, number): void} callback
     */
    updateButtonContents(callback) {
        this._buttonCallback((b, f) => b.updateButtonContents(f), callback);
    }

    /**
     * @param {function(any, number): void} callback
     */
    labelButtons(callback) {
        this._itemCallback((b, f) => b.labelButtons(f), callback);
    }

    /**
     * @param {boolean[] | function(any, number): boolean} callback
     */
    setChecked(callback) {
        this._itemCallback((b, f) => b.setChecked(f), callback);
    }


    /**
     * @param {boolean[] | function(any, number): boolean} callback
     */
    setDisabled(callback) {
        this._itemCallback((b, f) => b.setDisabled(f), callback);
    }

    /**
     * @returns {any[]}
     */
    getCheckedItems() {
        const checked = this.getChecked();
        return this.items.filter((_, i) => checked[i]);
    }

    /**
     * @param {boolean} [includeDisabled=false]
     * @returns {boolean[]}
     */
    getChecked(includeDisabled = false) {
        const blocksChecked = this.blocks.map(block => block.getChecked(includeDisabled));
        return range(this.items.length).map(i => {
            const [s, j] = this.subsetsInverse[i];
            return blocksChecked[s][j];
        });
    }

    checkedCount(includeDisabled = false) {
        return sum(this.blocks.map(block => block.checkedCount(includeDisabled)));
    }

    getDisabled() {
        const blocksDisabled = this.blocks.map(block => block.getDisabled());
        return range(this.items.length).map(i => {
            const [s, j] = this.subsetsInverse[i];
            return blocksDisabled[s][j];
        });
    }

    /**
     * @param {number} index
     * @returns {boolean}
     */
    isChecked(index) {
        const [s, j] = this.subsetsInverse[index];
        return this.blocks[s].isChecked(j);
    }

    /**
     * @param {number} index
     * @returns {boolean}
     */
    isDisabled(index) {
        const [s, j] = this.subsetsInverse[index];
        return this.blocks[s].isDisabled(j);
    }

    /**
     * @param {Record<string,string>} style
     */
    applyStyle(style) {
        this.blocks.forEach(block => block.applyStyle(style));
    }

    teardown() {
        this.blocks.forEach(block => block.teardown());
    }
}
