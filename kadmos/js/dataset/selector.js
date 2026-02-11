import {DOMHelper, ObjectHelper, FontHelper, ArrayHelper, FunctionStack} from "../helpers/helpers.js";
const range = ArrayHelper.range;
import {Setting, SettingsHelper} from "../settings/settings.js";

const STYLE_PROPERTIES = {
    buttonMinWidth: "--button-min-width",
    buttonMaxWidth: "--button-max-width",
    symbolSize: "--symbol-size",
    labelGap: "--label-gap",
    symbolMinWidth: "--symbol-min-width",
}

const BLOCK_KEYS = [
    "mode", "indices", "transpose", "nColumns", "dblclickGroups",
    "rowLabels", "columnLabels", "rowLabelPosition", "columnLabelPosition",
    "rangeSelectionMode"
];


export default class ItemSelector {
    /**
     * @param {DatasetItem[]} items
     * @param {Dataset} dataset
     */
    constructor(items, dataset) {
        this.items = items;
        this.dataset = dataset;
        this.formsData = dataset.formsData;
        this.selectorData = dataset.selectorData;
        this.updateListeners = new FunctionStack();

        // Bind event listener functions
        this.onBlockClickLabel = this.onBlockClickLabel.bind(this);
        this.onBlockClickButton = this.onBlockClickButton.bind(this);
        this.onBlockLabelPointerEnterLeave = this.onBlockLabelPointerEnterLeave.bind(this);
        this.onBlockLabelPointerDown = this.onBlockLabelPointerDown.bind(this);
        this.onBlockRangePointerDown = this.onBlockRangePointerDown.bind(this);
        this.onBlockRangePointerMove = this.onBlockRangePointerMove.bind(this);
    }

    /**
     * @param {?(boolean[])} itemsActive
     * @param {?(string[])} checkedForms
     * @param {?string} datasetKey
     */
    setup(itemsActive = null, checkedForms = null, datasetKey = null) {
        this.node = DOMHelper.createElement("div.item-selector");
        if (datasetKey) {
            this.node.setAttribute("data-dataset", datasetKey);
        }

        this.setupFormsSetting(checkedForms);
        this.setupButtons();

        this.setupBlocks();
        this.setActive(this.processItemsActive(itemsActive));

        this.updateButtons(false);
    }

    setupButtons() {
        /** @type {boolean[]} */
        this.itemsActive = new Array(this.items.length).fill(false);
        /** @type {HTMLElement[]} */
        this.buttons = this.items.map((item, index) => this.getItemButton(item, index.toString()));
    }

    setupBlocks() {
        const blocks =
            this.selectorData.block
                ? [this.selectorData.block]
                : this.selectorData.blocks
                    ? this.selectorData.blocks
                    : [{mode: "flex"}];

        this.blocks = blocks.map(data => ObjectHelper.onlyKeys(data, BLOCK_KEYS, true));

        const blockIndices = this.processIndexSubsets(
            blocks.map(block => block.indices ?? "rest"),
            this.items.length,
            true
        );

        for (const [blockIndex, block] of this.blocks.entries()) {
            block.node = DOMHelper.createElement("div.selector-block");
            block.indices = blockIndices[blockIndex];
            this.standardizeBlockIndices(block);

            block.elements = [];

            for (const index of block.indices) {
                if (index === null) {
                    const gap = this._gridGapElement();
                    block.elements.push(gap);
                    block.node.append(gap);
                } else {
                    block.node.append(this.buttons[index]);
                    block.elements.push(this.buttons[index]);
                }
            }

            if (block.mode === "grid") {
                block.node.classList.add("selector-block-grid");
                block.node.style.setProperty("--columns", block.nColumns);
            } else {
                block.node.classList.add("selector-block-flex");
                if (this.dataset.metadata.dir === "rtl") {
                    block.node.classList.add("flex-rtl");
                }
            }

            if (this.selectorData.label && this.selectorData.label.position === "right") {
                this.node.classList.add("labels-right");
            }

            block.node.setAttribute("data-block-index", blockIndex.toString());
            this.applyBlockStyle(block, this.selectorData.style, block.style);
            this.processListenerIndices(block);
            this.setupBlockListeners(block);

            this.node.append(block.node);

            try {
                this.addBlockLabels(block);
            } catch (e) {
                console.error("Error occured while trying to add block labels.");
                console.error(e);
            }
        }
    }

    addBlockLabels(block) {
        /** @type {number} */
        const m = block.nColumns;
        const n = Math.round(block.indices.length / m);

        if ("rowLabels" in block) {
            if (!Array.isArray(block.rowLabels) || block.rowLabels.length !== n) {
                throw new Error("Row labels no array or don't match number of rows.");
            }
            const [pos, labelStart, labelEnd] = this._processLabelPosition(block.rowLabelPosition);
            [block.rowLabelStart, block.rowLabelEnd] = [labelStart, labelEnd];

            block.node.classList.add(`has-row-labels-${pos}`);

            for (const [index, labelString] of block.rowLabels.entries()) {
                let labelElement = this._labelElement("row", labelString, index);
                if (block.rowLabelStart) {
                    block.elements[index * m].insertAdjacentElement("beforebegin", labelElement);
                }

                if (block.rowLabelEnd) {
                    if (block.rowLabelStart) {
                        labelElement = labelElement.cloneNode(true);
                    }

                    if (index === m - 1) {
                        block.node.insertAdjacentElement("beforeend", labelElement);
                    } else {
                        block.elements[index * (m + 1)].insertAdjacentElement("beforebegin", labelElement);
                    }
                }
            }
        }

        if ("columnLabels" in block) {
            if (!Array.isArray(block.columnLabels) || block.columnLabels.length !== m) {
                throw new Error("Column labels no array or don't match number of columns.");
            }
            const [_, labelStart, labelEnd] = this._processLabelPosition(block.columnLabelPosition);
            [block.columnLabelStart, block.columnLabelEnd] = [labelStart, labelEnd];

            let labelElements = block.columnLabels.map(
                (labelString, index) => this._labelElement("column", labelString, index)
            );

            if ("rowLabels" in block) {
                if (block.rowLabelStart) {
                    labelElements.splice(0, 0, this._gridGapElement());
                }
                if (block.rowLabelEnd) {
                    labelElements.push(this._gridGapElement());
                }
            }
            if (block.columnLabelStart) {
                block.node.prepend(...labelElements);
            }
            if (block.columnLabelEnd) {
                if (block.columnLabelStart) {
                    labelElements = labelElements.map(node => node.cloneNode(true));
                }
                block.node.append(...labelElements);
            }
        }
    }

    applyBlockStyle(block, ...styles) {
        const style = Object.assign({}, ...styles);
        if ("buttonWidth" in style) {
            style.buttonMinWidth = style.buttonWidth;
            style.buttonMaxWidth = style.buttonWidth;
            delete style.buttonWidth;
        }

        for (const [prop, value] of Object.entries(style)) {
            if (!(prop in STYLE_PROPERTIES)) {
                console.error(`Invalid selector block style property ${prop}.`);
            }
            block.node.style.setProperty(STYLE_PROPERTIES[prop], value);
        }
    }

    _gridGapElement() {
        return DOMHelper.createElement("span.selector-grid-gap");
    }

    /**
     * @param {"row" | "column"} type
     * @param {string} content
     * @param {number} index
     * @returns HTMLElement
     * @private
     */
    _labelElement(type, content, index) {
        if (content === null) {
            return this._gridGapElement();
        }
        const element = DOMHelper.createElement(`span.block-label.block-${type}-label`);
        element.textContent = content;
        element.dataset.index = index.toString();

        return element;
    }

    buttonsClassIfElse(boolean, indices, trueClasses, falseClasses = null) {
        const buttons = indices.filter(index => index !== null).map(index => this.buttons[index]);
        DOMHelper.classIfElse(boolean, buttons, trueClasses, falseClasses);
    }

    /**
     * @param {string} pos
     * @returns {[boolean, boolean]} [start, end]
     * @private
     */
    _processLabelPosition(pos) {
        pos ??= "start";
        if (pos === "both") {
            return [pos, true, true];
        }
        if (pos === "end") {
            return [pos, false, true];
        }
        if (pos !== "start") {
            console.error("Invalid label position, use 'start', 'end' or 'both'.");
        }
        return ["start", true, false];
    }

    processListenerIndices(block) {
        if (block.mode === "grid") {
            block.indicesByRow = range(block.nRows).map(
                i => range(block.nColumns).map(j => block.indices[i * block.nColumns + j]).filter(n => n !== null)
            );
            block.indicesByColumn = range(block.nColumns).map(
                j => range(block.nRows).map(i => block.indices[i * block.nColumns + j]).filter(n => n !== null)
            );
        }

        for (const [indexWithinBlock, index] of block.indices.entries()) {
            if (index !== null) {
                this.buttons[index].dataset.indexWithinBlock = indexWithinBlock;
            }
        }

        block.dblclickGroups ??= [range(block.indices.length)];
        block.dblclickGroups = this.processIndexSubsets(block.dblclickGroups, block.indices.length)
            .map(indices => indices.map(index => {
                return block.indices[index];
            }).filter(index => index !== null));

        for (const [groupIndex, indices] of block.dblclickGroups.entries()) {
            for (const index of indices) {
                this.buttons[index].dataset.dblclickGroup = groupIndex;
            }
        }
    }

    setupBlockListeners(block) {
        // block.node.addEventListener("click", this.onBlockClickButton);

        this.resetRangeSelection(block);
        block.node.addEventListener("pointerdown", this.onBlockRangePointerDown);
        block.node.addEventListener("pointermove", this.onBlockRangePointerMove);

        if (block.mode === "grid") {
            block.node.addEventListener("click", this.onBlockClickLabel);
            block.node.addEventListener("pointerenter", this.onBlockLabelPointerEnterLeave);
            block.node.addEventListener("pointerleave", this.onBlockLabelPointerEnterLeave);
            block.node.addEventListener("pointerdown", this.onBlockLabelPointerDown);
        }
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockClickButton(event) {
        const button = event.target.closest(".selector-item-button");
        if (!button) return;

        const index = button.dataset.index;
        const block = this.getBlockFromEvent(event);

        this.updateItem(index, !this.itemsActive[index]);

        // double-click
        if (event.detail % 2 === 0 && block.lastClicked === index) {
            const groupIndex = button.dataset.dblclickGroup;
            const indices = block.dblclickGroups[groupIndex];

            this.toggleItems(indices);
        }

        block.lastClicked = index;
    }

    /**
     * @param {PointerEvent} event
     */
    getBlockFromEvent(event) {
        const blockNode = event.target.closest(".selector-block");
        return blockNode ? this.blocks[blockNode.dataset.blockIndex] : null;
    }

    /**
     * @param {PointerEvent} event
     * @returns {*|null}
     */
    getBlockIndicesFromEvent(event) {
        const element = event.target.closest(".block-label");
        if (!element) return;

        const indicesKey = element.classList.contains("block-row-label") ? "indicesByRow" : "indicesByColumn";
        const index = element.dataset.index;
        const block = this.getBlockFromEvent(event);
        return block[indicesKey][index];
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockClickLabel(event) {
        const indices = this.getBlockIndicesFromEvent(event);
        if (!indices) return;

        this.toggleItems(indices);
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockLabelPointerEnterLeave(event) {
        const indices = this.getBlockIndicesFromEvent(event);
        if (!indices) return;

        this.buttonsClassIfElse(event.type === "pointerenter", indices, "hover");
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockLabelPointerDown(event) {
        const indices = this.getBlockIndicesFromEvent(event);
        if (!indices) return;

        this.buttonsClassIfElse(true, indices, "active");

        document.addEventListener("pointerup", () => {
            this.buttonsClassIfElse(false, indices, "active");
        }, {once: true});
    }

    resetRangeSelection(block) {
        block.rangeSelecting = false;

        block.rangeSelectionActiveIndices = null;
        block.rangeSelectStartIndex = null;
        block.rangeSelectStopIndex = null;
        block.rangeSelectionActiveIndices = null;
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockRangePointerMove(event) {
        const block = this.getBlockFromEvent(event);
        if (!block.rangeSelecting) return;

        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element) return;

        const button = element.closest(".selector-item-button");
        if (!button || button.parentElement !== block.node) return;


        const indexWithinBlock = button.dataset.indexWithinBlock;
        if (block.rangeSelectStopIndex === indexWithinBlock) return;

        if (block.rangeSelectStartIndex === null) {
            block.rangeSelectStartIndex = indexWithinBlock;
        }
        block.rangeSelectStopIndex = indexWithinBlock;
        this.updateRangeSelection(block);
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockRangePointerDown(event) {
        const block = this.getBlockFromEvent(event);
        block.rangeSelecting = true;
        const button = event.target.closest(".selector-item-button")
        if (button) {
            block.rangeSelectStartIndex = button.dataset.indexWithinBlock;
        }
        block.rangeSelectStopIndex = block.rangeSelectStartIndex;
        this.updateRangeSelection(block);

        document.addEventListener("pointerup", () => {
            if (!block.rangeSelecting) return;

            if (block.rangeSelectionActiveIndices) {
                this.toggleItems(block.rangeSelectionActiveIndices);
                this.buttonsClassIfElse(false, block.rangeSelectionActiveIndices, "active");
            }

            this.resetRangeSelection(block);
        }, {once: true});
    }

    updateRangeSelection(block) {
        if (block.rangeSelectionActiveIndices) {
            this.buttonsClassIfElse(false, block.rangeSelectionActiveIndices, "active");
        }
        block.rangeSelectionActiveIndices = this.getIndicesInRangeSelection(block);
        this.buttonsClassIfElse(true, block.rangeSelectionActiveIndices, "active");
    }

    getIndicesInRangeSelection(block, startIndex = null, stopIndex = null) {
        startIndex ??= block.rangeSelectStartIndex;
        stopIndex ??= block.rangeSelectStopIndex;

        [startIndex, stopIndex] = minmax(startIndex, stopIndex);

        if (block.mode === "grid") {
            block.rangeSelectionMode ??= "grid";
            if (block.rangeSelectionMode === "grid") {
                let [startRow, startColumn] = divrem(startIndex, block.nColumns);
                let [stopRow, stopColumn] = divrem(stopIndex, block.nColumns);

                [startRow, stopRow] = minmax(startRow, stopRow);
                [startColumn, stopColumn] = minmax(startColumn, stopColumn);

                return range(startRow, stopRow + 1)
                    .map(index => range(
                        index * block.nColumns + startColumn, index * block.nColumns + stopColumn + 1
                    ))
                    .flat().map(index => block.indices[index]);
            } else if (block.rangeSelectionMode === "walkColumns") {
                let transposedStartIndex = this.transposeIndex(startIndex, block.nRows, block.nColumns);
                let transposedStopIndex = this.transposeIndex(stopIndex, block.nRows, block.nColumns);

                [transposedStartIndex, transposedStopIndex] = minmax(transposedStartIndex, transposedStopIndex);

                const transposedRange = this.transposedRange(block.nColumns, block.nRows)
                return range(transposedStartIndex, transposedStopIndex + 1).map(
                    index => transposedRange[index]
                ).map(index => block.indices[index]);
            } else if (block.rangeSelectionMode !== "walkRows") {
                console.error("Invalid range selection mode, use grid, walkRows or walkColumns.");
            }
        }

        return range(startIndex, stopIndex + 1).map(index => block.indices[index]);
    }

    standardizeBlockIndices(block) {
        if (block.mode === "grid") {
            if (!block.nColumns) {
                throw new Error("Block columns not set.");
            }

            block.nRows = Math.ceil(block.indices.length / block.nColumns);
            const residue = block.indices.length % block.nColumns;
            if (residue !== 0) {
                const n = block.nColumns - residue;
                block.indices.push(...(new Array(n).fill(null)));
            }
            if (block.transpose) {
                this.transposeBlock(block);
            }
        }
    }

    transposeBlock(block) {
        block.indices = this.transposeIndices(block.indices, block.nRows, block.nColumns);
    }

    transposeIndices(indices, n, m) {
        if (indices.length !== n * m) {
            throw new Error("Dimensions don't match.");
        }
        return this.transposedRange(n, m).map(i => indices[i]);
    }

    transposedRange(n, m) {
        return range(n * m).map(index => this.transposeIndex(index, n, m));
    }

    transposeIndex(index, n, m) {
        const [i, j] = divrem(index, m);
        return j * n + i;
    }

    /**
     * @param {any[]} subsets
     * @param {number} n
     * @param {boolean} [allowGaps]
     * @returns {number[][]}
     */
    processIndexSubsets(subsets, n, allowGaps = false) {
        const result = [];
        const covered = new Array(n).fill(false);
        for (const [i, subset] of subsets.entries()) {
            if (subset === "rest") {
                if (i !== subsets.length - 1) {
                    console.error("Can only have subset 'rest' at the end.");
                }
                result.push(ArrayHelper.filterIndices(covered, x => !x));
                break;
            }
            const indices = [];

            for (const index of this.processIndices(subset, allowGaps)) {
                indices.push(index);

                if (index === null) {
                    continue;
                }
                if (covered[index]) {
                    throw new Error(`Duplicate subset index ${index}.`);
                }
                covered[index] = true;
            }
            result.push(indices);
        }

        const uncovered = ArrayHelper.filterIndices(subsets, x => !x);
        if (uncovered.length !== 0) {
            throw new Error(`Not all indices were covered: missing ${uncovered}.`);
        }

        return result;
    }

    updateButtons(scale = true) {
        const forms = this.activeForms();
        for (const [index, item] of this.items.entries()) {
            if (item.countQuizItems(forms) === 0) {
                this.updateButtonForms(index, this.formsData.keys);
                this.buttons[index].setAttribute('disabled', 'disabled');
            } else {
                this.updateButtonForms(index, forms);
                this.buttons[index].removeAttribute('disabled');
            }
        }
        if (scale) {
            this.scaleButtons();
        }
    }

    /**
     * @param {number} index
     * @param {string[]} forms
     */
    updateButtonForms(index, forms) {
        const formsString = this.items[index].getFormsDisplayNode(forms)
        this.buttons[index].querySelector(".symbol").replaceChildren(formsString);
    }

    /**
     * @param {(number | null)[]} indices
     * @param {boolean} [updateIfDisabled]
     */
    toggleItems(indices, {updateIfDisabled = false} = {}) {
        indices = indices.filter(index => index !== null);
        const checked = indices.map(index => this.itemsActive[index]).includes(false);
        for (const index of indices) {
            this.updateItem(index, checked, {
                updateIfDisabled: updateIfDisabled,
                callUpdateListeners: false
            });
        }

        this.updateListeners.call(this);
    }

    /**
     * @param {number|string} index
     * @param {boolean} checked
     * @param {boolean} [updateInput]
     * @param {boolean} [updateIfDisabled]
     * @param {boolean} [callUpdateListeners]
     */
    updateItem(index, checked, {updateIfDisabled = false, callUpdateListeners = true} = {}) {
        this.itemsActive[index] = checked;
        if (!this.buttons[index].hasAttribute('disabled') || updateIfDisabled) {
            this.buttons[index].setAttribute('aria-checked', checked.toString());
        }

        if (callUpdateListeners) {
            this.updateListeners.call(this);
        }
    }

    /**
     * @returns {number}
     */
    activeQuizItemCount() {
        const forms = this.activeForms();
        let count = 0;
        for (const [index, item] of this.items.entries()) {
            if (this.itemsActive[index]) {
                count += item.countQuizItems(forms);
            }
        }

        return count;
    }

    scaleButtons() {
        for (const block of this.blocks) {
            const buttons = block.indices
                .filter(index => index !== null)
                .map(index => this.buttons[index])
                .filter(button => !button.hasAttribute('disabled'));

            DOMHelper.scaleAllToFit(
                buttons.map(button => button.querySelector(".symbol")),
                {containers: buttons, uniform: 0.75}
            );

            if (this.selectorData.label) {
                DOMHelper.scaleAllToFit(
                    buttons.map(button => button.querySelector(".selector-item-label")),
                    {containers: buttons, uniform: 0.75}
                );
            }
        }
    }

    /**
     * @param {boolean[]} itemsActive
     * @returns {boolean[]}
     */
    processItemsActive(itemsActive) {
        if (!itemsActive || !Array.isArray(itemsActive) || itemsActive.length !== this.items.length) {
            if (itemsActive) {
                console.error("Invalid active items array. Must be boolean array of same length as items.");
            }
            return this.defaultItemsActive();
        }

        return itemsActive.map(x => {
            if (![true, false, 0, 1].includes(x)) {
                console.warn("Invalid itemsActive, should be array of booleans or 0s and 1s.");
            }
            return !!x;
        });
    }

    /**
     * @param {boolean[]} itemsActive
     */
    setActive(itemsActive) {
        if (!Array.isArray(itemsActive) || itemsActive.length !== this.items.length) {
            console.error("Invalid active items.");
            return;
        }
        for (const [index, active] of itemsActive.entries()) {
            this.updateItem(index, active, {callUpdateListeners: false});
        }
        this.itemsActive = itemsActive;
    }

    defaultItemsActive() {
        let val = this.selectorData.defaultActive ?? "all";
        if (val === "all" || val === "none") {
            return new Array(this.items.length).fill(val === "all");
        }

        const itemsActive = new Array(this.items.length).fill(false);
        if (val.substring(0,5) === "block") {
            try {
                const blockIndices = this.processIndices(val.substring(5));
                val = blockIndices.map(index => this.blocks[index].indices).flat();
            } catch (e) {
                console.error(e);
                return itemsActive;
            }
        }

        if (!Array.isArray(val)) {
            console.error("Invalid defaultActive.");
            return itemsActive;
        }

        for (const index of val) {
            itemsActive[index] = true;
        }
        return itemsActive;
    }

    /**
     * @param {DatasetItem} item
     * @param {number} index
     * @returns {HTMLElement}
     */
    getItemButton(item, index) {
        const button = DOMHelper.createElement("div.selector-item-button");
        const id = DOMHelper.uniqueIdPrefix("selectorButton") + index.toString();
        DOMHelper.setAttrs(button, {
            id: id,
            role: "checkbox",
            tabindex: "0",
            "aria-checked": "false",
            "aria-labelledby": id          // setting aria-labelledby to its own content
        });

        const symbolElement = DOMHelper.createElement("span.symbol.symbol-string");

        if (this.selectorData.font) {
            FontHelper.setFont(symbolElement, this.selectorData.font);
        }
        DOMHelper.setAttrs(symbolElement, {
            lang: this.dataset.metadata.lang,
            dir: this.dataset.metadata.dir
        });

        button.append(symbolElement);

        if (this.selectorData.label) {
            const label = DOMHelper.createElement("span.selector-item-label");
            const labelData = this.selectorData.label;
            let labelContent = item.properties[labelData.property];
            if (labelData.splitFirst ?? true) {
                const splitter = labelData.splitter ?? "[,;/]";
                labelContent = labelContent.split(new RegExp(`\s*(${splitter})\s*`))[0];
            }

            label.textContent = labelContent;
            button.append(label);
        }

        button.dataset.index = index.toString();

        return button;
    }

    setupFormsSetting(checked = null) {
        if (!(this.formsData.showSetting ?? Object.keys(this.formsData.setting).length > 1)) {
            return;
        }

        const label = this.formsData.label ?? (this.formsData.exclusive ? "Form" : "Forms");
        this.formsSetting = Setting.create(label, SettingsHelper.createButtonGroup(
            ObjectHelper.map(this.formsData.setting, (p) => p.label),
            {
                exclusive: !!this.formsData.exclusive,
                checked: checked ?? ObjectHelper.map(this.formsData.setting, (p) => p.active),
            },
        ));

        this.formsSetting.valueElement.updateListeners.push(
            this.updateButtons.bind(this),
            () => this.updateListeners.call(this)
        );

        this.node.prepend(this.formsSetting.node);
    }

    /**
     * @returns {string[]}
     */
    activeForms() {
        if (!this.formsSetting) {
            return Object.keys(this.formsData.setting);
        }

        const result = [];

        let keys = this.formsSetting.getValue();
        if (this.formsSetting.valueElement.exclusive) {
            keys = [keys];
        }

        for (const key of keys) {
            if ("keys" in this.formsData.setting[key]) {
                result.push(...this.formsData.setting[key].keys);
            } else {
                result.push(key);
            }
        }
        return result;
    }

    activeIndices() {
        return ArrayHelper.filterIndices(this.itemsActive, x => x);
    }

    /**
     * @param {number | number[] | string} indices
     * @param {boolean} [allowGaps]
     * @returns {(number|null)[]}
     */
    processIndices(indices, allowGaps = false) {
        if (typeof indices === "string") {
            return this.parseRanges(indices, allowGaps);
        }
        if (typeof indices === "number") {
            return [indices];
        }

        if (!Array.isArray(indices)) {
            throw new Error("Invalid indices datatype: need string, number or Array<number>.")
        }

        indices = indices.sort();
        const l = indices.length;
        indices = indices.filter((v, i, a) => i === 0 || v !== a[i - 1]);
        if (indices.length !== l) {
            console.warn("Indices contain duplicates.");
        }

        return indices;
    }

    /**
     * @param {string} str
     * @param {boolean} [allowGaps]
     * @returns {(number|null)[]}
     */
    parseRanges(str, allowGaps = false) {
        return [].concat(...str.split(",").map(range => {
            if (allowGaps && range.substring(0, 3) === "gap") {
                const n = range.length === 3 ? 1 : this.parseInt(range.substring(3));
                return new Array(n).fill(null);
            }
            return this.parseRange(range);
        }));
    }

    /**
     * @param {string} str
     * @returns {number[]}
     */
    parseRange(str) {
        const vals = str.split(":").map(x => this.parseInt(x));
        if (vals.length === 1) {
            return vals;
        }

        if (vals.length === 0 || vals.length > 3) {
            throw new Error("Invalid range, 2-3 numbers.");
        }

        const start = vals[0];
        const stop = vals[vals.length - 1];
        const step = vals.length === 3 ? vals[1] : 1;

        if (stop < start || step < 1) {
            throw new Error("Invalid range, must have start <= stop and step >= 1.");
        }

        return range(start, stop + 1, step);
    }

    /**
     * Parse int, throws Error if the value is NaN.
     * @param {string} str
     * @returns {number}
     */
    parseInt(str) {
        const result = parseInt(str);
        if (isNaN(result)) {
            throw new Error("Not a number.");
        }
        return result;
    }
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {[number, number]}
 */
function divrem(a, b) {
    const rem = a % b;
    const div = Math.round((a - rem) / b);
    return [div, rem];
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {[number, number]}
 */
function minmax(a, b) {
    return [Math.min(a, b), Math.max(a, b)];
}