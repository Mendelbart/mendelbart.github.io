import ValueElement from "./ValueElement";
import {DOMUtils} from "../utils";


export default class Switch extends ValueElement {
    constructor(node) {
        super(node);
        if (this.valueNode.type !== "checkbox") {
            throw new Error("Need checkbox for switch.");
        }

        this.node.classList.add("switch-container");
        this.valueNode.classList.add("switch");
    }

    /**
     * @param {string} label
     * @param {boolean} [checked]
     * @param {Record<string, *>} [attrs]
     * @returns {Switch}
     */
    static create(label, checked = false, attrs) {
        const input = document.createElement("INPUT");
        input.type = "checkbox";
        input.checked = checked;
        if (attrs) DOMUtils.setAttrs(input, attrs);

        const sw = new this(input);

        if (label) sw.label(label);
        return sw;
    }

    /**
     * @param {any} falseValue
     * @param {any} trueValue
     */
    setValues(falseValue, trueValue) {
        this.falseValue = falseValue;
        this.trueValue = trueValue;
        this.hasBoolValues = true;
    }

    /**
     * @returns {boolean | any}
     */
    get value() {
        const checked = this.valueNode.checked;
        if (this.hasBoolValues) return checked ? this.trueValue : this.falseValue;
        return checked;
    }

    /**
     * @param {boolean | any} value
     */
    set value(value) {
        if (this.hasBoolValues) {
            this.valueNode.checked = value === this.trueValue;
        } else {
            this.valueNode.checked = value;
        }
    }
}
