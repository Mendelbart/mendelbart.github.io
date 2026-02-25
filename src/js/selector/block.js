import {DOMHelper, ArrayHelper, FunctionStack} from "../helpers";
import {ElementFitter, SizeWatcher} from "../helpers/classes/ElementFitter";
const range = ArrayHelper.range;

const STYLE_PROPERTIES = {
    buttonMinWidth: "--button-min-width",
    buttonMaxWidth: "--button-max-width",
    symbolSize: "--symbol-size",
    labelGap: "--label-gap",
    symbolMinWidth: "--symbol-min-width",
};

export default class SelectorBlock {
    /**
     * @param {any[]} items
     */
    constructor(items) {
        /**
         * @readonly
         * @type {*[]}
         */
        this.items = items;

        /**
         * @readonly
         * @type {HTMLDivElement}
         */
        this.node = DOMHelper.createElement("div.selector-block");
        this.updateListeners = new FunctionStack();

        this._bindListeners();
        this._setupListeners();
    }

    /**
     * @param {function(HTMLDivElement, any, number): void} callback
     */
    setupButtons(callback) {
        this._buttonIdPrefix = DOMHelper.uniqueIdPrefix("selectorButton");
        /** @type {boolean[]} */
        this.checked = new Array(this.items.length).fill(true);
        /** @type {HTMLDivElement[]} */
        this.buttons = range(this.items.length).map(index => this._createButton(index, true));
        this.node.append(...this.buttons);

        this.buttonSW = new SizeWatcher();
        this.buttonSW.watch(this.buttons);
        this._setupButtonFitter();

        this.updateButtonContents(callback);
    }


    /**
     * @param index
     * @param {boolean} checked
     * @returns {HTMLDivElement}
     * @private
     */
    _createButton(index, checked) {
        const button = DOMHelper.createElement("div.selector-button");
        const id = this._buttonIdPrefix + index.toString();
        DOMHelper.setAttrs(button, {
            id: id,
            role: "checkbox",
            tabindex: 0,
            "aria-checked": checked,
            "aria-labelledby": id          // setting aria-labelledby to its own content
        });

        button.dataset.index = index.toString();
        button.append(DOMHelper.createElement("div.selector-button-content"));

        return button;
    }

    /** @private */
    _bindListeners() {
        this._onButtonClick = this._onButtonClick.bind(this);
        this._onRangePointerDown = this._onRangePointerDown.bind(this);
        this._onRangePointerMove = this._onRangePointerMove.bind(this);
        this._onRangePointerUpCancel = this._onRangePointerUpCancel.bind(this);
    }

    /** @private */
    _callUpdateListeners() {
        this.updateListeners.call(this, this.checked);
    }

    /** @private */
    _setupButtonFitter() {
        this.buttonFitter = new ElementFitter({
            watcher: this.buttonSW,
            uniformFactor: 1.5,
            dimension: "width"
        });
        this.buttonFitter.fit(this.buttons.map(button => button.querySelector(".selector-button-content")));
    }

    /** @private */
    _setupLabelFitter() {
        this.labelFitter = new ElementFitter({
            watcher: this.buttonSW,
            dimension: "width"
        });
        this.labelFitter.fit(this.buttons.map(button => button.querySelector(".selector-button-label")));
    }

    /**
     * @param {function(HTMLDivElement, any, number): void} callback
     */
    updateButtonContents(callback) {
        for (const [index, button] of this.buttons.entries()) {
            callback(button.querySelector(".selector-button-content"), this.items[index], index);
        }
        this.buttonFitter.updateChildren();
    }

    /**
     * @param {function(any, number): string} callback
     */
    labelButtons(callback) {
        for (const [index, item] of this.items.entries()) {
            this.labelButton(index, callback(item, index));
        }

        if (!this.labelFitter) {
            this._setupLabelFitter();
        }
        this.labelFitter.updateChildren();
    }

    /**
     * @param {number} index
     * @param {string} label
     */
    labelButton(index, label) {
        const button = this.buttons[index];
        let labelElement = button.querySelector(".selector-button-label");
        if (!labelElement) {
            labelElement = DOMHelper.createElement("span.selector-button-label");
            button.append(labelElement);
        }

        labelElement.textContent = label;
    }

    /**
     * @param {Record<string,string>} style
     */
    applyStyle(style) {
        if ("buttonWidth" in style) {
            style.buttonMinWidth = style.buttonWidth;
            style.buttonMaxWidth = style.buttonWidth;
            delete style.buttonWidth;
        }

        for (const [prop, value] of Object.entries(style)) {
            if (!(prop in STYLE_PROPERTIES)) {
                console.error(`Invalid selector block style property ${prop}.`);
            }
            this.node.style.setProperty(STYLE_PROPERTIES[prop], value);
        }
    }

    /**
     * @param {string} property
     * @param {function(any, number): boolean} callback
     */
    _setARIAProperty(property, callback) {
        for (const [index, button] of this.buttons.entries()) {
            DOMHelper.setARIA(button, property, callback(this.items[index], index));
        }
    }

    /**
     * @param {function(any, number): boolean} callback
     */
    setChecked(callback) {
        this.items.forEach((item, index) => this._setButtonChecked(
            index, callback(item, index), {
                updateIfDisabled: true, callUpdateListeners: false
            })
        );
    }

    /**
     * @param {function(any, number): boolean} callback
     */
    setDisabled(callback) {
        this._setARIAProperty("disabled", callback);
    }

    /**
     * @param {boolean} [includeDisabled=false]
     * @returns {boolean[]}
     */
    getChecked(includeDisabled = false) {
        return this.checked.map((checked, index) => checked && (includeDisabled || !this.isDisabled(index)));
    }

    /**
     * @param includeDisabled
     * @returns {number}
     */
    checkedCount(includeDisabled = false) {
        return this.checked.reduce((acc, checked, index) => checked && (includeDisabled || !this.isDisabled(index)) ? acc + 1 : acc, 0);
    }

    /**
     * @returns {*[]}
     */
    getCheckedItems() {
        return this.items.filter((_, index) => this.checked[index]);
    }

    getDisabled() {
        return this.buttons.map(button => button.getAttribute("aria-disabled") === "true")
    }

    /**
     * @param {number} index
     * @param {boolean} checked
     * @param {boolean} [updateIfDisabled=true]
     * @param {boolean} [callUpdateListeners=true]
     */
    _setButtonChecked(index, checked, {updateIfDisabled = false, callUpdateListeners = true} = {}) {
        if (!updateIfDisabled && this.isDisabled(index)) {
            return;
        }

        DOMHelper.setARIA(this.buttons[index], "checked", checked);
        this.checked[index] = checked;

        if (callUpdateListeners) {
            this._callUpdateListeners();
        }
    }

    /**
     * @param {number} index
     * @param {boolean} [includeDisabled=false]
     * @returns {boolean}
     */
    isChecked(index, includeDisabled = false) {
        return this.checked[index] && (includeDisabled || !this.isDisabled(index));
    }

    /**
     * @param {number} index
     * @returns {boolean}
     */
    isDisabled(index) {
        return DOMHelper.getARIA(this.buttons[index], "disabled") === "true";
    }

    /**
     * @param {(?number)[]} indices
     * @param {boolean} [updateIfDisabled=false]
     * @param {boolean} [callUpdateListeners=true]
     */
    _toggleItems(indices, {updateIfDisabled = false, callUpdateListeners = true} = {}) {
        const checked = indices.findIndex(index => !this.isChecked(index)) !== -1;

        for (const index of indices) {
            this._setButtonChecked(index, checked, {
                updateIfDisabled: updateIfDisabled,
                callUpdateListeners: false
            });
        }

        if (callUpdateListeners) {
            this._callUpdateListeners();
        }
    }

    /** @private */
    _setupListeners() {
        this.node.addEventListener("click", this._onButtonClick);
        this.node.addEventListener("keypress", this._onButtonClick);

        this._resetRangeSelection();
        this.node.addEventListener("pointerdown", this._onRangePointerDown);
    }

    /** @private */
    _removeListeners() {
        this.node.removeEventListener("click", this._onButtonClick);
        this.node.removeEventListener("keypress", this._onButtonClick);

        this.node.removeEventListener("pointerdown", this._onRangePointerDown);
        this.node.removeEventListener("pointermove", this._onRangePointerMove);
    }

    /**
     * @param {HTMLElement} target
     * @returns {*}
     * @private
     */
    _buttonFromTarget(target) {
        return target.closest(".selector-button");
    }

    /**
     * @param {HTMLElement} target
     * @returns {number|null}
     * @private
     */
    _clickTargetIndex(target) {
        const el = this._buttonFromTarget(target);
        return el ? parseInt(el.dataset.index) : null;
    }

    /**
     * @param {PointerEvent | KeyboardEvent} event
     */
    _onButtonClick(event) {
        if (event.type === "keypress" && event.key !== "Enter") {
            return;
        }

        const button = event.target.closest(".selector-button, .selector-button-gap");
        if (button && button.classList.contains("selector-button")) {
            const index = button.dataset.index;
            this._setButtonChecked(index, !this.isChecked(index));
        }

        const targetIndex = this._clickTargetIndex(event.target);
        if (targetIndex === null) return;

        if (event.type === "click" && event.detail % 2 === 0 && this.lastClickTargetIndex === targetIndex) {
            this._toggleItems(range(this.buttons.length), {updateIfDisabled: true});
        }

        this.lastClickTargetIndex = targetIndex;
    }

    /** @private */
    _resetRangeSelection() {
        this._removeRangeListeners();

        if (this.rangeIndices) {
            this._buttonsRemoveClass(this.rangeIndices, "active");
        }

        this.rangeIndices = null;
        this.rangeStartIndex = null;
        this.rangeStopIndex = null;
        this.isRangeSelecting = false;
    }

    /**
     * @param {PointerEvent} event
     * @private
     */
    _onRangePointerMove(event) {
        if (!this.isRangeSelecting) return;
        const target = document.elementFromPoint(event.clientX, event.clientY);

        const clickItemIndex = this._clickTargetIndex(target);
        if (clickItemIndex === null || this.rangeStopIndex === clickItemIndex) return;

        this.rangeStartIndex ??= clickItemIndex;
        this.rangeStopIndex = clickItemIndex;
        this._updateRangeSelection();
    }

    /**
     * @param {PointerEvent} event
     * @private
     */
    _onRangePointerDown(event) {
        const clickItemIndex = this._clickTargetIndex(event.target);
        if (clickItemIndex !== null) {
            this.rangeStartIndex = clickItemIndex;
            this.rangeStopIndex = clickItemIndex;
            this._updateRangeSelection();
        }

        this.isRangeSelecting = true;
        this._addRangeListeners();
    }

    /**
     * @param {PointerEvent} event
     * @private
     */
    _onRangePointerUpCancel(event) {
        if (!this.isRangeSelecting) return;

        if (event.type === "pointerup" && this.rangeIndices && this.rangeStartIndex !== this.rangeStopIndex) {
            this._toggleItems(this.rangeIndices);
        }

        this._resetRangeSelection();
    }

    /** @private */
    _updateRangeSelection() {
        if (this.rangeIndices) {
            this._buttonsRemoveClass(this.rangeIndices, "active");
        }

        if (this.rangeStartIndex !== null && this.rangeStopIndex !== null) {
            this.rangeIndices = this._getRangeIndices(this.rangeStartIndex, this.rangeStopIndex);
            this._buttonsAddClass(this.rangeIndices, "active");
        } else {
            this.rangeIndices = null;
        }
    }

    /**
     * @param {number} startIndex
     * @param {number} stopIndex
     * @returns {number[]}
     */
    _getRangeIndices(startIndex, stopIndex) {
        if (stopIndex < startIndex) {
            [startIndex, stopIndex] = [stopIndex, startIndex];
        }
        return range(startIndex, stopIndex + 1);
    }

    /** @private */
    _addRangeListeners() {
        this.node.addEventListener("pointermove", this._onRangePointerMove);
        document.addEventListener("pointerup", this._onRangePointerUpCancel);
        document.addEventListener("pointercancel", this._onRangePointerUpCancel);
    }

    /** @private */
    _removeRangeListeners() {
        this.node.removeEventListener("pointermove", this._onRangePointerMove);
        document.removeEventListener("pointerup", this._onRangePointerUpCancel);
        document.removeEventListener("pointercancel", this._onRangePointerUpCancel);
    }

    /**
     * @param {number[]} indices
     * @param {string} className
     * @private
     */
    _buttonsRemoveClass(indices, className) {
        DOMHelper.removeClass(this._buttonsFromIndices(indices), className);
    }

    /**
     * @param {number[]} indices
     * @param {string} className
     * @private
     */
    _buttonsAddClass(indices, className) {
        DOMHelper.addClass(this._buttonsFromIndices(indices), className);
    }

    /**
     * @param {number[]} indices
     * @returns {HTMLDivElement[]}
     * @private
     */
    _buttonsFromIndices(indices) {
        return indices.map(index => this.buttons[index]);
    }

    teardown() {
        this._removeListeners();
        this.buttonSW.teardown();
        this.buttonFitter.teardown();
        if (this.labelFitter) {
            this.labelFitter.teardown();
        }
    }
}
