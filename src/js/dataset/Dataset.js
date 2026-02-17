import {ItemProperty, QuizItem} from "./symbol.js";
import {DOMHelper, ObjectHelper, FontHelper} from '../helpers/helpers.js';
import ItemSelector from "./selector.js";
import {SettingsCollection, ButtonGroup, ValueElement} from "../settings/settings.js";
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
    static fromKey(key) {
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
        if (!variantsData) {
            return null;
        }

        for (const [key, data] of Object.entries(variantsData.variants)) {
            if (typeof data === "string") {
                variantsData.variants[key] = {label: data};
            }
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
        return SettingsCollection.createFrom(settings);
    }

    getFilterSettings(checked) {
        const settings = {};
        if (this.hasFormsSetting()) {
            settings.forms = this.formsSetting(checked.forms);
        }
        if (this.hasVariantSetting()) {
            settings.variant = this.variantSetting(checked.variant);
        }
    }

    getSettings(checkedProperties, checkedLanguage) {
        return SettingsCollection.createFrom({
            properties: this.propertySetting(checkedProperties),
            language: this.languageSetting(checkedLanguage)
        });
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
        const label = this.formsData.label ?? (this.formsData.exclusive ? "Form" : "Forms");
        return ButtonGroup.from(
            ObjectHelper.map(this.formsData.setting, (p) => p.label),
            {
                label: label,
                exclusive: !!this.formsData.exclusive,
                checked: checked ?? ObjectHelper.map(this.formsData.setting, (p) => p.active),
            },
        );
    }

    variantSetting(selected = null) {
        const variants = this.variantsData.variants;
        return ValueElement.createSelect(
            ObjectHelper.map(variants, (variant) => variant.label),
            {
                label: "Variants",
                selected: selected ?? this.variantsData.default ?? Object.keys(variants)[0],
                groups: variants.groups ?? []
            }
        )
    }

    hasPropsSetting() {
        return this.propsData.keys.length > 1;
    }

    hasLanguageSetting() {
        return this.languageData.languages.length > 1;
    }

    hasVariantSetting() {
        return !!this.variantsData;
    }

    hasFormsSetting() {
        return Object.keys(this.formsData.setting).length > 1;
    }

    hasFontSetting() {
        return Object.keys(this.fonts).length > 1;
    }

    getItemSelector() {
        return new ItemSelector(this.items, this);
    }

    _getFont(font) {
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

        return Object.assign({}, this.fonts[font.key], ObjectHelper.withoutKeys(font, ["key"]));
    }

    /**
     * @param {string | Object} font
     * @returns {[string, Record<string, any> & {family: string}]}
     */
    getFont(font) {
        const data = ObjectHelper.withoutKeys(this._getFont(font), ["default", "label"]);
        return [data.family, data];
    }

    /**
     * @param {string | Object} font
     * @returns {string}
     */
    getFontFamily(font) {
        return this.getFont(font)[0];
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
    fontSetting(checked = null) {
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
                console.warn("Error occured processing item with key", key);
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
        return new DatasetItem(
            this.processDisplayForms(itemData.display),
            this.processItemProperties(itemData)
        );
    }

    processItemProperties(itemData) {
        const properties = {};
        for (const [taggedKey, value] of Object.entries(itemData)) {
            if (taggedKey.includes(":")) {
                const splitKey = taggedKey.split(":");
                if (splitKey.length !== 2) {
                    console.warn("Ignored invalid symbol key.");
                    continue;
                }
                const [tag, key] = splitKey;

                if (tag === "p") {
                    properties[key] = value;
                } else {
                    console.warn("Ignored invalid tagged symbol key.");
                }
            }
        }
        return properties;
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
     * @param {string[]} properties default "default"
     * @param {string} [language]
     * @returns {QuizItem[]}
     */
    getQuizItems(itemIndices, forms, properties, language = "default") {
        const items = [];

        for (const key of itemIndices) {
            const displayStrings = this.items[key].getDisplayString(forms);
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
     * @param {string} [language] default "default"
     * @returns {Record<string,QuizItem[]>}
     */
    getReferenceItems(properties, language = "default") {
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

        FontHelper.setFont(element, ...this.getFont(gameHeading.font));

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
     */
    constructor(displayForms, properties) {
        this.displayForms = displayForms;
        this.properties = properties;
    }

    /**
     * @param forms
     * @returns {Record<string,string>}
     */
    getDisplayString(forms) {
        return ObjectHelper.onlyKeys(this.displayForms, forms);
    }

    /**
     * @param {string[]} propertyKeys
     * @param {Record<string,*>} propsData
     * @param {string} [language]
     * @returns {Object<string,ItemProperty>}
     */
    getItemProperties(propertyKeys, propsData, language = "default") {
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
                if (this.properties[langKey]) {
                    result[key] = this.properties[langKey];
                }
            }
        }

        return ObjectHelper.map(result, (prop, key) => ItemProperty.fromData(prop, propsData[key]));
    }

    /**
     * @param {string[]} forms
     * @returns {string}
     */
    getFormsDisplayString(forms) {
        return Object.values(this.getDisplayString(forms)).join("");
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
