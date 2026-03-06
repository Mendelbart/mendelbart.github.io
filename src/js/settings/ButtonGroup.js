import {DOMHelper, ObjectHelper} from '../helpers';
import Observable from "../helpers/classes/Observable";

DOMHelper.registerTemplate("buttonGroupContainer", DOMHelper.createElement("fieldset.button-group.setting"));

/** @implements Setting */
export default class ButtonGroup extends Observable {
    static nameCount = 0

    /** @type {HTMLFieldSetElement} */
    node
    /** @type {Record<string, HTMLInputElement>} */
    inputs

    /**
     * @param {HTMLFieldSetElement} node
     * @param {boolean} exclusive
     */
    constructor(node, exclusive) {
        super();
        this.node = node;

        this.inputs = {};
        for (const input of this.node.querySelectorAll("INPUT")) {
            this.inputs[input.value] = input;
        }

        this.exclusive = exclusive;

        this.node.addEventListener("change", this.callObservers);
    }

    /**
     * @param {Record<string,string> | string[]} data
     * @param {boolean} [exclusive=false]
     * @param {?string} [name]
     * @param {?string|string[]|Record<string,boolean>} [checked]
     * @param {?string|string[]|Record<string,boolean>} [disabled]
     * @param {boolean} [decheckable=false]
     * @param {?string} [label]
     * @returns {ButtonGroup}
     */
    static from(data, {
        exclusive = false,
        name= null,
        checked = null,
        disabled = null,
        decheckable = false,
        label = null
    } = {}) {
        if (Array.isArray(data)) {
            data = Object.fromEntries(data.map(x => [x, x]));
        }

        const values = Object.keys(data);
        const type = exclusive ? "radio" : "checkbox";
        name ??= this.generateName();

        const container = DOMHelper.getTemplate("buttonGroupContainer");

        if (exclusive) {
            container.setAttribute("role", "radiogroup");

            if (typeof checked === "string") {
                checked = [checked];
            }

            if (!decheckable && !checked) {
                checked = [values[0]];
            }
        }

        checked = ObjectHelper.subsetToBoolRecord(checked ?? "none", values);
        disabled = ObjectHelper.subsetToBoolRecord(disabled ?? "none", values);

        for (const [value, displayName] of Object.entries(data)) {
            const [input, label] = DOMHelper.button(type, value, displayName);

            input.name = exclusive ? name : `${name}_${value}`;
            input.disabled = disabled[value];
            input.checked = checked[value];

            container.append(input, label);
        }

        if (exclusive && decheckable) {
            container.addEventListener("click", (e) => {
                if (e.target.tagName === "INPUT" && e.target.checked) {
                    e.target.checked = false;
                }
            });
        }

        const group = new this(container, exclusive, decheckable);
        if (label) {
            group.label(label);
        }

        return group;
    }

    static generateName() {
        this.nameCount++;
        return "buttongroup_" + this.nameCount.toString().padStart(4, "0");
    }

    observerArgs() {
        return [this.value];
    }

    buttonCount() {
        return Object.keys(this.inputs).length;
    }

    /**
     * @param {boolean | null} checked
     */
    disableIfSingleButton(checked = null) {
        if (this.buttonCount() === 1) {
            this.setDisabled(true);
            if (checked !== null) {
                this.value = checked ? Object.keys(this.inputs) : [];
            }
        } else {
            this.setDisabled(false);
        }
    }

    get value() {
        if (this.exclusive) {
            for (const input of Object.values(this.inputs)) {
                if (input.checked) {
                    return input.value;
                }
            }
            return null;
        }

        return ObjectHelper.filterKeys(this.inputs, input => input.checked);
    }

    /**
     * @param {string|string[]|Record<string,boolean>} checked
     */
    set value(checked) {
        if (this.exclusive && typeof checked === "string") {
            this.inputs[checked].checked = true;
        } else {
            checked = ObjectHelper.subsetToBoolRecord(checked, Object.keys(this.inputs));
            for (const [key, input] of Object.entries(this.inputs)) {
                input.checked = checked[key];
            }
        }
    }

    /**
     * @param {boolean} disabled
     */
    setDisabled(disabled) {
        for (const input of Object.values(this.inputs)) {
            input.disabled = disabled;
        }
    }

    /**
     * @param labelString
     */
    label(labelString) {
        const legendElement = document.createElement("LEGEND");
        legendElement.textContent = labelString;
        this.node.prepend(legendElement);
    }

    remove() {
        this.node.addEventListener("change", this._onChange);
        this.node.remove();
    }
}
