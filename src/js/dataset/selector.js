import {DOMHelper, ObjectHelper, FontHelper, ArrayHelper, FunctionStack} from "../helpers/helpers.js";
const range = ArrayHelper.range;
import {ButtonGroup} from "../settings/settings.js";

const STYLE_PROPERTIES = {
    buttonMinWidth: "--button-min-width",
    buttonMaxWidth: "--button-max-width",
    symbolSize: "--symbol-size",
    labelGap: "--label-gap",
    symbolMinWidth: "--symbol-min-width",
}

const BLOCK_KEYS = [
    "mode", "indices", "transpose", "nColumns", "dblClickGroups",
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
        this.onBlockLabelClick = this.onBlockLabelClick.bind(this);
        this.onBlockButtonClick = this.onBlockButtonClick.bind(this);
        this.onBlockLabelPointerOverOut = this.onBlockLabelPointerOverOut.bind(this);
        this.onBlockLabelPointerDown = this.onBlockLabelPointerDown.bind(this);
        this.onBlockLabelPointerUpCancel = this.onBlockLabelPointerUpCancel.bind(this);
        this.onBlockRangePointerDown = this.onBlockRangePointerDown.bind(this);
        this.onBlockRangePointerMove = this.onBlockRangePointerMove.bind(this);
        this.onBlockRangePointerUpCancel = this.onBlockRangePointerUpCancel.bind(this);
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

            for (const [indexWithinBlock, index] of block.indices.entries()) {
                const element = index === null ? this._gridGapElement() : this.buttons[index];
                block.elements.push(element);
                block.node.append(element);
                element.dataset.indexWithinBlock = indexWithinBlock;
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

        if (block.rowLabels) {
            if (typeof block.rowLabels === "string") {
                block.rowLabels = block.rowLabels.split("");
            }

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

        if (block.columnLabels) {
            if (typeof block.columnLabels === "string") {
                block.columnLabels = block.columnLabels.split("");
            }

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

    getButtonsFromIndices(indices) {
        if (!indices) {
            return [];
        }
        return indices.filter(index => index !== null).map(index => this.buttons[index]);
    }

    buttonsClassIfElse(boolean, indices, trueClasses, falseClasses = null) {
        DOMHelper.classIfElse(boolean, this.getButtonsFromIndices(indices), trueClasses, falseClasses);
    }

    buttonsRemoveClass(indices, className) {
        DOMHelper.removeClass(this.getButtonsFromIndices(indices), className);
    }

    buttonsAddClass(indices, className) {
        DOMHelper.addClass(this.getButtonsFromIndices(indices), className);
    }

    /**
     * @param {string} pos
     * @returns {[string, boolean, boolean]} [pos, start, end]
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

        block.dblClickGroups ??= [range(block.indices.length)];
        block.dblClickGroups = this.processIndexSubsets(block.dblClickGroups, block.indices.length);

        for (const [groupIndex, indices] of block.dblClickGroups.entries()) {
            for (const index of indices) {
                block.elements[index].dataset.dblClickGroup = groupIndex;
            }
        }

        // Switch from within-block indices (including gaps) to button indices
        block.dblClickGroups = block.dblClickGroups.map(
            indices => indices.map(index => block.indices[index]).filter(index => index !== null)
        );
    }

    setupBlockListeners(block) {
        block.node.addEventListener("click", this.onBlockButtonClick);

        this.resetRangeSelection();
        block.node.addEventListener("pointerdown", this.onBlockRangePointerDown);

        if (block.mode === "grid") {
            block.node.addEventListener("click", this.onBlockLabelClick);
            block.node.addEventListener("pointerover", this.onBlockLabelPointerOverOut);
            block.node.addEventListener("pointerout", this.onBlockLabelPointerOverOut);
            block.node.addEventListener("pointerdown", this.onBlockLabelPointerDown);
        }
    }

    removeBlockListeners(block) {
        block.node.removeEventListener("click", this.onBlockButtonClick);

        block.node.removeEventListener("pointerdown", this.onBlockRangePointerDown);
        block.node.removeEventListener("pointermove", this.onBlockRangePointerMove);

        if (block.mode === "grid") {
            block.node.removeEventListener("click", this.onBlockLabelClick);
            block.node.removeEventListener("pointerover", this.onBlockLabelPointerOverOut);
            block.node.removeEventListener("pointerout", this.onBlockLabelPointerOverOut);
            block.node.removeEventListener("pointerdown", this.onBlockLabelPointerDown);
        }
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockButtonClick(event) {
        const button = event.target.closest(".selector-item-button, .selector-grid-gap");
        if (!button) return;

        const blockIndex = this.getBlockIndexFromEvent(event);

        if (event.detail % 2 === 0 && this.lastBlockClicked === blockIndex && this.lastButtonClicked === button.dataset.indexWithinBlock) {
            const block = this.getBlockFromEvent(event);
            const groupIndex = button.dataset.dblClickGroup;
            const indices = block.dblClickGroups[groupIndex];

            this.toggleItems(indices);
        }

        this.lastButtonClicked = button.dataset.indexWithinBlock;
        this.lastBlockClicked = blockIndex;
    }

    /**
     * @param event
     * @returns {?string}
     */
    getBlockIndexFromEvent(event) {
        const blockNode = event.target.closest(".selector-block");
        return blockNode ? blockNode.dataset.blockIndex : null;
    }

    /**
     * @param {PointerEvent} event
     * @returns {?Object}
     */
    getBlockFromEvent(event) {
        const index = this.getBlockIndexFromEvent(event);
        return index !== null ? this.blocks[index] : null;
    }

    /**
     * @param {PointerEvent} event
     * @returns {*|null}
     */
    getIndicesFromBlockLabelEvent(event) {
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
    onBlockLabelClick(event) {
        const indices = this.getIndicesFromBlockLabelEvent(event);
        if (!indices) return;

        this.toggleItems(indices);
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockLabelPointerOverOut(event) {
        const indices = this.getIndicesFromBlockLabelEvent(event);
        if (!indices) return;

        this.buttonsClassIfElse(event.type === "pointerover", indices, "hover");
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockLabelPointerDown(event) {
        const indices = this.getIndicesFromBlockLabelEvent(event);
        if (!indices) return;

        this.buttonsAddClass(indices, "active");
        this.blockLabelActiveIndices = indices;

        document.addEventListener("pointerup", this.onBlockLabelPointerUpCancel, {once: true});
        document.addEventListener("pointercancel", this.onBlockLabelPointerUpCancel, {once: true});
    }

    onBlockLabelPointerUpCancel() {
        const indices = this.blockLabelActiveIndices;
        if (indices) {
            this.buttonsRemoveClass(indices, "active");
        }
        this.blockLabelActiveIndices = null;
        this.removeDocumentLabelListeners();
    }

    resetRangeSelection() {
        this.rangeSelectingBlockIndex = null;

        this.buttonsRemoveClass(this.rangeSelectionActiveIndices, "active");

        this.rangeSelectionActiveIndices = null;
        this.rangeSelectStartIndex = null;
        this.rangeSelectStopIndex = null;
        this.rangeSelectionActiveIndices = null;
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockRangePointerMove(event) {
        if (this.rangeSelectingBlockIndex === null) return;
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const button = element.closest(".selector-item-button, .selector-grid-gap");
        if (!button) return;

        const block = button.closest(".selector-block");
        if (block.dataset.blockIndex !== this.rangeSelectingBlockIndex) return;

        const indexWithinBlock = button.dataset.indexWithinBlock;
        if (this.rangeSelectStopIndex === indexWithinBlock) return;

        this.rangeSelectStartIndex ??= indexWithinBlock;
        this.rangeSelectStopIndex = indexWithinBlock;
        this.updateRangeSelection();
    }

    /**
     * @param {PointerEvent} event
     */
    onBlockRangePointerDown(event) {
        const blockIndex = this.getBlockIndexFromEvent(event);
        if (blockIndex === null) return;

        this.rangeSelectingBlockIndex = blockIndex;
        const button = event.target.closest(".selector-item-button, .selector-grid-gap")
        if (button) {
            this.rangeSelectStartIndex = button.dataset.indexWithinBlock;
            this.rangeSelectStopIndex = this.rangeSelectStartIndex;
            this.updateRangeSelection();
        }

        document.addEventListener("pointerup", this.onBlockRangePointerUpCancel, {once: true});
        document.addEventListener("pointercancel", this.onBlockRangePointerUpCancel, {once: true});
        this.blocks[blockIndex].node.addEventListener("pointermove", this.onBlockRangePointerMove);
    }

    onBlockRangePointerUpCancel(event) {
        if (this.rangeSelectingBlockIndex === null) return;

        if (
            event.type === "pointerup" &&
            this.getBlockIndexFromEvent(event) === this.rangeSelectingBlockIndex &&
            this.rangeSelectionActiveIndices
        ) {
            this.toggleItems(this.rangeSelectionActiveIndices);
        }

        this.blocks[this.rangeSelectingBlockIndex].node.removeEventListener("pointermove", this.onBlockRangePointerMove);
        this.removeDocumentRangeListeners();
        this.resetRangeSelection();
    }

    removeDocumentLabelListeners() {
        document.removeEventListener("pointerup", this.onBlockLabelPointerUpCancel);
        document.removeEventListener("pointercancel", this.onBlockLabelPointerUpCancel);
    }

    removeDocumentRangeListeners() {
        document.removeEventListener("pointerup", this.onBlockRangePointerUpCancel);
        document.removeEventListener("pointercancel", this.onBlockRangePointerUpCancel);
    }

    updateRangeSelection() {
        if (this.rangeSelectionActiveIndices) {
            this.buttonsRemoveClass(this.rangeSelectionActiveIndices, "active");
        }
        this.rangeSelectionActiveIndices = this.getIndicesInRangeSelection();
        this.buttonsAddClass(this.rangeSelectionActiveIndices, "active");
    }

    getIndicesInRangeSelection() {
        if (this.rangeSelectStartIndex === null || this.rangeSelectStopIndex === null) {
            return [];
        }

        const [startIndex, stopIndex] = minmax(this.rangeSelectStartIndex, this.rangeSelectStopIndex);
        const block = this.blocks[this.rangeSelectingBlockIndex];

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
                this.buttons[index].classList.add('disabled');
            } else {
                this.updateButtonForms(index, forms);
                this.buttons[index].classList.remove('disabled');
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
        const formsString = this.items[index].getFormsDisplayString(forms)
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
        if (!this.buttons[index].classList.contains('disabled') || updateIfDisabled) {
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
                .filter(button => !button.classList.contains('disabled'));

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

        FontHelper.setFont(symbolElement, ...this.dataset.getSelectorDisplayFont());

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
        this.formsSetting = ButtonGroup.from(
            ObjectHelper.map(this.formsData.setting, (p) => p.label),
            {
                label: label,
                exclusive: !!this.formsData.exclusive,
                checked: checked ?? ObjectHelper.map(this.formsData.setting, (p) => p.active),
            },
        );

        this.formsSetting.updateListeners.push(
            this.updateButtons.bind(this),
            () => this.updateListeners.call(this)
        );

        this.node.prepend(this.formsSetting.node);
    }

    destroy() {
        for (const block of this.blocks) {
            this.removeBlockListeners(block);
        }
        this.removeDocumentRangeListeners();
        this.removeDocumentLabelListeners();
        this.node.remove();
    }

    /**
     * @returns {string[]}
     */
    activeForms() {
        if (!this.formsSetting) {
            return Object.keys(this.formsData.setting);
        }

        const result = [];

        let keys = this.formsSetting.value;
        if (this.formsSetting.exclusive) {
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