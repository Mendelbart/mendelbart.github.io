import {DOMHelper, ObjectHelper, FontHelper, ArrayHelper} from "../helpers/helpers.js";
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
     * @param formsData
     * @param selectorData
     */
    constructor(items, formsData, selectorData) {
        this.items = items;
        this.formsData = formsData;
        this.selectorData = selectorData;
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
        this.setupInputsLabels(this.activeForms());

        this.setupBlocks();
        this.setActive(this.processItemsActive(itemsActive));
    }

    setupInputsLabels(forms) {
        this.itemsActive = new Array(this.items.length).fill(false);
        this.inputs = new Array(this.items.length);
        this.labels = new Array(this.items.length);

        for (const [index, item] of this.items.entries()) {
            const [input, label] = this.getItemButton(item, forms, index.toString());
            this.inputs[index] = input;
            this.labels[index] = label;
            input.addEventListener("change", this.inputEventListener.bind(this));
        }

        const inputsContainer = DOMHelper.createElement("div.selector-inputs");
        inputsContainer.append(...this.inputs);
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
                    block.node.append(this.inputs[index], this.labels[index]);
                    block.elements.push(this.inputs[index]);
                }
            }

            if (block.mode === "grid") {
                block.node.classList.add("selector-block-grid");
                block.node.style.setProperty("--columns", block.nColumns);
            } else {
                block.node.classList.add("selector-block-flex");
            }

            if (this.selectorData.label && this.selectorData.label.position === "right") {
                this.node.classList.add("labels-right");
            }

            block.node.setAttribute("data-block-index", blockIndex);
            this.applyBlockStyle(block, this.selectorData.style, block.style);
            this.processListenerIndices(block);
            this.setupRangeSelection(block);

            this.node.append(block.node);

            try {
                this.addBlockLabels(block);
            } catch (e) {
                console.error("Error occured while trying to add block labels.");
                console.error(e);
            }
        }

        this.addDblClickListeners(this.labels);
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
                this.applyBlockLabelListeners(labelElement, "row");
                if (block.rowLabelStart) {
                    block.elements[index * m].insertAdjacentElement("beforebegin", labelElement);
                }

                if (block.rowLabelEnd) {
                    if (block.rowLabelStart) {
                        labelElement = labelElement.cloneNode(true);
                        this.applyBlockLabelListeners(labelElement, "row");
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
            const [pos, labelStart, labelEnd] = this._processLabelPosition(block.columnLabelPosition);
            [block.columnLabelStart, block.columnLabelEnd] = [labelStart, labelEnd];

            let labelElements = block.columnLabels.map(
                (labelString, index) => this._labelElement("column", labelString, index)
            );
            this.applyBlockLabelListeners(labelElements, "column");
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
                    this.applyBlockLabelListeners(labelElements, "column");
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

    labelsClassIfElse(boolean, indices, trueClasses, falseClasses = null) {
        const elements = indices.filter(index => index !== null).map(index => this.labels[index]);
        DOMHelper.classIfElse(boolean, elements, trueClasses, falseClasses);
    }

    applyBlockLabelListeners(element, type) {
        if (Array.isArray(element)) {
            for (const el of element) {
                this.applyBlockLabelListeners(el, type);
            }
            return;
        }

        const indicesKey = type === "row" ? "indicesByRow" : "indicesByColumn";
        element.addEventListener("click", (function(event) {
            const index = event.target.dataset.index;
            const blockIndex = event.target.parentElement.dataset.blockIndex;
            this.toggleItems(this.blocks[blockIndex][indicesKey][index]);
        }).bind(this));

        const listeners = [
            ["mouseover", "hover", true],
            ["mouseout", "hover", false],
        ];

        for (const [event, cls, bool] of listeners) {
            element.addEventListener(event, (function(event) {
                const index = event.target.dataset.index;
                const blockIndex = event.target.parentElement.dataset.blockIndex;
                this.labelsClassIfElse(bool, this.blocks[blockIndex][indicesKey][index], cls);
            }).bind(this));
        }

        element.addEventListener("pointerdown", (function(event) {
            const index = event.target.dataset.index;
            const blockIndex = event.target.parentElement.dataset.blockIndex;
            this.labelsClassIfElse(true, this.blocks[blockIndex][indicesKey][index], "active");

            document.addEventListener("pointerup", (function() {
                this.labelsClassIfElse(false, this.blocks[blockIndex][indicesKey][index], "active");
            }).bind(this), {once: true});
        }).bind(this));
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
                this.labels[index].dataset.indexWithinBlock = indexWithinBlock;
            }
        }

        block.dblclickGroups ??= [range(block.indices.length)];
        block.dblclickGroups = this.processIndexSubsets(block.dblclickGroups, block.indices.length)
            .map(indices => indices.map(index => {
                return block.indices[index];
            }).filter(index => index !== null));

        for (const [groupIndex, indices] of block.dblclickGroups.entries()) {
            for (const index of indices) {
                this.inputs[index].dataset.dblclickGroup = groupIndex.toString();
            }
        }
    }

    addDblClickListeners(label, index = null) {
        if (Array.isArray(label)) {
            for (const [index, lbl] of label.entries()) {
                this.addDblClickListeners(lbl, index);
            }
            return;
        }

        const input = this.inputs[index];
        const blockIndex = input.parentElement.dataset.blockIndex;
        const dblClickGroups = this.blocks[blockIndex].dblclickGroups;
        const groupIndex = input.dataset.dblclickGroup;

        label.addEventListener("click", (function(event) {
            if (event.detail % 2 === 0) {
                event.preventDefault();
                this.toggleItems([index], false);
                this.toggleItems(dblClickGroups[groupIndex]);
            }
        }).bind(this));

        label.addEventListener("mousedown", (function(event) {
            if (event.detail % 2 === 0) {
                this.labelsClassIfElse(true, dblClickGroups[groupIndex], "active");
                document.addEventListener("mouseup", (function() {
                    this.labelsClassIfElse(false, dblClickGroups[groupIndex], "active");
                }).bind(this), {once: true});
            }
        }).bind(this));
    }

    setupRangeSelection(block) {
        block.rangeSelecting = false;
        block.rangeSelectStartIndex = null;
        block.rangeSelectStopIndex = null;
        block.rangeSelectionActiveIndices = null;

        block.node.addEventListener("pointermove", (function(event) {
            const element = document.elementFromPoint(event.clientX, event.clientY);
            const label = element.closest("label");
            if (label && label.parentElement === block.node) {
                const indexWithinBlock = label.dataset.indexWithinBlock;
                if (block.rangeSelectStopIndex === indexWithinBlock) {
                    return;
                }

                if (block.rangeSelecting) {
                    if (block.rangeSelectStartIndex === null) {
                        block.rangeSelectStartIndex = indexWithinBlock;
                    }
                    block.rangeSelectStopIndex = indexWithinBlock;
                    this.updateRangeSelection(block);
                }
            }
        }).bind(this));

        block.node.addEventListener("pointerdown", (function(event) {
            block.rangeSelecting = true;
            const label = event.target.closest("label")
            if (label) {
                block.rangeSelectStartIndex = label.dataset.indexWithinBlock;
            }

            document.addEventListener("pointerup", (function(event) {
                if (!block.rangeSelecting) {
                    return;
                }

                const element = document.elementFromPoint(event.clientX, event.clientY);
                if (block.rangeSelectionActiveIndices) {
                    if (element.closest(".selector-block") === block.node) {
                        this.toggleItems(block.rangeSelectionActiveIndices);
                    }
                    this.labelsClassIfElse(false, block.rangeSelectionActiveIndices, "active");
                }

                block.rangeSelectionActiveIndices = null;
                block.rangeSelectStartIndex = null;
                block.rangeSelectStopIndex = null;
                block.rangeSelectionActiveIndices = null;

                block.rangeSelecting = false;
            }).bind(this), {once: true});
        }).bind(this));
    }

    updateRangeSelection(block) {
        if (block.rangeSelectionActiveIndices) {
            this.labelsClassIfElse(false, block.rangeSelectionActiveIndices, "active");
        }
        block.rangeSelectionActiveIndices = this.getIndicesInRangeSelection(block);
        this.labelsClassIfElse(true, block.rangeSelectionActiveIndices, "active");
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
                const transposedStartIndex = this.transposeIndex(startIndex, block.nRows, block.nColumns);
                const transposedStopIndex = this.transposeIndex(stopIndex, block.nRows, block.nColumns);

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

    processIndexSubsets(subsets, n, allowGaps) {
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

    updateButtons() {
        const forms = this.activeForms();
        for (const [index, item] of this.items.entries()) {
            this.labels[index].querySelector(".symbol").replaceChildren(item.getFormsDisplayNode(forms));
        }
    }

    /**
     * @param {(number | null)[]} indices
     * @param {boolean} updateInputs
     */
    toggleItems(indices, updateInputs = true) {
        indices = indices.filter(index => index !== null);
        const checked = indices.map(index => this.itemsActive[index]).includes(false);
        for (const index of indices) {
            this.updateItem(index, checked, updateInputs);
        }
    }

    /**
     * @param {number} index
     * @param {boolean} checked
     * @param {boolean} [updateInput]
     */
    updateItem(index, checked, updateInput = true) {
        const prevChecked = this.itemsActive[index];
        this.itemsActive[index] = checked;
        this.itemCount += checked - prevChecked;
        if (updateInput) {
            this.inputs[index].checked = checked;
        }
    }

    inputEventListener(event) {
        this.updateItem(parseInt(event.target.value), event.target.checked, false);
    }

    scaleButtons() {
        for (const block of this.blocks) {
            const labels = block.indices.filter(index => index !== null)
                .map(index => this.labels[index])
            DOMHelper.scaleAllToFit(
                labels.map(label => label.querySelector(".symbol")),
                {containers: labels, uniform: 0.75}
            );
            if (this.selectorData.label) {
                DOMHelper.scaleAllToFit(
                    labels.map(label => label.querySelector(".symbol-label")),
                    {containers: labels, uniform: 0.75}
                );
            }
        }
    }

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
            this.inputs[index].checked = active;
        }
        this.itemsActive = itemsActive;
    }

    defaultItemsActive() {
        let val = this.selectorData.defaultActive ?? "all";
        const itemsActive = new Array(this.items.length).fill(false);
        if (val === "all" || val === "none") {
            return new Array(this.items.length).fill(val === "all");
        }
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
     * @param {string[]} forms
     * @param {string} index
     */
    getItemButton(item, forms, index) {
        const [input, label] = DOMHelper.button("checkbox", index);
        const symbolElement = DOMHelper.createElement("span.symbol.symbol-string");

        symbolElement.appendChild(item.getFormsDisplayNode(forms));
        if (this.selectorData.font) {
            FontHelper.setFont(symbolElement, this.selectorData.font);
        }

        label.append(symbolElement);

        if (this.selectorData.label) {
            const labelData = this.selectorData.label;
            let labelContent = item.properties[labelData.property];
            if (labelData.splitFirst ?? true) {
                const splitter = labelData.splitter ?? "[,;/]";
                labelContent = labelContent.split(new RegExp(`\s*(${splitter})\s*`))[0];
            }

            const symbolLabelElement = DOMHelper.createElement("span.symbol-label");
            symbolLabelElement.textContent = labelContent;
            label.append(symbolLabelElement);
        }

        label.dataset.index = index;

        return [input, label];
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

        this.formsSetting.valueElement.addUpdateListener(this.updateButtons.bind(this));

        this.node.prepend(this.formsSetting.node);
    }

    activeForms() {
        if (this.formsSetting) {
            const result = [];
            for (const key of this.formsSetting.getValue()) {
                if ("keys" in this.formsData.setting[key]) {
                    result.push(...this.formsData.setting[key].keys);
                } else {
                    result.push(key);
                }
            }
            return result;
        }

        return Object.keys(this.formsData.setting);
    }

    activeIndices() {
        return ArrayHelper.filterIndices(this.itemsActive, x => x);
    }

    /**
     * @param {number | number[] | string} indices
     * @param {boolean} [allowGaps]
     * @returns {number[]}
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
     * @returns {number[]}
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


function divrem(a, b) {
    return [Math.floor(a / b), a % b];
}

function minmax(a, b) {
    return [Math.min(a, b), Math.max(a, b)];
}