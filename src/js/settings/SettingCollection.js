import Observable from "../helpers/classes/Observable";


export default class SettingCollection extends Observable {
    constructor() {
        super();
        /**
         * @type {Map<*, Setting>}
         */
        this.map = new Map();
    }

    /**
     * @param {Map<string,Setting>} settings
     * @returns {SettingCollection}
     */
    static createFrom(settings) {
        const collection = new this();
        collection.put(settings);
        return collection;
    }

    /**
     * @param key
     * @returns {Setting}
     */
    get(key) {
        return this.map.get(key);
    }

    has(key) {
        return this.map.has(key);
    }

    /**
     *
     * @param {Map<*,Setting> | Record<string, Setting>} settings
     */
    put(settings) {
        if (!(settings instanceof Map)) {
            settings = new Map(Object.entries(settings));
        }

        for (const [key, setting] of settings) {
            this.add(key, setting);
        }
    }

    /**
     * @param {string} key
     * @param {Setting} setting
     */
    add(key, setting) {
        if (this.has(key)) {
            throw new Error(`Key ${key} already in setting.`);
        }

        this.map.set(key, setting);
        setting.observers.push(() => this.observers.call(this.getValues(), key));
    }

    /**
     * @param {string} key
     */
    remove(key) {
        this.map.get(key).remove();
        delete this.map.delete(key);
    }

    removeAll() {
        this.map.clear();
    }
    /**
     * Replace the setting at the given `key` with a new setting.
     * @param key
     * @param setting
     */
    replace(key, setting) {
        this.get(key).node.replaceWith(setting.node);
        this.get(key).remove();
        this.set(key, setting);
    }

    /**
     * @param {SettingCollection} settingsCollection
     */
    replaceSelf(settingsCollection) {
        this.removeAll();
        this.put(settingsCollection.map);
    }

    /**
     * @returns {Record<string, *>}
     */
    getValues() {
        const values = {};
        for (const [key, setting] of this.map) {
            values[key] = setting.value;
        }
        return values;
    }

    /**
     * @param {Record<string, *>} values
     */
    setValues(values) {
        for (const [key, value] of Object.entries(values)) {
            if (this.has(key)) {
                this.get(key).value = value;
            }
        }
    }

    /**
     * @param {string} key
     */
    getValue(key) {
        if (!this.has(key)) {
            throw new Error("Key not in settings collection.");
        }
        return this.get(key).value;
    }

    /**
     * @param {string} key
     * @param {any} [defaultValue=null]
     */
    getDefault(key, defaultValue = null) {
        return this.has(key) ? this.get(key).value : defaultValue;
    }

    /**
     * @param {string} key
     * @returns {HTMLElement}
     */
    getNode(key) {
        return this.get(key).node;
    }

    /**
     * @returns {HTMLElement[]}
     */
    nodeList() {
        return Array.from(this.map.values()).map(setting => setting.node);
    }

    addObserverTo(key, ...observers) {
        this.get(key).observers.push(...observers);
    }

    observerArgs() {
        return [this.getValues()];
    }
}
