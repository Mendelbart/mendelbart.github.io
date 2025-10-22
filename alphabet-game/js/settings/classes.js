import {DOMHelper as DH, ObjectHelper as OH} from "../helpers/helpers.js";

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
     *
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
        this.settings[key].node.remove();
        delete this.settings[key];
    }

    removeAll() {
        for (const setting of Object.values(this.settings)) {
            setting.node.remove();
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
        return OH.map(this.settings, setting => setting.getValue());
    }

    setValues(values) {
        for (const [key, value] of Object.entries(values)) {
            this.settings[key].setValue(value);
        }
    }

    /**
     * @param {string} key
     */
    getValue(key) {
        return this.settings[key].getValue();
    }
    
    nodeList() {
        return this.keys.map(key => this.settings[key].node);
    }
}


export class Setting {
    static idCounter = 0;

    /**
     * @param {HTMLElement} node
     * @param {ValueElement} valueElement
     * @param {HTMLElement} labelElement
     */
    constructor(node, valueElement, labelElement) {
        this.node = node;
        this.valueElement = valueElement;
        this.labelElement = labelElement;

        this.valueElement.setup();
    }

    /**
     * @param {string} labelString
     * @param {ValueElement} valueElement
     * @param {boolean} [labelRight]
     * @param {?string} [id]
     * @param {string} [idPrefix]
     * @returns {Setting}
     */
    static create(labelString, valueElement, {labelRight = false, id = null, idPrefix = ""} = {}) {
        const node = DH.getTemplate("setting");
        const labelElement = document.createElement("LABEL");

        labelElement.textContent = labelString;

        id ??= this.generateID(idPrefix);
        labelElement.setAttribute("for", id);
        valueElement.labelForElement().setAttribute("id", id);

        if (labelRight) {
            node.append(valueElement.node, labelElement);
            DH.addClass(node, "setting-label-right");
        } else {
            node.append(labelElement, valueElement.node);
        }
        return new this(node, valueElement, labelElement);
    }

    getValue() {
        return this.valueElement.value;
    }

    setValue(value) {
        this.valueElement.setValue(value);
    }

    /**
     *
     * @param {string} [prefix]
     * @returns {string}
     */
    static generateID(prefix = "") {
        this.idCounter++;
        return "setting-" + prefix + this.idCounter;
    }

    /**
     * @param {boolean} disabled
     */
    setDisabled(disabled) {
        this.valueElement.setDisabled(disabled);
    }
}