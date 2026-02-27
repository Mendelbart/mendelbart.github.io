import SelectorBlock from "./block";
import {DOMHelper} from '../helpers';
import Matrix from './matrix';
import {rangeBetween, sum} from "../helpers/array";
import {label} from "../helpers/dom";
import {matrixIndices} from "./indices";


export default class SelectorGridBlock extends SelectorBlock {
    /**
     * @param {"button" | "label"} type
     * @returns {HTMLElement}
     * @private
     */
    createGap(type) {
        return DOMHelper.createElement(`span.selector-${type}-gap`);
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
        this.node = DOMHelper.createElement("div.selector-block.selector-block-grid");
        this.node.append(...this.elements.values());
        this.setGridTemplateColumns();
    }

    /**
     * @param {"row" | "column"} type
     * @param {string[]} contents
     * @param {"start" | "end" | "both"} position
     */
    setGridLabels(type, contents, position = "start") {
        const labelCount = type === "row" ? this.grid.n : this.grid.m;
        if (contents.length !== labelCount) {
            throw new Error(`Number of labels ${contents.length} and rows/columns ${labelCount} don't match.`);
        }

        if (position === "both") {
            this.setGridLabels(type, contents, "start");
            this.setGridLabels(type, contents, "end");
            return;
        }

        const labels = contents.map((content, index) => {
            return content ? this.createGridLabel(type, content, index) : this.createGap("label");
        });

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
     * @returns {HTMLElement}
     */
    createGridLabel(type, content, index) {
        const element = DOMHelper.createElement(`span.grid-label.grid-${type}-label`);
        element.setAttribute("tabindex", 0);
        element.textContent = content;
        element.dataset[type] = index.toString();

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

        const indices = element.classList.contains("grid-row-label")
            ? this.grid.getRow(parseInt(element.dataset.row))
            : this.grid.getColumn(parseInt(element.dataset.column));

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
