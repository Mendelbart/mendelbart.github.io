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
            return this.value = this.valueNode.checked;
        } else {
            return this.value = this.valueNode.value;
        }
    }

    setValue(value) {
        this.valueNode.value = value;
        this.value = value;
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
                    return this.value = input.value;
                }
            }
            return null;
        }

        return this.value = ObjectHelper.map(this.inputs, input => input.checked);
    }

    getListValue() {
        return ObjectHelper.filterKeys(this.value, x => x);
    }

    setupValueUpdate(updateEvent = "change") {
        if (this.exclusive) {
            for (const [key, input] of Object.entries(this.inputs)) {
                input.addEventListener(updateEvent, () => {
                    this.value = key;
                    this.runUpdateListeners();
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
     * @param {string} key
     * @param {boolean} checked
     */
    setChecked(key, checked) {
        this.inputs[key].checked = checked;
    }

    /**
     * @param {string} checked
     */
    setValue(checked) {
        if (this.exclusive) {
            this.setChecked(checked, true);
        } else {
            if (Array.isArray(checked)) {
                const objValue = ObjectHelper.map(this.inputs, () => false);
                for (const key of checked) {
                    objValue[key] = true;
                }
            }

            for (const [key, input] of Object.entries(this.inputs)) {
                input.checked = checked[key];
            }
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
     * @param {number} nSteps
     * @param {number} digits
     */
    constructor(node, min, max, nSteps, digits) {
        super(node);
        this.min = min;
        this.max = max;
        this.nSteps = nSteps;
        this.digits = digits;
    }

    setup(updateEvent = this.defaultUpdateEvent) {
        super.setup(updateEvent);
        this.setupRangeCSS();
        this.setupSpans();
    }

    setupSpans() {
        for (const key of ["min", "max"]) {
            this.node.querySelector(`.range-${key}`).innerText = this.formatValue(this[key]);
        }
        this.addUpdateListener(() => {
            this.displayValue();
        });
    }

    setupRangeCSS() {
        const listener = () => {
            this.valueNode.style.setProperty("--range-progress", (this.valueNode.value / this.nSteps).toString());
        }
        listener();
        this.addUpdateListener(listener);
    }

    displayValue() {
        this.node.querySelector(".range-value").innerText = this.formatValue(this.value);
    }

    /**
     * @param {number} value
     */
    setValue(value) {
        const inputValue= this.valueToStep(value);
        this.valueNode.value = inputValue.toString();
        this.value = this.stepToValue(inputValue);
        this.displayValue();
    }

    readValue() {
        return this.value = this.stepToValue(this.valueNode.value);
    }

    /**
     * @param {number} value
     * @param {string} [point]
     * @returns {string}
     */
    formatValue(value, point = ".") {
        const scaledInt = String(Math.round(value * Math.pow(10, this.digits)));
        if (this.digits <= 0) {
            return scaledInt;
        }

        return scaledInt.slice(0, -this.digits) + point + scaledInt.slice(-this.digits);
    }

    /**
     * @param {number} step
     * @returns {number}
     */
    stepToValue(step) {
        return this.min + (this.max - this.min) * step / this.nSteps;
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    valueToStep(value) {
        return Math.round(this.nSteps * (value - this.min) / (this.max - this.min));
    }

    setMin(min) {
        const value = this.value;
        this.min = min;
        this.setValue(Math.max(value, min));
        this.readValue();
        this.runUpdateListeners();
    }

    setMax(max) {
        const value = this.value;
        this.max = max;
        this.setValue(Math.min(value, max));
        this.readValue();
        this.runUpdateListeners();
    }

    /**
     * @param {number} min
     * @param {number} max
     * @param {number} digits
     * @param {Object} [options]
     * @returns number
     */
    static calculateNSteps(min, max, digits, options = {}) {
        if ("nSteps" in options)
            return options.nSteps;
        if ("stepSize" in options)
            return this.nStepsFromStepSize(min, max, options.stepSize)

        return this.defaultNSteps(min, max, digits);
    }

    static nStepsFromStepSize(min, max, stepSize) {
        return Math.round((max - min) / stepSize);
    }

    static defaultNSteps(min, max, digits) {
        return Math.round(Math.pow(10, digits) * (max - min));
    }
}


export class LogarithmicSlider extends Slider {
    static nStepsFromStepSize(min, max, stepSize) {
        return (Math.log(max) - Math.log(min)) / Math.log(stepSize);
    }

    stepToValue(step) {
        return this.min * Math.pow(this.max / this.min, step / this.nSteps);
    }

    valueToStep(value) {
        return Math.log(value / this.min) / Math.log(this.max / this.min) * this.nSteps;
    }

    static defaultNSteps(min, max, stepSize) {
        return 500;
    }
}
