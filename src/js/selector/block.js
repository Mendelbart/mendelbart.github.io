import {DOMHelper, ArrayHelper, FunctionStack} from "../helpers";
import {ElementFitter, SizeWatcher} from "../helpers/classes/ElementFitter";
import {rangeBetween} from "../helpers/array";
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
        if (!Array.isArray(items)) {
            throw new Error("Invalid argument: SelectorBlock.items must be an array.");
        }

        this.items = items;
        this.updateListeners = new FunctionStack();

        this.bindListeners();
        this.setupButtons();
    }

    bindListeners() {
        this.onButtonClick = this.onButtonClick.bind(this);
        this.onRangePointerDown = this.onRangePointerDown.bind(this);
        this.onRangePointerMove = this.onRangePointerMove.bind(this);
        this.onRangePointerUpCancel = this.onRangePointerUpCancel.bind(this);
    }

    setupButtons() {
        this.buttonIdPrefix = DOMHelper.uniqueIdPrefix("selectorButton");
        /** @type {boolean[]} */
        this.checked = new Array(this.items.length).fill(true);
        /** @type {HTMLDivElement[]} */
        this.buttons = range(this.items.length).map(index => this.createButton(index));
    }

    /**
     * @param index
     * @returns {HTMLDivElement}
     */
    createButton(index) {
        const button = DOMHelper.createElement("div.selector-button");
        const id = this.buttonIdPrefix + index.toString();
        DOMHelper.setAttrs(button, {
            id: id,
            role: "checkbox",
            tabindex: 0,
            "aria-checked": this.checked[index],
            "aria-labelledby": id          // setting aria-labelledby to its own content
        });

        button.dataset.index = index.toString();
        return button;
    }

    setupNode() {
        this.node = DOMHelper.createElement("div.selector-block.selector-block-flex");
        this.node.append(...this.buttons);
    }

    setupButtonWatcher() {
        this.buttonWatcher = new SizeWatcher();
        this.buttonWatcher.watch(this.buttons);
    }

    setupContentFitter() {
        if (!this.buttonWatcher) {
            this.setupButtonWatcher();
        }
        this.contentFitter = new ElementFitter({
            watcher: this.buttonWatcher,
            uniformFactor: 1.5,
            dimension: "width"
        });
        this.contentFitter.fit(this.buttons.map(button => button.querySelector(".selector-button-content")));
    }

    setupLabelFitter() {
        this.labelFitter = new ElementFitter({
            watcher: this.buttonWatcher,
            dimension: "width"
        });
        this.labelFitter.fit(this.buttons.map(button => button.querySelector(".selector-button-label")));
    }

    /**
     * @param {function(any, number): HTMLElement} callback
     */
    setupButtonContents(callback) {
        this.items.forEach((item, index) => {
            const content = callback(item, index);
            content.classList.add("selector-button-content");
            this.buttons[index].prepend(content);
        });
    }

    /**
     * @param {function(any, number): string} callback
     */
    labelButtons(callback) {
        for (const [index, item] of this.items.entries()) {
            this.labelButton(index, callback(item, index));
        }

        if (!this.labelFitter) {
            this.setupLabelFitter();
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

    finishSetup() {
        /**
         * @readonly
         * @type {HTMLDivElement}
         */
        this.setupNode();
        this.setupListeners();
        this.setupButtonWatcher();
        this.setupContentFitter();
    }

    callUpdateListeners() {
        this.updateListeners.call(this, this.checked);
    }

    /**
     * @param {function(HTMLElement, any, number): void} callback
     */
    updateButtonContents(callback) {
        for (const [index, button] of this.buttons.entries()) {
            callback(button.querySelector(".selector-button-content"), this.items[index], index);
        }
        this.contentFitter.updateChildren();
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
    setARIAProperty(property, callback) {
        for (const [index, button] of this.buttons.entries()) {
            DOMHelper.setARIA(button, property, callback(this.items[index], index));
        }
    }

    /**
     * @param {function(any, number): boolean} callback
     */
    setChecked(callback) {
        this.items.forEach((item, index) => this.setButtonChecked(
            index, callback(item, index), {
                updateIfDisabled: true, callUpdateListeners: false
            })
        );
    }

    /**
     * @param {function(any, number): boolean} callback
     */
    setDisabled(callback) {
        this.setARIAProperty("disabled", callback);
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
    setButtonChecked(index, checked, {updateIfDisabled = false, callUpdateListeners = true} = {}) {
        if (!updateIfDisabled && this.isDisabled(index)) {
            return;
        }

        DOMHelper.setARIA(this.buttons[index], "checked", checked);
        this.checked[index] = checked;

        if (callUpdateListeners) {
            this.callUpdateListeners();
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
     * @param {number[]} indices
     * @param {boolean} [includeDisabled=false]
     * @returns {boolean}
     */
    allChecked(indices, includeDisabled = false) {
        return indices.every(index => (!includeDisabled && this.isDisabled(index)) || this.checked[index]);
    }

    /**
     * @param {(?number)[]} indices
     * @param {boolean} [updateIfDisabled=false]
     * @param {boolean} [callUpdateListeners=true]
     */
    toggleItems(indices, {updateIfDisabled = false, callUpdateListeners = true} = {}) {
        if (!indices) return;

        const checked = !this.allChecked(indices);
        for (const index of indices) {
            this.setButtonChecked(index, checked, {
                updateIfDisabled: updateIfDisabled,
                callUpdateListeners: false
            });
        }

        if (callUpdateListeners) {
            this.callUpdateListeners();
        }
    }

    setupListeners() {
        this.node.addEventListener("click", this.onButtonClick);
        this.node.addEventListener("keypress", this.onButtonClick);

        this.resetRangeSelection();
        this.node.addEventListener("pointerdown", this.onRangePointerDown);
    }

    removeListeners() {
        this.node.removeEventListener("click", this.onButtonClick);
        this.node.removeEventListener("keypress", this.onButtonClick);

        this.node.removeEventListener("pointerdown", this.onRangePointerDown);
        this.node.removeEventListener("pointermove", this.onRangePointerMove);

        this.removeRangeListeners();
    }

    /**
     * @param {HTMLElement} target
     * @returns {number|null}
     */
    rangeTargetIndex(target) {
        const el = target.closest(".selector-button");
        return el ? parseInt(el.dataset.index) : null;
    }

    /**
     * @param {PointerEvent | KeyboardEvent} event
     */
    onButtonClick(event) {
        this.handleButtonClick(event);
        this.handleButtonDblClick(event);
    }

    handleButtonClick(event) {
        if (event.type === "keypress" && event.key !== "Enter") {
            return;
        }

        const button = event.target.closest(".selector-button, .selector-button-gap");
        if (button && button.classList.contains("selector-button")) {
            const index = button.dataset.index;
            this.setButtonChecked(index, !this.isChecked(index));
        }
    }

    handleButtonDblClick(event) {
        const targetIndex = this.rangeTargetIndex(event.target);
        if (targetIndex === null) return;

        if (event.type === "click" && event.detail % 2 === 0 && this.lastClickTargetIndex === targetIndex) {
            this.toggleItems(range(this.buttons.length), {updateIfDisabled: true});
        }

        this.lastClickTargetIndex = targetIndex;
    }

    resetRangeSelection() {
        this.removeRangeListeners();

        if (this.rangeIndices) {
            this.buttonsRemoveClass(this.rangeIndices, "active");
        }

        this.rangeIndices = null;
        this.rangeStartIndex = null;
        this.rangeStopIndex = null;
        this.isRangeSelecting = false;
    }

    /**
     * @param {PointerEvent} event
     */
    onRangePointerMove(event) {
        if (!this.isRangeSelecting) return;
        const target = document.elementFromPoint(event.clientX, event.clientY);

        const clickItemIndex = this.rangeTargetIndex(target);
        if (clickItemIndex === null || this.rangeStopIndex === clickItemIndex) return;

        this.rangeStartIndex ??= clickItemIndex;
        this.rangeStopIndex = clickItemIndex;
        this.updateRangeSelection();
    }

    /**
     * @param {PointerEvent} event
     */
    onRangePointerDown(event) {
        const clickItemIndex = this.rangeTargetIndex(event.target);
        if (clickItemIndex !== null) {
            this.rangeStartIndex = clickItemIndex;
            this.rangeStopIndex = clickItemIndex;
            this.updateRangeSelection();
        }

        this.isRangeSelecting = true;
        this.addRangeListeners();
    }

    /**
     * @param {PointerEvent} event
     */
    onRangePointerUpCancel(event) {
        if (!this.isRangeSelecting) return;

        if (event.type === "pointerup" && this.rangeIndices && this.rangeStartIndex !== this.rangeStopIndex) {
            this.toggleItems(this.rangeIndices);
        }

        this.resetRangeSelection();
    }

    updateRangeSelection() {
        if (this.rangeIndices) {
            this.buttonsRemoveClass(this.rangeIndices, "active");
        }

        if (this.rangeStartIndex !== null && this.rangeStopIndex !== null) {
            this.rangeIndices = this.getRangeIndices(this.rangeStartIndex, this.rangeStopIndex);
            this.buttonsAddClass(this.rangeIndices, "active");
        } else {
            this.rangeIndices = null;
        }
    }

    /**
     * @param {number} start
     * @param {number} stop
     * @returns {number[]}
     */
    getRangeIndices(start, stop) {
        return rangeBetween(start, stop);
    }

    addRangeListeners() {
        this.node.addEventListener("pointermove", this.onRangePointerMove);
        document.addEventListener("pointerup", this.onRangePointerUpCancel);
        document.addEventListener("pointercancel", this.onRangePointerUpCancel);
    }

    removeRangeListeners() {
        this.node.removeEventListener("pointermove", this.onRangePointerMove);
        document.removeEventListener("pointerup", this.onRangePointerUpCancel);
        document.removeEventListener("pointercancel", this.onRangePointerUpCancel);
    }

    /**
     * @param {number[]} indices
     * @param {string} className
     */
    buttonsRemoveClass(indices, className) {
        DOMHelper.removeClass(this.buttonsFromIndices(indices), className);
    }

    /**
     * @param {number[]} indices
     * @param {string} className
     */
    buttonsAddClass(indices, className) {
        DOMHelper.addClass(this.buttonsFromIndices(indices), className);
    }

    /**
     * @param {number[]} indices
     * @returns {HTMLDivElement[]}
     */
    buttonsFromIndices(indices) {
        return indices.map(index => this.buttons[index]);
    }

    teardown() {
        this.removeListeners();
        this.buttonWatcher.teardown();
        this.contentFitter.teardown();
        if (this.labelFitter) {
            this.labelFitter.teardown();
        }
    }
}
