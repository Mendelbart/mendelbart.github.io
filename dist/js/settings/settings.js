import {FunctionStack, ObjectHelper, DOMHelper} from "../helpers/helpers.js";

/**
 * @interface Setting
 *//**
 * @name Setting#value
 *//**
 * @type {HTMLElement}
 * @name Setting#node
 *//**
 * @type {FunctionStack}
 * @name Setting#updateListeners
 *//**
 * @function
 * @name Setting#setDisabled
 * @param {boolean} disabled
 *//**
 * @function
 * @name Setting#label
 * @param {string} labelString
 *//**
 * @function
 * @name Setting#remove
 */

/** @class SettingsCollection */
export class SettingsCollection {
    constructor() {
        /**
         * @type {Record<string, Setting>}
         */
        this.settings = {};
        /**
         * @type {string[]}
         */
        this.keys = [];
    }

    /**
     * @param {Record<string,Setting>} settings
     * @param {?string[]} [orderedKeys]
     * @returns {SettingsCollection}
     */
    static createFrom(settings, orderedKeys = null) {
        const collection = new this();
        collection.put(settings, orderedKeys);
        return collection;
    }

    /**
     *
     * @param {Record<string,Setting>} settings
     * @param {?string[]} [orderedKeys]
     */
    put(settings, orderedKeys = null) {
        orderedKeys ??= Object.keys(settings);
        for (const key of orderedKeys) {
            this.add(key, settings[key]);
        }
    }

    /**
     * @param {SettingsCollection} sc
     */
    extend(sc) {
        this.put(sc.settings, sc.keys);
    }

    /**
     * @param {string} key
     * @param {Setting} setting
     * @param {"begin"|"end"|"beforeKey"|"afterKey"} [position] default "end"
     * @param {?string} [anchorKey]
     */
    add(key, setting, position = "end", anchorKey = null) {
        this.settings[key] = setting;
        if (position === "end") {
            this.keys.push(key);
        } else {
            let index;
            if (position === "begin") {
                index = 0;
            } else {
                index = this.keys.indexOf(anchorKey);
                if (position === "afterKey") {
                    index++;
                } else if (position !== "beforeKey") {
                    console.error("Invalid insert setting insert position.")
                }
            }

            this.keys.splice(index, 0, key);
        }
    }

    /**
     * @param {string} key
     */
    remove(key) {
        this.settings[key].remove();
        delete this.settings[key];
    }

    removeAll() {
        for (const setting of Object.values(this.settings)) {
            setting.remove();
        }
        this.settings = {};
        this.keys = [];
    }

    /**
     * Replace the setting at the given `key` with a new setting.
     * @param key
     * @param setting
     */
    replace(key, setting) {
        this.settings[key].node.replaceWith(setting.node);
        this.settings[key] = setting;
    }

    getValues() {
        return ObjectHelper.map(this.settings, setting => setting.value);
    }

    setValues(values) {
        for (const [key, value] of Object.entries(values)) {
            this.settings[key].value = value;
        }
    }

    /**
     * @param {string} key
     */
    getValue(key) {
        return this.settings[key].value;
    }

    /**
     * @param {string} key
     * @returns {HTMLElement}
     */
    getNode(key) {
        return this.settings[key].node;
    }

    /**
     * @param {string} key
     * @returns {Setting}
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * @returns {HTMLElement[]}
     */
    nodeList() {
        return this.keys.map(key => this.settings[key].node);
    }

    /**
     * @param {?string | string[]} keys
     * @param {function} listeners
     *
     * @example collection.addUpdateListener((value) => console.log(value));
     * @example collection.addUpdateListener("firstSettingKey", (value) => console.log(value));
     */
    addUpdateListener(keys, ...listeners) {
        if (typeof keys === "function") {
            for (const setting of Object.values(this.settings)) {
                setting.updateListeners.push(keys, ...listeners);
            }
        } else {
            if (typeof keys === "string") {
                keys = [keys];
            }
            for (const key of keys) {
                this.settings[key].updateListeners.push(...listeners);
            }
        }
    }
}

/** @implements Setting */
export class ValueElement {
    static idCount = 0;
    static updateEvent = "change"
    /** @type {HTMLDivElement} */
    node
    /** @type {HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement} */
    valueNode

    /**
     * @param {HTMLElement} node
     */
    constructor(node) {
        let valueNode;
        if (this.constructor.isValueNode(node)) {
            valueNode = node;
        } else {
            valueNode = node.querySelector("input, textarea, select");
            if (!this.constructor.isValueNode(valueNode)) {
                throw new Error("Couldn't find element of type input, textarea or select.");
            }
        }

        this.node = DOMHelper.createElement("div.setting.labeled-value-element");
        this.node.append(node);
        this.valueNode = valueNode;
        this.updateListeners = new FunctionStack();

        this._onChange = this._onChange.bind(this);

        this.valueNode.addEventListener(this.constructor.updateEvent, this._onChange);
    }

    /**
     * @param {string} type
     * @param {?string} [label]
     * @param {?Record<string,string>} [attrs]
     * @returns {ValueElement}
     */
    static createInput(type, label = null, attrs = null) {
        const input = document.createElement("INPUT");
        input.type = type;
        if (attrs) {
            DOMHelper.setAttrs(input, attrs);
        }
        const ve = new this(input);

        if (label) {
            ve.label(label);
        }
        return ve;
    }

    /**
     * @param {Record<string,string>} data
     * @param {{selected?, disabled?, groups?, id?, label?}} options
     */
    static createSelect(data, options = {}) {
        const select = document.createElement("select");
        DOMHelper.setOptions(select, data, options);

        const ve = new this(select);
        if (options.id) {
            ve.setId(options.id);
        }
        if (options.label) {
            ve.label(options.label);
        }

        return ve;
    }

    /**
     * @param {HTMLElement} node
     */
    static isValueNode(node) {
        const tag = node.tagName;
        return tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && node.type !== "hidden");
    }

    isCheckbox() {
        return this.valueNode.tagName === "INPUT" && this.valueNode.type === "checkbox";
    }

    get value() {
        return this.isCheckbox() ? this.valueNode.checked : this.valueNode.value;
    }

    set value(value) {
        if (this.isCheckbox()) {
            this.valueNode.checked = value;
        } else {
            this.valueNode.value = value;
        }
    }

    _onChange() {
        this.updateListeners.call(this, this.value);
    }

    setDisabled(disabled) {
        this.valueNode.disabled = disabled;
    }

    /**
     * @param {string | {prefix}} data
     * @returns {string}
     */
    setId(data = {prefix: ""}) {
        const id = typeof data === "string" ? data : this.constructor.generateId(data.prefix);
        this.valueNode.id = id;
        const labelElement = this.node.querySelector("label");
        if (labelElement) {
            labelElement.htmlFor = id;
        }
        return id;
    }

    static generateId(prefix = "") {
        return "ve_" + prefix + this.idCount.toString().padStart(4, "0");
    }

    /**
     * @param {string} labelString
     */
    label(labelString) {
        if (!labelString) return;

        let labelElement = this.node.querySelector("label");
        if (!labelElement) {
            labelElement = document.createElement("label");

            if (!this.valueNode.id) {
                this.setId();
            }
            labelElement.htmlFor = this.valueNode.id;

            this.node.prepend(labelElement);
        }

        labelElement.textContent = labelString;
    }

    remove() {
        this.valueNode.removeEventListener(this.constructor.updateEvent, this._onChange);
        this.node.remove();
    }
}

DOMHelper.registerTemplate("buttonGroupContainer", DOMHelper.createElement("fieldset.button-group"));

/** @implements Setting */
export class ButtonGroup {
    static nameCount = 0

    /** @type {HTMLFieldSetElement} */
    node
    /** @type {Record<string, HTMLInputElement>} */
    inputs

    /**
     * @param {HTMLFieldSetElement} node
     * @param {boolean} exclusive
     * @param {boolean} [decheckable=false]
     */
    constructor(node, exclusive, decheckable = false) {
        this.node = node;
        this.updateListeners = new FunctionStack();

        this.inputs = Object.fromEntries(
            Array.from(this.node.querySelectorAll("INPUT")).map(input => [input.value, input])
        );
        this.exclusive = exclusive;
        this.decheckable = decheckable;

        this._onChange = this._onChange.bind(this);
        this.node.addEventListener("change", this._onChange);
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

    /**
     * @private
     */
    _onChange() {
        this.updateListeners.call(this, this.value);
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
        if (this.exclusive && !this.decheckable) {
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
        checked = ObjectHelper.subsetToBoolRecord(checked, Object.keys(this.inputs));
        for (const [key, input] of Object.entries(this.inputs)) {
            input.checked = checked[key];
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

DOMHelper.registerTemplate("slider", `<div class="slider-container">
    <span class="range-min"></span><span class="range-value"></span><span class="range-max"></span>
    <input type="range" class="form-range">
</div>`);

/** @implements Setting */
export class Slider extends ValueElement {
    static updateEvent = "input";
    /**
     * @param {HTMLElement} node
     * @param {number} min
     * @param {number} max
     */
    constructor(node, min, max) {
        super(node);
        if (this.valueNode.tagName !== "INPUT" || this.valueNode.type !== "range") {
            throw new Error("Couldn't find input type='range' element.");
        }

        this.min = min;
        this.max = max;

        this.displayValue = this.displayValue.bind(this);
        this.updateProgress = this.updateProgress.bind(this);
        this.displayMinMax();
    }

    /**
     * @param {number} min
     * @param {number} max
     * @param {?number} [value] default min
     */
    static create(min, max, value = null) {
        const node = DOMHelper.getTemplate("slider");
        const input = node.lastElementChild;
        input.min = min;
        input.max = max;
        input.setAttribute("step", 1);

        const slider = new this(node, min, max);
        if (value !== null) {
            slider.value = value;
        }

        return slider;
    }

    _onChange() {
        super._onChange();
        this.updateProgress();
        this.displayValue();
    }

    updateProgress() {
        this.valueNode.style.setProperty("--range-progress", this.getProgress().toString());
    }

    getProgress() {
        return (this.value - this.min) / (this.max - this.min);
    }

    displayValue() {
        this.node.querySelector(".range-value").textContent = this.formatValue(this.value);
    }

    displayMinMax() {
        this.node.querySelector(".range-min").textContent = this.formatValue(this.min);
        this.node.querySelector(".range-max").textContent = this.formatValue(this.max);
    }

    isCheckbox() {
        return false;
    }

    /**
     * @param {number} value
     */
    set value(value) {
        if (this.min > value || this.max < value) {
            console.warn("Slider value outside range.");
        }
        super.value = value.toString();
        this.displayValue();
        this.updateProgress();
    }

    get value() {
        return parseFloat(this.valueNode.value);
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
            this._onChange();
        }
        this.min = min;
        this.valueNode.min = min;
        this.updateProgress();
        this.displayMinMax();
    }

    setMax(max) {
        if (this.valueNode.value > max) {
            this.valueNode.value = max;
            this._onChange();
        }
        this.max = max;
        this.valueNode.max = max;
        this.updateProgress();
        this.displayMinMax();
    }
}
