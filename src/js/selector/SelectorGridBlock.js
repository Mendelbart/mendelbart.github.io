import SelectorBlock from "./SelectorBlock";
import {DOMUtils, ElementFitter, Matrix} from '../utils';
import {cumSums, rangeBetween, sum} from "../utils/array";
import {label} from "../utils/dom";
import {matrixIndices} from "../utils/indices";


export default class SelectorGridBlock extends SelectorBlock {
    /**
     * @param {"button" | "label"} type
     * @returns {HTMLElement}
     * @private
     */
    createGap(type) {
        return DOMUtils.createElement(`span.selector-${type}-gap`);
    }

    /**
     * @param {Matrix} covered
     * @param {"rows" | "columns"} fillDirection
     */
    generateGrid(covered, fillDirection = "rows") {
        const n = covered.n;
        const m = covered.m;

        if (sum(covered.values()) > this.items.length) {
            throw Error(`Number of covered cells ${sum(covered.values())} exceeds number of items ${this.items.length}.`);
        }

        const grid = new Matrix(n, m);

        let index = 0;
        const entries = fillDirection === "rows" ? covered.entries() : covered.entriesColumnsFirst();
        for (const [[i, j], isCovered] of entries) {
            grid.set(i, j, isCovered ? index : null);
            if (isCovered) {
                index += 1;
            }
        }

        this.setGrid(grid);
    }

    /**
     * @param {Matrix} grid Matrix of item indices or `null` for gaps.
     */
    setGrid(grid) {
        this.grid = grid;
        this.setupGridElements();
    }

    setupGridElements() {
        /** @type {Matrix} */
        this.elements = this.grid.map(index => index == null ? this.createGap("button") : this.buttons[index]);
        this.elements.forEach((element, i, j) => {
            element.dataset.gridIndex = this.elements.getIndex(i, j);
        });
        this.labelPositions = new Set();
    }

    setupNode() {
        this.node = DOMUtils.createElement("div.selector-block.selector-block-grid");
        this.node.append(...this.elements.values().filter(e => e != null));
        this.setGridTemplateColumns();
    }

    setupGridLabelFitter() {
        this.gridLabelFitter = new ElementFitter({
            dimension: "width",
            scalingProperty: "font-size"
        });
        this.gridLabelFitter.fitAll(Array.from(this.node.querySelectorAll(".grid-label span")));
    }

    finishSetup() {
        super.finishSetup();
        this.setupGridLabelFitter();
    }

    /**
     * @param {"row" | "column"} type
     * @param {string[]} contents
     * @param {"start" | "end" | "both"} [position]
     * @param {number[]} [spans]
     */
    setGridLabels(type, contents, {position = "start", spans}) {
        if (position === "both") {
            this.setGridLabels(type, contents, {position: "start", spans: spans});
            this.setGridLabels(type, contents, {position: "end", spans: spans});
            return;
        }

        const labelCount = type === "row" ? this.grid.n : this.grid.m;
        spans ??= new Array(contents.length).fill(1);
        const indices = cumSums(spans);
        indices.splice(0, 0, 0);
        const labels = contents.map((content, i) => {
            return content ? this.createGridLabel(type, content, indices[i], spans[i]) : this.createGap("label");
        });

        let i = 0;
        for (const span of spans) {
            if (span > 1) labels.splice(i + 1, 0, ...(new Array(span - 1).fill(null)));
            i += span;
        }

        if (labels.length !== labelCount) {
            throw new Error(`Number of labels ${labels.length} and rows/columns ${labelCount} don't match.`);
        }

        const otherType = type === "row" ? "column" : "row";
        if (this.labelPositions.has(otherType + "start")) {
            labels.splice(0, 0, this.createGap("label"));
        }
        if (this.labelPositions.has(otherType + "end")) {
            labels.push(this.createGap("label"));
        }

        const deleteCount = this.labelPositions.has(type + position) ? 1 : 0;
        if (type === "row") {
            this.elements.spliceColumn(position === "end" ? this.elements.m : 0, deleteCount, labels);
        } else {
            this.elements.spliceRow(position === "end" ? this.elements.n : 0, deleteCount, labels);
        }

        this.labelPositions.add(type + position);
    }

    /**
     * @param {"row" | "column"} type
     * @param {string} content
     * @param {number} index
     * @param {number} span
     * @returns {HTMLElement}
     */
    createGridLabel(type, content, index, span = 1) {
        const element = DOMUtils.createElement(`span.grid-label.grid-${type}-label`);
        element.setAttribute("tabindex", 0);
        element.append(DOMUtils.createElement("span", content));
        element.dataset[type] = index.toString();

        if (span > 1) {
            element.dataset.span = span;
            element.style.setProperty("grid-" + type, "span " + span);
        }

        return element;
    }

    setGridTemplateColumns() {
        let value = `repeat(${this.grid.m}, minmax(var(--button-min-width), var(--button-max-width)))`;
        if (this.labelPositions.has("rowstart")) value = "auto " + value;
        if (this.labelPositions.has("rowend")) value += " auto";

        this.node.style.setProperty("grid-template-columns", value);
    }

    /**
     * @param {HTMLElement} target
     * @returns {number|null}
     */
    rangeTargetIndex(target) {
        const el = target.closest(".selector-button, .selector-button-gap");
        return el ? parseInt(el.dataset.gridIndex) : null;
    }

    /**
     * @param {"grid" | "walkRows" | "walkColumns"} mode
     */
    setRangeMode(mode) {
        if (!["grid", "walkRows", "walkColumns"].includes(mode)) {
            throw new Error(`Invalid range mode ${mode}.`);
        }
        this.rangeMode = mode;
    }

    /**
     * @param {number} start
     * @param {number} stop
     * @returns {number[]}
     */
    getRangeIndices(start, stop) {
        return this.getGridRangeIndices(start, stop).map(index => this.grid.getFromIndex(index)).filter(x => x != null);
    }

    /**
     * @param start
     * @param stop
     * @returns {number[]}
     */
    getGridRangeIndices(start, stop) {
        switch (this.rangeMode || "grid") {
            case "walkRows":
                return rangeBetween(start, stop);
            case "walkColumns":
                return rangeBetween(
                    ...[start, stop].map(x => this.grid.rowToColumnMajor(x))
                ).map(x => this.grid.columnToRowMajor(x));
            case "grid":
                const [startRow, startColumn] = this.grid.getCartesian(start);
                const [stopRow, stopColumn] = this.grid.getCartesian(stop);
                return matrixIndices(
                    rangeBetween(startRow, stopRow),
                    rangeBetween(startColumn, stopColumn)
                ).map(([i, j]) => this.grid.getIndex(i, j));
        }
    }


    bindListeners() {
        super.bindListeners();

        this.onLabelClick = this.onLabelClick.bind(this);
        this.onLabelPointerOverOut = this.onLabelPointerOverOut.bind(this);
        this.onLabelPointerUpCancel = this.onLabelPointerUpCancel.bind(this);
        this.onLabelPointerDown = this.onLabelPointerDown.bind(this);
    }

    setupListeners() {
        super.setupListeners();

        this.node.addEventListener("click", this.onLabelClick);
        this.node.addEventListener("keypress", this.onLabelClick);
        this.node.addEventListener("pointerover", this.onLabelPointerOverOut);
        this.node.addEventListener("pointerout", this.onLabelPointerOverOut);
        this.node.addEventListener("pointerdown", this.onLabelPointerDown);
    }

    removeListeners() {
        super.removeListeners();

        this.node.removeEventListener("click", this.onLabelClick);
        this.node.removeEventListener("keypress", this.onLabelClick);
        this.node.removeEventListener("pointerover", this.onLabelPointerOverOut);
        this.node.removeEventListener("pointerout", this.onLabelPointerOverOut);
        this.node.removeEventListener("pointerdown", this.onLabelPointerDown);

        this.removeDocumentLabelListeners();
    }

    getIndicesFromLabelEvent(event) {
        const element = event.target.closest(".grid-label");
        if (!element) return;

        const isRowLabel = element.classList.contains("grid-row-label");
        const callback = isRowLabel ? this.grid.getRow.bind(this.grid) : this.grid.getColumn.bind(this.grid);
        const index = isRowLabel ? parseInt(element.dataset.row) : parseInt(element.dataset.column);
        const indices = callback(index);

        if (element.dataset.span) {
            for (let i = 1; i < element.dataset.span; i++) {
                indices.push(...callback(index + i));
            }
        }

        return indices.filter(x => x != null);
    }

    /**
     * @param {PointerEvent | KeyboardEvent} event
     */
    onLabelClick(event) {
        if (event.type === "keydown" && event.key !== "Enter") return;

        this.toggleItems(this.getIndicesFromLabelEvent(event));
    }

    /**
     * @param {PointerEvent} event
     */
    onLabelPointerOverOut(event) {
        const indices = this.getIndicesFromLabelEvent(event);
        if (!indices) return;

        if (event.type === "pointerover") {
            this.buttonsAddClass(indices, "hover");
        } else {
            this.buttonsRemoveClass(indices, "hover");
        }
    }

    /**
     * @param {PointerEvent} event
     */
    onLabelPointerDown(event) {
        const indices = this.getIndicesFromLabelEvent(event);
        if (!indices) return;

        this.buttonsAddClass(indices, "active");
        this.gridLabelActiveIndices = indices;

        this.addDocumentLabelListeners();
    }

    onLabelPointerUpCancel() {
        const indices = this.gridLabelActiveIndices;
        if (indices) {
            this.buttonsRemoveClass(indices, "active");
        }

        this.gridLabelActiveIndices = null;
        this.removeDocumentLabelListeners();
    }

    addDocumentLabelListeners() {
        document.addEventListener("pointerup", this.onLabelPointerUpCancel, {once: true});
        document.addEventListener("pointercancel", this.onLabelPointerUpCancel, {once: true});
    }

    removeDocumentLabelListeners() {
        document.removeEventListener("pointerup", this.onLabelPointerUpCancel);
        document.removeEventListener("pointercancel", this.onLabelPointerUpCancel);
    }
}
