import SelectorBlock from "./block";
import {DOMHelper} from '../helpers';

export default class SelectorGridBlock extends SelectorBlock {
    /**
     * @param {any[]} items
     */
    constructor(items) {
        super(items);
        this.node.classList.add("selector-grid-block");
    }

    /**
     * @param {"button" | "label"} type
     * @returns {HTMLElement}
     * @private
     */
    _createGap(type) {
        return DOMHelper.createElement(`span.selector-${type}-gap`);
    }

    _bindListeners() {
        super._bindListeners();

        this._onLabelClick = this._onLabelClick.bind(this);
        this._onLabelPointerOverOut = this._onLabelPointerOverOut.bind(this);
        this._onLabelPointerOverOut = this._onLabelPointerOverOut.bind(this);
        this._onLabelPointerDown = this._onLabelPointerDown.bind(this);
    }

    _setupListeners() {
        super._setupListeners();

        this.node.addEventListener("click", this._onLabelClick);
        this.node.addEventListener("keypress", this._onLabelClick);
        this.node.addEventListener("pointerover", this._onLabelPointerOverOut);
        this.node.addEventListener("pointerout", this._onLabelPointerOverOut);
        this.node.addEventListener("pointerdown", this._onLabelPointerDown);
    }

    _removeListeners() {
        super._removeListeners();

        this.node.removeEventListener("click", this._onLabelClick);
        this.node.removeEventListener("keypress", this._onLabelClick);
        this.node.removeEventListener("pointerover", this._onLabelPointerOverOut);
        this.node.removeEventListener("pointerout", this._onLabelPointerOverOut);
        this.node.removeEventListener("pointerdown", this._onLabelPointerDown);
    }
}
