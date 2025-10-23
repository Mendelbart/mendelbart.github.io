import {ObjectHelper} from "../helpers/helpers.js";

const valueNodeTagNames = ["INPUT", "SELECT", "TEXTAREA"];
const valueNodeQuery = valueNodeTagNames.join(", ");


export class ValueElement {
    static nameCount = 0
    defaultUpdateEvent = "change"
    value

    /**
     *
     * @param node {HTMLElement}
     */
    constructor (node) {
        this.node = node;
        this.updateListeners = [];
    }

    setup(updateEvent = this.defaultUpdateEvent) {
        this.readValue();
        this.setupValueUpdate(updateEvent);
    }

    addUpdateListener(listener) {
        this.updateListeners.push(listener);
    }

    removeUpdateListener(listener) {
        const index = this.updateListeners.indexOf(listener);
        if (index > -1) {
            this.updateListeners.splice(index, 1);
        }
    }

    runUpdateListeners(...args) {
        for (const listener of this.updateListeners) {
            listener(this.value, ...args);
        }
    }

    isCheckbox() {
        return false;
    }

    getValue() {
        return this.value;
    }

    readValue() {console.error("Not Implemented")}
    setValue() {console.error("Not Implemented")}
    setupValueUpdate() {console.error("Not Implemented")}
    labelForElement() {
        return this.node;
    }

    static generateName(prefix = "") {
        this.nameCount++;
        return "ve_" + prefix + this.nameCount;
    }

    /**
     * @param {boolean} disabled
     */
    setDisabled(disabled) {console.error("Not Implemented")}
}

export class SingleNodeValueElement extends ValueElement {
    constructor(node) {
        super(node);

        if (valueNodeTagNames.includes(this.node.tagName)) {
            this.valueNode = this.node;
        } else {
            this.valueNode = this.node.querySelector(valueNodeQuery);
        }
    }

    isCheckbox() {
        return this.valueNode.tagName === "INPUT" && this.valueNode.type === "checkbox";
    }

    readValue() {
        if (this.isCheckbox()) {
            this.value = this.valueNode.checked;
        } else {
            this.value = this.valueNode.value;
        }
    }

    setValue(value) {
        if (this.isCheckbox()) {
            this.valueNode.checked = value;
        } else {
            this.valueNode.value = value;
        }
        this.readValue();
    }

    setupValueUpdate(updateEvent = "change") {
        this.valueNode.addEventListener(updateEvent, () => {
            this.readValue();
            this.runUpdateListeners();
        });
    }

    labelForElement() {
        return this.valueNode;
    }

    setDisabled(disabled) {
        this.valueNode.disabled = disabled;
    }
}

export class ButtonGroup extends ValueElement {
    constructor(node, exclusive, decheckable = false) {
        super(node);
        /**
         * @type {Record<string, HTMLInputElement>}
         */
        this.inputs = Object.fromEntries(
            Array.from(this.node.querySelectorAll("INPUT")).map(input => [input.value, input])
        );
        this.exclusive = exclusive;
        this.decheckable = decheckable;
    }

    buttonCount() {
        return Object.keys(this.inputs).length;
    }

    isCheckbox() {
        return false;
    }

    readValue() {
        if (this.exclusive && !this.decheckable) {
            for (const input of Object.values(this.inputs)) {
                if (input.checked) {
                    this.value = input.value;
                    return;
                }
            }
            this.value = null;
            return;
        }

        this.value = ObjectHelper.map(this.inputs, input => input.checked);
    }

    getValue() {
        if (this.exclusive) {
            return this.value;
        }
        return ObjectHelper.filterKeys(this.value, x => x);
    }

    setupValueUpdate(updateEvent = "change") {
        if (this.exclusive) {
            for (const [key, input] of Object.entries(this.inputs)) {
                input.addEventListener(updateEvent, () => {
                    this.value = key;
                    this.runUpdateListeners(key);
                });
            }
        } else {
            for (const [key, input] of Object.entries(this.inputs)) {
                input.addEventListener(updateEvent, () => {
                    this.value[key] = input.checked;
                    this.runUpdateListeners(key, input.checked);
                });
            }
        }
    }

    /**
     * @param {string|string[]|Record<string,boolean>} checked
     */
    setValue(checked) {
        checked = ObjectHelper.subsetToBoolRecord(checked, Object.keys(this.inputs));
        for (const [key, input] of Object.entries(this.inputs)) {
            input.checked = checked[key];
        }
    }

    setDisabled(disabled) {
        for (const input of Object.values(this.inputs)) {
            input.disabled = disabled;
        }
        this.node.setAttribute("aria-disabled", disabled.toString());
    }

    disableIfSingleButton() {
        this.setDisabled(this.buttonCount() === 1);
    }
}

export class Slider extends SingleNodeValueElement {
    defaultUpdateEvent = "input";

    /**
     * @param {HTMLElement} node
     * @param {number} min
     * @param {number} max
     */
    constructor(node, min, max) {
        super(node);
        this.min = min;
        this.max = max;
    }

    setup(updateEvent = this.defaultUpdateEvent) {
        super.setup(updateEvent);
        this.setupRangeCSS();
        this.setupSpans();
    }

    setupSpans() {
        this.addUpdateListener(this.displayValue.bind(this));
        this.readValue();
        this.displayValue();
    }

    setupRangeCSS() {
        const listener = () => {
            this.valueNode.style.setProperty("--range-progress", this.getProgress().toString());
        }
        listener();
        this.addUpdateListener(listener);
    }

    getProgress() {
        return (this.valueNode.value - this.min) / (this.max - this.min);
    }

    displayValue() {
        this.node.querySelector(".range-value").innerText = this.formatValue(this.value);
    }

    /**
     * @param {number} value
     */
    setValue(value) {
        if (this.min > value || this.max < value) {
            console.warn("Slider value outside range.");
        }
        this.valueNode.value = value.toString();
        this.readValue();
        this.displayValue();
    }

    readValue() {
        this.value = parseInt(this.valueNode.value);
    }

    /**
     * @param {number} value
     * @returns {string}
     */
    formatValue(value) {
        return (Math.round(value * 100) / 100).toString();
    }

    setMin(min) {
        if (this.valueNode.value < min) {
            this.valueNode.value = min;
            this.readValue();
            this.runUpdateListeners();
        }
        this.min = min;
        this.valueNode.min = min;
    }

    setMax(max) {
        if (this.valueNode.value > max) {
            this.valueNode.value = max;
            this.readValue();
            this.runUpdateListeners();
        }
        this.max = max;
        this.valueNode.max = max;
    }
}
