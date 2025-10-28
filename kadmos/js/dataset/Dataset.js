import {ItemProperty, QuizItem} from "./symbol.js";
import {DOMHelper, ObjectHelper, ArrayHelper, FontHelper} from '../helpers/helpers.js';
import {Filterer} from "./filterer.js";
import {Setting, SettingsCollection, SettingsHelper as SH} from "../settings/settings.js";

export const DATASETS_METADATA = {
    elements: {name: "Atomic Elements", file: "./json/datasets/elements.json"},
    cyrillic: {name: "Cyrillic", file: "./json/datasets/cyrillic.json"},
    elder_futhark: {name: "Elder Futhark", file: "./json/datasets/elder_futhark.json"},
    greek: {name: "Greek", file: "./json/datasets/greek.json"},
    hebrew: {name: "Hebrew", file: "./json/datasets/hebrew.json"},
}
export const DEFAULT_DATASET = "elder_futhark";

const DEFAULT_METADATA = {
    gameHeading: {string: "Alphabet Game"},
    terms: {symbol: "symbol", symbols: "symbols"}
};

const DEFAULT_FORMSDATA = {
    keys: ["default"],
    setting: {default: {label: "Default", "active": true}},
    defaultForm: "default"
};

const DEFAULT_LANGUAGEDATA = {
    languages: ["en"],
    default: "en"
}

const LANGUAGES = {
    en: "English",
    de: "German"
}

export class Dataset {
    static _cache = {};

    constructor(data) {
        this.name = data.name;
        this.metadata = Object.assign({}, DEFAULT_METADATA, data.metadata);
        this.displayData = data.displayData;
        this.formsData = data.formsData ?? DEFAULT_FORMSDATA;
        this.filters = this.standardizeFilters(data.filters ?? {});
        this.propsData = data.propsData;

        this.languageData = data.languageData ?? DEFAULT_LANGUAGEDATA;
        this.languageData.default ??= this.languageData.languages[0];

        this.items = this.processItems(data.symbolsData);
    }

    /**
     *
     * @param {string} key
     * @returns {Dataset}
     */
    static async fromKey(key) {
        if (!(key in DATASETS_METADATA)) {
            console.error(`Invalid dataset key "${key}".`);
            return null;
        }

        if (key in this._cache) {
            return this._cache[key];
        }

        const data = await fetch(DATASETS_METADATA[key].file).then(response => response.json());
        const dataset = new this(data);
        this._cache[key] = dataset;
        return dataset;
    }

    /**
     * @param {Record<string,Record<string,*>>} filters
     * @returns {Record<string,Record<string,*>>}
     */
    standardizeFilters(filters) {
        for (const filter of Object.values(filters)) {
            this.standardizeFilter(filter);
        }
        return filters;
    }

    /**
     * @param {Record<string,*>} filter
     */
    standardizeFilter(filter) {
        if (Array.isArray(filter.values)) {
            filter.values = Object.fromEntries(filter.values.map(x => [x, {label: x}]));
        }
    }


    propertySetting(checked = null) {
        return Setting.create("Properties", SH.createButtonGroup(
            ObjectHelper.map(this.propsData, p => p.label),
            {checked: checked ?? ObjectHelper.map(this.propsData, p => !!p.active)}
        ));
    }

    languageSetting(checked = null) {
        return Setting.create("Language", SH.createButtonGroup(
            ObjectHelper.onlyKeys(LANGUAGES, this.languageData.languages),
            {
                checked: checked ?? this.languageData.default,
                exclusive: true
            }
        ));
    }

    formsSetting(checked = null) {
        const label = this.formsData.label ?? (this.formsData.exclusive ? "Form" : "Forms");
        return Setting.create(label, SH.createButtonGroup(
            ObjectHelper.map(this.formsData.setting, (p) => p.label),
            {
                exclusive: !!this.formsData.exclusive,
                checked: checked ?? ObjectHelper.map(this.formsData.setting, (p) => p.active),
            },
        ));
    }

    /**
     * @param checked
     * @returns {Setting}
     */
    fontSetting(checked = null) {
        const setting = Setting.create("Font", SH.createButtonGroup(
            ObjectHelper.map(this.displayData.fonts, font => font.label ?? font.family),
            {
                exclusive: true,
                checked: checked ?? this.displayData.defaultFont ?? Object.keys(this.displayData.fonts)[0]
            }
        ));
        setting.valueElement.disableIfSingleButton();
        return setting;
    }

    _getFilterer() {
        const filters = ObjectHelper.map(
            this.filters, filter => ObjectHelper.map(filter.values, () => [])
        );

        for (const [key, item] of Object.entries(this.items)) {
            for (const [filterKey, filter] of Object.entries(filters)) {
                if (!(item.filters[filterKey] in filter)) {
                    console.warn(`Invalid filter value ${item.filters[filterKey]} for filter ${filterKey}`);
                } else {
                    filter[item.filters[filterKey]].push(key);
                }
            }
        }

        return new Filterer(Object.keys(this.items), filters);
    }

    /**
     * @returns {[Filterer, SettingsCollection]}
     */
    getFilterSettings(checked = null) {
        const filterer = this._getFilterer();
        checked ??= {};

        const sc = SettingsCollection.createFrom(
            ObjectHelper.map(this.filters, (filter, key) => {
                const buttonGroupData = ObjectHelper.map(filter.values, x => x.label);

                checked[key] ??= filter.defaultActive ?? "all";

                return Setting.create(
                    filter.label,
                    SH.createButtonGroup(buttonGroupData,{checked: checked[key]})
                );
            })
        );

        for (const [filterKey, setting] of Object.entries(sc.settings)) {
            setting.valueElement.addUpdateListener((value) => {
                filterer.updateFilterState(filterKey, value);
            });
            filterer.updateFilterState(filterKey, setting.valueElement.value);
        }

        return [filterer, sc];
    }

    /**
     * @param symbolsData
     * @returns {Record<string,DatasetItem>}
     */
    processItems(symbolsData) {
        let rows = symbolsData.format === "columns" ?
            this.symbolsDataColumnsToRows(symbolsData.columns) :
            symbolsData.rows;

        if (Array.isArray(rows)) {
            rows = Object.assign({}, rows);
        }

        if (symbolsData.template) {
            this.applyTemplateToRows(rows, symbolsData.template);
        }

        const items = ObjectHelper.map(rows, itemData => {
            const data = this.standardizeItemData(itemData);
            return new DatasetItem(data.displayForms, data.properties, data.filters);
        });
        return this.setItemFilterValues(items);
    }

    /**
     * @param {Record<string,*[]>} rows
     * @param {string[]} template
     */
    applyTemplateToRows(rows, template) {
        for (const [itemKey, item] of Object.entries(rows)) {
            if (!Array.isArray(item)) {
                continue;
            }

            const row = {};
            for (const [index, value] of item.entries()) {
                row[template[index]] = value;
            }
            rows[itemKey] = row;
        }
    }

    /**
     * @param itemData
     * @returns {{displayForms, properties, filters}}
     */
    standardizeItemData(itemData) {
        itemData = this.standardizeDisplayForms(itemData);

        const newData = {
            displayForms: itemData.displayForms ?? {},
            properties: itemData.properties ?? {},
            filters: itemData.filters ?? {},
        };

        for (const [taggedKey, value] of Object.entries(itemData)) {
            if (taggedKey.includes(":")) {
                const splitKey = taggedKey.split(":");
                if (splitKey.length !== 2) {
                    console.warn("Ignored invalid symbol key.");
                    continue;
                }
                const [tag, key] = splitKey;

                if (tag === "p") {
                    newData.properties[key] = value;
                } else if (tag === "f") {
                    newData.filters[key] = value;
                } else {
                    console.warn("Ignored invalid symbol key.");
                }
            }
        }

        return newData;
    }

    standardizeDisplayForms(itemData) {
        if ("display" in itemData || typeof itemData.displayForms === "string") {
            if ("display" in itemData && "displayForms" in itemData) {
                console.error("Cannot have display and displayForms on symbolData row.");
            }
            const formValue = "display" in itemData ? itemData.display : itemData.displayForms;

            itemData.displayForms = {};
            itemData.displayForms[this.formsData.defaultForm] = formValue;
        } else {
            if (!("displayForms" in itemData)) {
                console.error("display / displayForms missing on symbolData row.");
            }

            if (Array.isArray(itemData.displayForms)) {
                const newDisplayForms = {};
                for (const [i, value] of itemData.displayForms.entries()) {
                    newDisplayForms[this.formsData.keys[i]] = value;
                }
                itemData.displayForms = newDisplayForms;
            }
        }

        return itemData;
    }

    setItemFilterValues(items) {
        for (const [filterKey, filter] of Object.entries(this.filters)) {
            for (const [value, params] of Object.entries(filter.values)) {
                if (params.keys) {
                    for (const key of params.keys) {
                        if (filterKey in items[key].filters) {
                            console.warn("Mixed filter values from keys and symbolsData.");
                        }
                        items[key].filters[filterKey] = value;
                    }
                }
            }

            if (filter.defaultValue) {
                for (const item of Object.values(items)) {
                    if (!(filterKey in item.filters)) {
                        item.filters[filterKey] = filter.defaultValue;
                    }
                }
            }
        }
        return items;
    }

    symbolsDataColumnsToRows(columns) {
        const n = Object.values(columns)[0].length;
        const rows = new Array(n).fill(0).map(() => Object());

        for (const [key, column] of Object.entries(columns)) {
            if (column.length !== n) {
                console.error("Processing symbolsData: Column lengths don't match.");
            }
            for (let i = 0; i < n; i++) {
                rows[i][key] = column[i];
            }
        }

        return rows;
    }

    formsFromSettingsValue(forms) {
        const result = [];
        for (const key of forms) {
            if ("keys" in this.formsData.setting[key]) {
                result.push(...this.formsData.setting[key].keys);
            } else {
                result.push(key);
            }
        }
        return result;
    }

    /**
     * @param {Record<string,boolean>} active
     * @param {string[]} forms
     * @returns {number}
     */
    quizItemsCount(active, forms) {
        forms = this.formsFromSettingsValue(forms);

        return ArrayHelper.sum(
            ObjectHelper.filterKeys(active, x => x).map(
                key => Object.values(ObjectHelper.onlyKeys(this.items[key].displayForms, forms)).length
            )
        );
    }

    quizItemsCountString(active, forms) {
        const count = this.quizItemsCount(active, forms);
        const term = count === 1 ? this.metadata.terms.symbol : this.metadata.terms.symbols;
        return count.toString() + " " + term;
    }

    /**
     * @param {string[]} itemKeys
     * @param {string[]} forms
     * @param {string[]} properties
     * @param {string} [language]
     * @returns {Record<string,QuizItem>}
     */
    getQuizItems(itemKeys, forms, properties, language = "default") {
        const items = {};

        forms = this.formsFromSettingsValue(forms);

        for (const key of itemKeys) {
            Object.assign(items, ObjectHelper.mapKeys(
                this.items[key].getQuizItems(forms, this.propsData, properties, language),
                form => key + "_" + form
            ));
        }

        return items;
    }

    referenceSymbols(forms) {
        if (this.displayData.type !== "string") {
            console.error("Not implemented Symbol concatenation for non-string symbols.");
        }

        return ObjectHelper.map(this.items,
        item => Object.values(ObjectHelper.onlyKeys(item.displayForms, forms)).join()
        );
    }

    /**
     * @returns {Record<string,string>}
     */
    referenceSymbolsByIdentifier(propertyKey, forms) {
        const referenceSymbols = this.referenceSymbols(forms);

        if (!this.propsData[propertyKey].identifier) {
            console.error("Property Key is not an identifier.");
        }

        const result = {};
        for (const [itemKey, item] of Object.entries(this.items)) {
            for (let key of item.properties[propertyKey].solutions[0]) {
                if (this.propsData[propertyKey].type === "istring") {
                    key = key.toLowerCase();
                }
                result[key] = referenceSymbols[itemKey];
            }
        }

        return result;
    }


    /**
     * @param {HTMLElement} element
     */
    setupGameHeading(element) {
        try {
            const gameHeading = this.metadata.gameHeading;

            if ("font" in gameHeading) {
                FontHelper.setFont(element, gameHeading.font);
            } else {
                FontHelper.clearFont(element);
            }

            if (this.name === "Atomic Elements") {
                const container = document.createElement("div");
                container.classList.add("element-heading-container");
                const els = [];
                for (const [no, symbol] of [[19, "K"], [85, "At"], [42, "Mo"], [16, "S"]]) {
                    const el = DOMHelper.getTemplate("headingElement");
                    el.querySelector(".heading-element-symbol").textContent = symbol;
                    el.querySelector(".heading-element-number").textContent = no;
                    els.push(el);
                }
                container.replaceChildren(...els);
                element.replaceChildren(container);
            } else {
                element.replaceChildren(document.createTextNode(gameHeading.string));
            }
        }
        catch (error) {
            console.error(error);
            element.replaceChildren(document.createTextNode("Kadmos"));
        }
    }
}


class DatasetItem {
    /**
     * @param {Record<string,*>} displayForms
     * @param {Record<string,*>} properties
     * @param {Record<string,*>} filters
     */
    constructor(displayForms, properties, filters) {
        this.displayForms = displayForms;
        this.properties = properties;
        this.filters = filters;
    }

    /**
     * @param {string[]} forms
     * @param {Record<string,*>} propsData
     * @param {string[]} properties
     * @param {string} language
     * @returns {Record<string, QuizItem>}
     */
    getQuizItems(forms, propsData, properties, language = "default") {
        const items = {};
        for (const form of forms) {
            if (form in this.displayForms) {
                items[form] = new QuizItem(
                    this.displayForms[form],
                    this.getQuizProperties(properties, propsData, language),
                    this.filters
                );
            }
        }

        return items;
    }

    /**
     * @param {string[]} propertyKeys
     * @param {Record<string,*>} propsData
     * @param {string} [language]
     * @returns {Object<string,ItemProperty>}
     */
    getQuizProperties(propertyKeys, propsData, language = "default") {
        const result = {};
        for (const key of propertyKeys) {
            if (!(key in this.properties)) {
                console.error(`Missing property key "${key}".`);
                continue;
            }

            result[key] = this.properties[key];
        }

        if (language !== "default") {
            for (const key of propertyKeys) {
                const langKey = key + "_" + language;
                if (langKey in this.properties) {
                    result[key] = this.properties[langKey];
                }
            }
        }

        return ObjectHelper.map(result, (prop, key) => ItemProperty.fromData(prop, propsData[key]));
    }
}
