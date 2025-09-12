import {DOMHelper, ObjectHelper} from "./helpers.js";

const inputTagNames = ["INPUT", "SELECT", "TEXTAREA"];
const inputTagsQuery = inputTagNames.join(", ");

/**
 * @typedef {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} ValueElement
 */

export class Settings {
    /**
     * @param {HTMLElement} node
     * @param {Object.<string,Setting>} settings
     * @param {Object.<string,HTMLElement>} labels
     * @param {string[]} [keys] 
     */
    constructor(node, settings, labels, keys = null) {
        this.node = node;
        this.settings = settings;
        this.labels = labels;
        this.keys = keys ?? Object.keys(this.settings);
    }

    /**
     * @param {Object.<string, Setting>} settings 
     * @param {Object.<string, string>} labelContents 
     * @param {string[]} [keys] 
     * @param {?string} [idPrefix]
     * @returns {Settings}
     */
    static fromSettingsLabelContents(settings, labelContents, keys = null, idPrefix = null) {
        const labels = this.createLabels(settings, labelContents, keys, idPrefix);
        return this.fromSettingsLabels(settings, labels, keys);
    }

    /**
     * @param {Object.<string, Setting>} settings 
     * @param {Object.<string, HTMLElement>} labels
     * @param {string[]} [keys] 
     * @returns {Settings}
     */
    static fromSettingsLabels(settings, labels, keys = null) {
        keys ??= Object.keys(settings);
        const node = document.createElement("DIV");
        DOMHelper.addClass(node, "settings");

        let children;
        for (const key of keys) {
            children = [labels[key], settings[key].node];
            if (settings[key].labelRight) {
                children = children.reverse();
            }
            DOMHelper.appendChildren(node, children);
        }

        return new this(node, settings, labels, keys)
    }

    /**
     * @param {Object.<string, Setting>} settings 
     * @param {Object.<string, string>} labelContents 
     * @param {?(string[])} [keys]
     * @param {?string} [idPrefix]
     * @returns {Object.<string, HTMLElement>}
     */
    static createLabels(settings, labelContents, keys = null, idPrefix = null) {
        keys ??= Object.keys(settings);
        idPrefix ??= DOMHelper.uniqueIdPrefix("settings");

        const labels = {};
        for (const key of keys) {
            labels[key] = DOMHelper.label(settings[key].node, labelContents[key], idPrefix + key);
            labels[key].classList.add("setting-label");
        }

        return labels;
    }

    /**
     * @param {Object.<string,SettingData>} data
     * @param {string[]} [keys]
     * @param {?string} idPrefix
     * @returns {Settings}
     */
    static fromData(data, keys = null, idPrefix = null) {
        keys ??= Object.keys(data);
        const settings = objectMap(data, (settingData) => Setting.fromData(settingData));
        const labelContents = objectMap(data, this.getSettingLabel);
        return this.fromSettingsLabelContents(settings, labelContents, keys, idPrefix);
    }

    /**
     * @param {string} key 
     * @returns {Setting}
     */
    getSetting(key) {
        return this.settings[key];
    }

    /**
     * @returns {Array<[string, Setting]>}
     */
    entries() {
        return this.keys.map(key => [key, this.getSetting(key)]);
    }

    /**
     * @returns {Object<string,any>}
     */
    values() {
        return objectMap(this.settings, (setting) => setting.value);
    }

    /**
     * @param {function(Object<string,any>): void} fn 
     */
    addUpdateListener(fn) {
        const listener = () => {
            fn(this.values());
        };
        for (const key of this.keys) {
            this.getSetting(key).addUpdateListener(listener);
        }
    }


    /**
     * @param {Setting} setting 
     * @param {HTMLElement | string} label
     * @param {string} key 
     * @param {?string} [idPrefix]
     */
    push(setting, label, key, idPrefix = null) {
        idPrefix ??= DOMHelper.uniqueIdPrefix("setting");
        if (key in this.settings) {
            console.error("pushSetting: key already exists.");
        }
        this.settings[key] = setting;

        if (typeof label === "string") {
            label = DOMHelper.label(setting.node, label, idPrefix + key);
        }

        this.labels[key] = label;
        this.keys.push(key);
    }

    /**
     * @param {SettingData} data
     * @param {string} key 
     * @param {?string} [idPrefix]
     */
    pushFromData(data, key, idPrefix = null) {
        const label = this.constructor.getSettingLabel(data, key);
        const setting = Setting.fromData(data);
        this.push(setting, label, key, idPrefix);
    }

    /**
     * @param {Settings} settings 
     */
    append(settings) {
        for (const key of settings.keys) {
            if (this.keys.includes(key)) {
                console.error("appendSettings: key already exists.");
            }
            this.settings[key] = settings.settings[key];
            this.labels[key] = settings.labels[key];
        }
        this.keys.push(...settings.keys);
    }

    /**
     * 
     * @param {Object.<string, SettingData>} data
     * @param {string[]} [keys] 
     * @param {?string} [idPrefix]
     */
    appendFromData(data, keys = null, idPrefix = null) {
        this.append(this.constructor.fromData(data, keys, idPrefix));
    }

    /**
     * @param {string} key 
     */
    removeSetting(key) {
        this._removeSettingObject(key);
        this.keys.splice(this.keys.indexOf(key), 1);
    }

    /**
     * @param {string} key 
     */
    _removeSettingObject(key) {
        if (!(key in this.settings)) {
            console.error("key does not exist.");
            return;
        }
        this.labels[key].remove();
        this.settings[key].node.remove();
        delete this.settings[key];
        delete this.labels[key];
    }


    /**
     * @param {string} key 
     * @param {boolean} includingKey - If true, remove the setting with the given `key` too. 
     */
    removeAllSettingsAfter(key, includingKey = false) {
        let index = this.keys.indexOf(key);
        if (!includingKey) index++;
        
        for (let i = index; i < this.keys.length; i++) {
            this._removeSettingObject(this.keys[i]);
        }
        this.keys.splice(index);
    }

    /**
     * @param {Object} settingData 
     * @param {string} key 
     * @returns {string}
     */
    static getSettingLabel(settingData, key) {
        return settingData.label ?? key;
    }
}


export class Setting {
    valueObjectQuery = inputTagsQuery;
    updateEvent = "change";
    labelRight = false;

    /**
     * Create a settings instance.
     * @param {HTMLElement} node
     */
    constructor(node) {
        this.node = node;
        this.updateListeners = [];
    }

    setup() {
        this.update();
        this.boundUpdater = this.updater.bind(this);
        this.setupUpdater(this.updateEvent);
    }

    /**
     * @param {string} updateEvent 
     */
    setupUpdater(updateEvent = this.updateEvent) {
        this.valueObject().addEventListener(updateEvent, this.boundUpdater);
    }

    /**
     * @returns {ValueElement}
     */
    valueObject() {
        if (this.node.matches(this.valueObjectQuery)) {
            return this.node;
        }
        return this.node.querySelector(this.valueObjectQuery);
    }

    update() {
        this.value = this.readValue();
    }

    /**
     * @param {Function} fn 
     */
    addUpdateListener(fn) {
        this.updateListeners.push(fn);
    }

    /**
     * @param {Function} fn 
     */
    removeUpdateListener(fn) {
        const index = this.updateListeners.indexOf(fn);
        if (index === -1) {
            console.error("Function is not an update listener of this setting.");
        } else {
            this.updateListeners.splice(index, 1);
        }
    }

    updater() {
        this.update();
        this.runUpdateListeners();
    }

    runUpdateListeners() {
        for (const fn of this.updateListeners) {
            fn(this.value);
        }
    }

    readValue() {
        return this.valueObject().value;
    }

    setValue(value) {
        this.valueObject().value = value;
    }

    updateToValue(value) {
        this.setValue(value);
        this.updater();
    }

    /**
     * Create a setting using a select box.
     * @param {Object} options  `value => htmlcontent` pairs for <option> elements
     * @param {string} selected value of selected option
     * @param {string[]} [disabled] values of disabled options
     * @returns {Setting}
     */
    static createSelect(options, selected, disabled = null) {
        const select = document.createElement("SELECT");
        const optionElements = objectMap(options, (content, value) => {
            const option = document.createElement("OPTION");
            option.setAttribute("value", value);
            option.innerHTML = content;
            return option;
        });

        DOMHelper.setAttrOnKeys(optionElements, selected, "selected");
        DOMHelper.setAttrOnKeys(optionElements, disabled, "disabled");

        DOMHelper.appendChildren(select, optionElements);

        const setting = new this("single", selected, select);
        setting.setup();
        return setting;
    }

    /**
     * @param {Object.<string, any>} attrs
     * @returns {Setting}
     */
    static createInput(attrs) {
        const node = document.createElement("INPUT");
        DOMHelper.setAttrs(node, attrs);
        const setting = new this(node);
        setting.setup();
        return setting;
    }

    /**
     * @param {SettingData} data
     */
    static fromData(data) {
        switch(data.type) {
            case "select":
                return Setting.createSelect(...ObjectHelper.extractKeys(data, ["options", "selected", "disabled"]));
            case "checkboxes":
            case "radios":
                const args = ObjectHelper.extractKeys(data, ["labels", "checked", "disabled", "idPrefix"]);
                return data.type === "checkboxes" ? ButtonGroupSetting.create(...args) : RadioGroupSetting.create(...args);
            case "slider":
                return SliderSetting.create(...ObjectHelper.extractKeys(data, ["min", "max", "value"]));
            case "switch":
                return SwitchSetting.create(data.checked !== false, data);
            default:
                return Setting.createInput(data);
        }
    }
}

export class SwitchSetting extends Setting {
    labelRight = true;
    valueObjectQuery = "input[type=checkbox]";

    /**
     * @param {boolean} checked 
     * @param {Object} attrs
     */
    static create(checked, attrs) {
        if (checked) {
            attrs.checked = "checked";
        } else if ("checked" in attrs) {
            delete attrs.checked;
        }

        const node = DOMHelper.getTemplate("switch");
        DOMHelper.setAttrs(node, attrs);
        const setting = new this(node);
        setting.setup();
        return setting;
    }

    /**
     * @returns {boolean}
     */
    readValue() {
        return this.valueObject().checked;
    }

    /**
     * @param {boolean} checked
     */
    setValue(checked) {
        this.valueObject().checked = checked;
    }
}


export class ButtonGroupSetting extends Setting {
    static inputType = "checkbox";
    updateEvent = "change";
    valueObjectQuery = ".btn-group";

    /**
     * @param {HTMLElement} node
     * @param {Object.<string,HTMLInputElement>} inputs
     * @param {Object.<string,HTMLElement>} labels
     */
    constructor(node, inputs, labels) {
        super(node);
        this.inputs = inputs;
        this.labels = labels;
    }

    /**
     * @param {Object.<string,string>} labels 
     * @param {string[]} checked 
     * @param {string[]} [disabled] 
     * @param {?string} [idPrefix]
     */
    static create(labels, checked, disabled = null, idPrefix = null) {
        const setting = new this(...this.getConstructorArgs(labels, checked, disabled, idPrefix));
        setting.setup();
        return setting;
    }

    /**
     * @param {Object.<string,string>} labels
     * @param {?string[]} [checked]
     * @param {?string[]} [disabled]
     * @param {?string} [idPrefix]
     */
    static getConstructorArgs(labels, checked= null, disabled = null, idPrefix = null) {
        const node = DOMHelper.getTemplate("buttonGroupContainer");
        idPrefix ??= DOMHelper.uniqueIdPrefix("button");

        const inputs = {};
        const labelNodes = {};

        for (const [value, labelContent] of Object.entries(labels)) {
            const [label, input] = DOMHelper.button(
                this.inputType, value, labelContent, idPrefix + value
            );
            DOMHelper.appendChildren(node, [label, input]);

            inputs[value] = input;
            labelNodes[value] = label;
        }

        DOMHelper.setAttrOnKeys(inputs, checked, "checked");
        DOMHelper.setAttrOnKeys(inputs, disabled, "disabled");

        return [node, inputs, labelNodes];
    }

    setupUpdater(updateEvent = this.updateEvent) {
        for (const input of Object.values(this.inputs)) {
            input.addEventListener(this.updateEvent, this.boundUpdater);
        }
    }

    /**
     * @returns {string[]}
     */
    readValue() {
        return Object.keys(this.inputs).filter(value => this.inputs[value].checked);
    }

    /**
     * @param {string[]} checked
     */
    setValue(checked) {
        for (const [value, input] of Object.entries(this.inputs)) {
            input.checked = checked.includes(value);
        }
    }
}

export class RadioGroupSetting extends ButtonGroupSetting {
    static inputType = "radio";

    /**
     * @param {Object.<string,string>} labels
     * @param {?string} [checked]
     * @param {?string[]} [disabled]
     * @param {?string} [idPrefix]
     */
    static create(labels, checked = null, disabled = null, idPrefix = null) {
        checked ??= Object.keys(labels)[0];
        const setting = new this(...this.getConstructorArgs(labels, [checked], disabled, idPrefix));
        setting.setName(DOMHelper.uniqueIdPrefix("radio"));
        return setting;
    }

    /**
     * @param {string} name
     */
    setName(name) {
        for (const input of Object.values(this.inputs)) {
            input.name = name;
        }
    }

    /**
     * @returns {string}
     */
    readValue() {
        return super.readValue()[0];
    }

    /**
     * @param {string} value
     */
    setValue(value) {
        this.inputs[value].checked = true;
    }
}


/**
 * @typedef {Object} SliderOptions
 * @property {number} [digits]
 * @property {number} [nSteps]
 * @property {number} [stepSize]
 * @property {Object.<string,any>} [attrs] - Attributes for the `input[type=range] node
 */

export class SliderSetting extends Setting {
    updateEvent = "input";
    valueObjectQuery = "input[type=range]";

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

    /**
     * @param {number} min 
     * @param {number} max
     * @param {number} value
     * @param {?SliderOptions} options
     */
    static create(min, max, value, options = null) {
        const digits = options.digits ?? 0;
        const nSteps = this.calculateNSteps(min, max, digits, options);
        const node = DOMHelper.getTemplate("slider");
        const input = node.lastElementChild;
        DOMHelper.setAttrs(input, {
            min: 0,
            max: nSteps,
            step: 1
        });
        if (options.attrs)
            DOMHelper.setAttrs(input, options.attrs);

        const setting = new this(node, min, max, nSteps, digits);
        setting.setValue(value);
        setting.setupSpans();
        setting.setup();
        return setting;
    }

    /**
     * @param {number} min 
     * @param {number} max 
     * @param {number} digits 
     * @param {?{nSteps?: number, stepSize?: number}} [options]
     * @returns 
     */
    static calculateNSteps(min, max, digits, options = null) {
        if (options === null) {
            options = {};
        }
        if ("nSteps" in options) 
            return options.nSteps;
        if ("stepSize" in options) 
            return this.nStepsFromStepSize(min, max, options.stepSize);
        
        return this.defaultNSteps(min, max, digits);
    }

    /**
     * @param {number} min 
     * @param {number} max 
     * @param {number} stepSize 
     * @returns {number}
     */
    static nStepsFromStepSize(min, max, stepSize) {
        return Math.round((max - min) / stepSize);
    }

    /**
     * @param {number} min 
     * @param {number} max 
     * @param {number} digits 
     * @returns {number}
     */
    static defaultNSteps(min, max, digits) {
        return Math.round(Math.pow(10, digits) * (max - min));
    }

    /**
     * @param {number} value 
     */
    setValue(value) {
        const input = this.valueObject();
        const inputValue= this.valueToStep(value);
        input.value = inputValue.toString();
        this.value = this.stepToValue(inputValue);
    }

    setupSpans() {
        for (const key of ["min", "value", "max"]) {
            this.node.querySelector(`span.range-${key}`).innerText = this.formatValue(this[key]);
        }
        this.addUpdateListener((value) => {
            this.node.querySelector("span.range-value").innerText = this.formatValue(value);
        });
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
}


export class LogarithmicSliderSetting extends SliderSetting {
    static nStepsFromStepSize(min, max, stepSize) {
        return (Math.log(max) - Math.log(min)) / Math.log(stepSize);
    }

    stepToValue(step) {
        return this.min * Math.pow(this.max / this.min, step / this.nSteps);
    }

    valueToStep(value) {
        return Math.log(value / this.min) / Math.log(this.max / this.min) * this.nSteps;
    }
}
