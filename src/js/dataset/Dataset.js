import {ItemProperty, QuizItem} from "./symbol.js";
import {ArrayHelper, DOMHelper, ObjectHelper, FontHelper} from '../helpers/helpers.js';
import ItemSelector from "./selector.js";
import {SettingCollection, ButtonGroup, ValueElement} from "../settings/settings.js";
import DATASETS_METADATA from '../../json/datasets_meta.json';

DOMHelper.registerTemplate(
    "headingElement",
    `<div class="heading-element"><span class="heading-element-number"></span><span class="heading-element-symbol"></span></div>`
);

const DATASETS_ROOT = "./json/datasets/";
export const DEFAULT_DATASET = "elder_futhark";

const DEFAULT_METADATA = {
    gameHeading: "Kadmos",
    terms: {letter: "letter"},
    lang: "en",
    dir: "ltr"
};

export const TERMS = ["letter", "letters"];

const DEFAULT_FORMSDATA = {
    keys: ["default"],
    setting: {default: {label: "Default", "active": true}},
    defaultForm: "default",
    singleForm: true
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
        this.metadata = this.processMetadata(data.metadata);
        this.processFonts(data.fonts);
        this.displayData = data.displayData ?? {};
        this.displayData.type ??= "string";
        this.formsData = data.formsData ?? DEFAULT_FORMSDATA;
        this.propsData = data.propsData;
        this.selectorData = data.selectorData ?? {};
        this.variantsData = this.processVariants(data.variantsData)

        this.languageData = data.languageData ?? DEFAULT_LANGUAGEDATA;
        this.languageData.default ??= this.languageData.languages[0];

        this.items = this.processItems(data.symbolsData);
    }

    /**
     *
     * @param {string} key
     * @returns {?Promise<Dataset>}
     */
    static fetch(key) {
        if (!(key in DATASETS_METADATA)) {
            console.error(`Invalid dataset key "${key}".`);
            return null;
        }

        if (key in this._cache) {
            return Promise.resolve(this._cache[key]);
        }

        return fetch(DATASETS_ROOT + DATASETS_METADATA[key].file)
            .then(response => response.json())
            .then(data => {
                const dataset = new this(data);
                dataset.key = key;
                this._cache[key] = dataset;
                return dataset;
            })
            .catch(DOMHelper.printError);
    }

    processMetadata(metadata) {
        metadata = Object.assign({}, DEFAULT_METADATA, metadata);
        metadata.terms.letter ??= "letter";
        metadata.terms.letters ??= metadata.terms.letter + "s";
        return metadata;
    }

    processVariants(variantsData) {
        if (!variantsData || !variantsData.variants) {
            return null;
        }

        for (const [key, data] of Object.entries(variantsData.variants)) {
            if (typeof data === "string") {
                variantsData.variants[key] = {label: data};
            }
            variantsData.variants[key].lang ??= key;
        }

        return variantsData;
    }

    getGameSettings(checked) {
        const settings = {};
        if (this.hasPropsSetting()) {
            settings.properties = this.propertySetting(checked.properties);
        }
        if (this.hasLanguageSetting()) {
            settings.language = this.languageSetting(checked.language);
        }
        return SettingCollection.createFrom(settings);
    }

    getFilterSettings(checked) {
        const settings = {};
        if (this.hasVariantSetting()) {
            settings.variant = this.variantSetting(checked.variant);
        }
        if (this.hasFormsSetting()) {
            settings.forms = this.formsSetting(checked.forms);
        }
        return SettingCollection.createFrom(settings);
    }

    propertySetting(checked = null) {
        return ButtonGroup.from(
            ObjectHelper.map(this.propsData, p => p.label),
            {
                label: "Properties",
                checked: checked ?? ObjectHelper.map(this.propsData, p => !!p.active)
            }
        );
    }

    languageSetting(checked = null) {
        return ButtonGroup.from(
            ObjectHelper.onlyKeys(LANGUAGES, this.languageData.languages),
            {
                label: "Language",
                checked: checked ?? this.languageData.default,
                exclusive: true
            }
        );
    }

    formsSetting(checked = null) {
        if (!this.hasFormsSetting()) {
            return null;
        }

        const label = this.formsData.label ?? (this.formsData.exclusive ? "Form" : "Forms");
        return ButtonGroup.from(
            ObjectHelper.map(this.formsData.setting, (p) => p.label),
            {
                label: label,
                exclusive: !!this.formsData.exclusive,
                checked: checked ?? ObjectHelper.map(this.formsData.setting, (p) => p.active ?? false),
            },
        );
    }

    getFormsFromSettingsValue(value) {
        if (typeof value === "string") {
            value = [value];
        }
        return value.map(key => this.formsData.setting[key].keys ?? [key]).flat();
    }

    variantSetting(selected = null) {
        return ValueElement.createSelect(
            ObjectHelper.map(this.variantsData.variants, (variant) => variant.label),
            {
                label: "Variant",
                selected: selected ?? this.variantsData.default ?? Object.keys(this.variantsData.variants)[0],
                groups: Object.values(this.variantsData.groups) ?? []
            }
        )
    }

    hasSetting(key) {
        switch (key) {
            case "properties": return Object.keys(this.propsData).length > 1;
            case "language": return this.languageData.languages.length > 1;
            case "variant": return !!this.variantsData;
            case "forms": return this.formsData.showSetting ?? Object.keys(this.formsData.setting).length > 1;
            case "font-family": return Object.keys(this.fonts).length > 1;
            default: throw new Error(`Invalid settings key ${key}.`);
        }
    }

    hasPropsSetting() {
        return Object.keys(this.propsData).length > 1;
    }

    hasLanguageSetting() {
        return this.languageData.languages.length > 1;
    }

    hasVariantSetting() {
        return !!this.variantsData;
    }

    hasFormsSetting() {
        return this.formsData.showSetting ?? Object.keys(this.formsData.setting).length > 1;
    }

    hasFontFamilySetting() {
        return Object.keys(this.fonts).length > 1;
    }

    getItemSelector(node = null) {
        const selector = new ItemSelector(this.items, this);
        selector.setup(node);
        selector.setMetadata(ObjectHelper.onlyKeys(this.metadata, ["lang", "dir"]));
        if (this.selectorData.defaultActive) {
            selector.setActive(this.selectorData.defaultActive);
        }
        selector.setSymbolFont(this.getSelectorDisplayFont());

        return selector;
    }

    getVariantItemIndices(key) {
        return ArrayHelper.filterIndices(this.items, item => item.variants.has(key));
    }

    /**
     * @param {string | Record<string, *>} font
     * @returns {Record<string, *>}
     */
    getFont(font) {
        if (!font) {
            return this.defaultFont();
        }

        if (typeof font === "string") {
            font = {key: font};
        }

        font.key ??= this._defaultFontKey;
        if (!(font.key) in this.fonts) {
            console.error(`Unknown font key "${font.key}".`);
            font.key = this._defaultFontKey;
        }

        return ObjectHelper.withoutKeys(Object.assign({}, this.fonts[font.key], font), ["key", "default", "label"]);
    }
    
    getSelectorDisplayFont() {
        return this.getFont(this.selectorData.font);
    }

    processFonts(fonts) {
        this.fonts = fonts;
        const defaultEntry = Object.entries(fonts).find(([_, font]) => font.default);
        this._defaultFontKey = defaultEntry ? defaultEntry[0] : Object.keys(fonts)[0];
    }

    defaultFont() {
        return this.fonts[this._defaultFontKey];
    }

    /**
     * @param checked
     * @returns {ButtonGroup}
     */
    fontFamilySetting(checked = null) {
        const setting = ButtonGroup.from(
            ObjectHelper.map(this.fonts, font => font.label ?? font.family),
            {
                label: "Font",
                exclusive: true,
                checked: checked ?? this._defaultFontKey
            }
        );
        setting.node.classList.add("font-family-setting");
        return setting;
    }

    /**
     * @param symbolsData
     * @returns {DatasetItem[]}
     */
    processItems(symbolsData) {
        const rows = symbolsData.rows;

        if (!Array.isArray(rows)) {
            throw new Error("symbol rows must be an array.");
        }

        if (symbolsData.template) {
            this.applyTemplateToRows(rows, symbolsData.template);
        }

        const items = new Array(rows.length);
        let item;
        for (const [index, itemData] of rows.entries()) {
            try {
                item = this.processItem(itemData);
            } catch (e) {
                console.warn("Error occured processing item at index", index);
                console.error(e);
                continue;
            }
            items[index] = item;
        }

        return items;
    }

    /**
     * @param {Array} rows
     * @param {string[]} template
     */
    applyTemplateToRows(rows, template) {
        for (const [i, item] of rows.entries()) {
            if (!Array.isArray(item)) {
                continue;
            }

            const row = {};
            for (const [index, value] of item.entries()) {
                row[template[index]] = value;
            }
            rows[i] = row;
        }
        return rows;
    }

    processItem(itemData) {
        const variants = this.hasVariantSetting() ? this.processItemVariants(itemData.variants) : null;

        return new DatasetItem(
            this.processDisplayForms(itemData.display),
            this.processItemProperties(itemData),
            variants
        );
    }

    processItemProperties(itemData) {
        const properties = {};
        for (const [taggedKey, value] of Object.entries(itemData)) {
            if (taggedKey.substring(0, 2) !== "p:") {
                continue;
            }

            const key = taggedKey.substring(2);
            properties[key] = value;
        }

        return properties;
    }

    /**
     * @param {string[] | string} variants
     * @returns {string[]}
     */
    processItemVariants(variants) {
        if (!variants || variants === "*") {
            return Object.keys(this.variantsData.variants);
        }
        if (Array.isArray(variants)) {
            return variants;
        }

        const adding = variants.substring(0,2) !== "*-";
        if (!adding) {
            variants = variants.substring(2);
        }

        const included = ObjectHelper.map(this.variantsData.variants, () => !adding);
        for (const key of variants.split(",")) {
            if (key in this.variantsData.variants) {
                included[key] = adding;
            } else if (this.variantsData.groups && key in this.variantsData.groups) {
                for (const variantKey of this.variantsData.groups[key]) {
                    included[variantKey] = adding;
                }
            }
        }

        return ObjectHelper.filterKeys(included, x => x);
    }

    /**
     * @param {string|string[]|Record<string,string>} display
     * @returns {Record<string,string>}
     */
    processDisplayForms(display) {
        if (this.formsData.singleForm) {
            return Object.fromEntries([[this.formsData.defaultForm, display]]);
        }

        if (typeof display === "string") {
            display = display.split("");
        }

        if (Array.isArray(display)) {
            const forms = {};
            for (const [index, value] of display.entries()) {
                if (value) {
                    forms[this.formsData.keys[index]] = value;
                }
            }
            return forms;
        }

        if (typeof display !== "object") {
            throw new Error("Invalid display format: need array or object.");
        }

        const invalidKeys = Object.keys(display).filter(key => !this.formsData.keys.includes(key))
        if (invalidKeys.length > 0) {
            throw new Error(`Invalid display Form key "${invalidKeys[0]}".`);
        }

        return display;
    }

    /**
     * @param {number[]} itemIndices
     * @param {string[]} forms
     * @param {string[]} properties
     * @param {string?} [language]
     * @returns {QuizItem[]}
     */
    getQuizItems(itemIndices, forms, properties, language = null) {
        const items = [];

        for (const key of itemIndices) {
            const displayStrings = this.items[key].getDisplayStrings(forms);
            const itemProperties = this.items[key].getItemProperties(properties, this.propsData, language);
            items.push(...Object.entries(displayStrings).map(([form, string]) => new QuizItem(string, itemProperties, form)));
        }

        return items;
    }


    referencePropsData() {
        const propsData = Object.assign({}, this.propsData);
        for (const [property, propData] of Object.entries(propsData)) {
            if ("referenceMaxDist" in propData) {
                const newPropData = Object.assign({}, propData);
                newPropData.maxDist = propData.referenceMaxDist;
                propsData[property] = newPropData;
            }
        }

        return propsData;
    }


    /**
     * @param {string[]} properties
     * @param {string?} [language]
     * @returns {Record<string,QuizItem[]>}
     */
    getReferenceItems(properties, language = null) {
        let items;
        const propsData = this.referencePropsData();

        if (this.formsData.exclusive) {
            const itemsProperties = this.items.map(
                item => item.getItemProperties(properties, propsData, language)
            );

            const result = {};
            for (const form of this.formsData.keys) {
                result[form] = this.items.map((item, index) => new QuizItem(
                    item.getFormsDisplayString([form]), itemsProperties[index], form
                ));
            }
            return result;
        } else {
            items = this.items.map(item => new QuizItem(
                item.getFormsDisplayString(this.formsData.keys),
                item.getItemProperties(properties, propsData, language),
                "all"
            ));
            return Object.fromEntries(this.formsData.keys.map(form => [form, items]));
        }
    }

    /**
     * @param {HTMLElement} element
     */
    setupGameHeading(element) {
        const gameHeading = this.metadata.gameHeading;

        FontHelper.setFont(element, this.getFont(gameHeading.font));

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
            element.replaceChildren(gameHeading.string);
        }

        element.setAttribute("lang", gameHeading.lang ?? this.metadata.lang);
        element.setAttribute("dir", gameHeading.dir ?? this.metadata.dir);
    }
}


class DatasetItem {
    /**
     * @param {Record<string,string>} displayForms
     * @param {Record<string,*>} properties
     * @param {string[]?} variants
     */
    constructor(displayForms, properties, variants = null) {
        this.displayForms = displayForms;
        this.properties = properties;
        this.variants = new Set(variants);
    }

    /**
     * @param forms
     * @returns {Record<string,string>}
     */
    getDisplayStrings(forms) {
        return ObjectHelper.onlyKeys(this.displayForms, forms);
    }

    /**
     * @param {string[]} propertyKeys
     * @param {Record<string,*>} propsData
     * @param {string?} [language]
     * @returns {Object<string,ItemProperty>}
     */
    getItemProperties(propertyKeys, propsData, language = null) {
        const result = {};
        for (const key of propertyKeys) {
            if (!(key in this.properties)) {
                console.error(`Missing property key "${key}".`);
                continue;
            }

            result[key] = this.properties[key];
        }

        if (language) {
            for (const key of propertyKeys) {
                const langKey = key + "_" + language;
                if (this.properties[langKey]) {
                    result[key] = this.properties[langKey];
                }
            }
        }

        return ObjectHelper.map(result, (prop, key) => ItemProperty.fromData(prop, propsData[key]));
    }

    getFormNode(form) {
        const elem = DOMHelper.createElement('span.symbol-form');
        elem.dataset.form = form;
        elem.textContent = this.displayForms[form];
        return elem;
    }

    getFormNodes(forms = null) {
        return ObjectHelper.mapKeyArrayToValues(forms ?? Object.keys(this.displayForms), form => this.getFormNode(form))
    }

    /**
     * @param {string[]} forms
     * @returns {string}
     */
    getFormsDisplayString(forms) {
        return Object.values(this.getDisplayStrings(forms)).join("");
    }

    /**
     * Counts the number of QuizItems this DatasetItem supplies, i.e. the number of form keys that are set
     * for this item.
     * @param forms
     */
    countQuizItems(forms) {
        return forms.reduce((acc, form) => form in this.displayForms ? acc + 1 : acc, 0);
    }
}
