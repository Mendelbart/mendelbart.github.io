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
export const DEFAULT_DATASET = "greek";

const DEFAULT_METADATA = {
    gameHeading: "Kadmos",
    terms: {letter: "letter"},
    lang: "en",
    dir: "ltr"
};

export const TERMS = ["letter", "letters"];

const DEFAULT_FORMS = {
    data: {default: "Default"},
    exclusive: false
};

const DEFAULT_LANGUAGES = {
    keys: ["en"]
}

const LANGUAGES = {
    en: "English",
    de: "German"
}

/**
 * @typedef {object} JSONDataset
 * @property {string} key Unique key for this script dataset. Preferably from the <a href="https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry">IANA Language Subtag Registry</a>.
 * @property {string} name Name of the dataset
 * @property {object} metadata
 * @property {*} metadata.gameHeading
 * @property {string} [metadata.lang] Value of the HTML lang attribute for letters of this script. Default "en".
 * @property {"ltr"|"rtl"} [metadata.dir="ltr"] Direction of the script: ltr for left-to-right (default) or rtl for right-to-left.
 * @property {object} [metadata.terms] Specify what the equivalent of e.g. "letter" and "letters" in this font are called.
 * @property {string} [metadata.terms.letter="letter"]
 * @property {string} [metadata.terms.letters] Default: terms.letter + 's'
 * @property {object} [languages]
 * @property {array} languages.keys Language subtags. In items, use "p:PROPERTY_SUBTAG" (e.g. "p:name_de") as key to specify language-specific property values.
 * @property {string} [languages.default]
 * @property {object} fonts A registry of the fonts used by the dataset, with lowercase keys.
 * @property {object} selector
 * @property {*} [selector.font]
 * @property {object} [selector.label] Settings for the label underneath letters in the selector. If not set, these won't appear.
 * @property {string} selector.label.property Which property to label the items with.
 * @property {boolean} [selector.label.splitFirst=true] If true, the property value will be split using the splitter value, and only the first part will be used as a label. E.g. for the letter "Aleph/Alef", the label string will be "Aleph"
 * @property {string} [selector.label.splitter="[,;/]"]
 * @property {object} [selector.style]
 * @property {string} [selector.defaultActive]
 * @property {object} [game]
 * @property {number} [game.defaultWeight=400]
 * @property {object} [forms]
 * @property {object} forms.data
 * @property {string} [forms.label="Forms"] Label of the forms setting. Default "Forms".
 * @property {boolean} [forms.exclusive=false] If true, you can only select one form to play at a time.
 * @property {object} properties
 * @property {object} [variants]
 * @property {object} variants.data
 * @property {object} [variants.groups]
 * @property {object} items
 * @property {"string"} [items.symbolType]
 * @property {array} items.properties Keys to assign the property entries of data rows to. Use `{PROPERTY}_{LANG}` for properties of a specific language.
 * @property {array} items.data Array with [[...displayforms], ...properties] entries matching the template. If first element is a string, it will be split into individual characters for forms. Use a single-item array if this isn't wanted.
 */


export class Dataset {
    static _cache = {};

    /**
     * @param {JSONDataset} data
     */
    constructor(data) {
        this.name = data.name;
        this.metadata = this.processMetadata(data.metadata);
        this.processFonts(data.fonts);
        this.gameConfig = data.game ?? {};
        this.forms = this.processForms(data.forms);
        this.properties = data.properties;
        this.selectorData = data.selector ?? {};
        this.variants = this.processVariants(data.variants);

        this.languages = data.languages ?? DEFAULT_LANGUAGES;
        this.languages.default ??= this.languages.keys[0];

        this.items = this.processItems(data.items);
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
            .catch(err => console.error(err));
    }

    processMetadata(metadata) {
        metadata = Object.assign({}, DEFAULT_METADATA, metadata);
        metadata.terms.letter ??= "letter";
        metadata.terms.letters ??= metadata.terms.letter + "s";
        return metadata;
    }

    processForms(forms) {
        forms ??= DEFAULT_FORMS;
        for (const [key, form] of Object.entries(forms.data)) {
            if (typeof form === "string") {
                forms.data[key] = {label: form};
            }
        }
        return forms;
    }

    processVariants(variants) {
        if (!variants || !variants.data) {
            return null;
        }

        for (const [key, value] of Object.entries(variants.data)) {
            if (typeof value === "string") {
                variants.data[key] = {label: value};
            }
            variants.data[key].lang ??= key;
        }

        return variants;
    }

    getGameSettings(checked) {
        const settings = {};
        if (this.hasSetting("properties")) {
            settings.properties = this.propertySetting(checked.properties);
        }
        if (this.hasSetting("language")) {
            settings.language = this.languageSetting(checked.language);
        }
        return SettingCollection.createFrom(settings);
    }

    getFilterSettings(checked) {
        const settings = {};
        if (this.hasVariants()) {
            settings.variant = this.variantSetting(checked.variant);
        }
        if (this.hasSetting("forms")) {
            settings.forms = this.formsSetting(checked.forms);
        }
        return SettingCollection.createFrom(settings);
    }

    propertySetting(checked = null) {
        return ButtonGroup.from(
            ObjectHelper.map(this.properties, p => p.label),
            {
                label: "Properties",
                checked: checked ?? ObjectHelper.map(this.properties, p => !!p.active)
            }
        );
    }

    languageSetting(checked = null) {
        return ButtonGroup.from(
            ObjectHelper.onlyKeys(LANGUAGES, this.languages.keys),
            {
                label: "Language",
                checked: checked ?? this.languages.default,
                exclusive: true
            }
        );
    }

    ungroupedForms() {
        return ObjectHelper.filter(this.forms.data, f => !("groupWith" in f));
    }

    formsSetting(checked = null) {
        if (!this.hasSetting("forms")) {
            return null;
        }

        const label = this.forms.label ?? (this.forms.exclusive ? "Form" : "Forms");
        const ungroupedForms = this.ungroupedForms();
        return ButtonGroup.from(
            ObjectHelper.map(ungroupedForms, (p) => p.label),
            {
                label: label,
                exclusive: this.forms.exclusive,
                checked: checked ?? ObjectHelper.map(ungroupedForms, f => f.active ?? !this.forms.exclusive),
            },
        );
    }

    variantSetting(selected = null) {
        return ValueElement.createSelect(
            ObjectHelper.map(this.variants.data, (variant) => variant.label),
            {
                label: "Variant",
                selected: selected ?? this.variants.default ?? Object.keys(this.variants.data)[0],
                groups: this.variants.groups ? Object.values(this.variants.groups) : []
            }
        )
    }

    /**
     * @param {string} key
     * @returns {boolean}
     */
    hasSetting(key) {
        switch (key) {
            case "properties":
                return Object.keys(this.properties).length > 1;
            case "language":
                return this.languages.keys.length > 1;
            case "variant":
                return this.hasVariants();
            case "forms":
                return Object.keys(this.ungroupedForms()).length > 1;
            case "font-family":
                return Object.keys(this.fonts).length > 1;
            default:
                throw new Error(`Invalid settings key ${key}.`);
        }
    }

    hasVariants() {
        return !!this.variants;
    }

    /**
     * @param {?HTMLElement} node
     * @returns {ItemSelector}
     */
    getItemSelector(node = null) {
        const blocks = this.selectorData.block ? [this.selectorData.block] : this.selectorData.blocks;
        const labels = this.selectorData.label ? this.items.map(item => item.getSelectorLabel(this.selectorData.label)) : null;

        const selector = new ItemSelector(this.items);
        selector.setup({
            node: node,
            datasetKey: this.key,
            blocks: blocks,
            labels: labels,
            style: this.selectorData.style ?? null
        });

        selector.setMetadata(ObjectHelper.onlyKeys(this.metadata, ["lang", "dir"]));
        if (this.selectorData.defaultActive) {
            selector.setActive(this.selectorData.defaultActive);
        }
        selector.setSymbolFont(this.getSelectorDisplayFont());

        return selector;
    }

    /**
     * @param {string} variant
     * @param {ItemSelector} selector
     */
    applyVariant(variant, selector) {
        selector.setItemIndices(this.getVariantItemIndices(variant));
        selector.setSymbolFont(this.getSelectorDisplayFont(variant));
    }

    getVariantItemIndices(variant) {
        return ArrayHelper.filterIndices(this.items, item => item.variants.has(variant));
    }

    applyFormsSetting(forms, selector) {
        selector.setActiveForms(this.getFormsFromSettingsValue(forms));
    }

    getFormsFromSettingsValue(value) {
        if (typeof value === "string") {
            value = [value];
        }
        const keys = value.slice();

        for (const [key, form] of Object.entries(this.forms.data)) {
            if ("groupWith" in form && value.includes(form.groupWith)) {
                const index = keys.indexOf(form.groupWith);
                if (index !== -1) {
                    keys.splice(index + 1, 0, key);
                }
            }
        }

        return keys;
    }

    getVariantFontModification(key, variant) {
        if (variant) {
            const fonts = this.variants.data[variant].fonts;
            if (fonts && key in fonts) {
                return fonts[key];
            }
        }

        return null;
    }

    /**
     * @param {Record<string, *>} font
     * @param {?string} [variant]
     * @returns {Record<string, *>}
     */
    getFont(font, variant = null) {
        if (!font) {
            return this.defaultFont();
        }

        if (typeof font === "string") {
            font = {key: font};
        }

        if ("family" in font) {
            console.warn(`Found family property "${font.family}" in font: Will be overwritten!`);
        }

        font.key ??= this._defaultFontKey;
        if (!(font.key in this.fonts)) {
            console.error(`Unknown font key "${font.key}".`);
            font.key = this._defaultFontKey;
        }

        return ObjectHelper.withoutKeys(
            Object.assign({},
                this.fonts[font.key],
                this.getVariantFontModification(font.key, variant),
                font
            ),
            ["key", "default", "label"]
        );
    }
    
    getSelectorDisplayFont(variant) {
        return this.getFont(this.selectorData.font, variant);
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
     * @param {string[]} properties
     * @param {any[][]} data
     * @param {"string"} [symbolType="string"]
     * @returns {DatasetItem[]}
     */
    processItems({properties, data, symbolType = "string"}) {
        const result = new Array(data.length);

        for (let [index, row] of data.entries()) {
            const displayForms = this.processDisplayForms(row[0]);

            let variants;
            if (this.hasVariants()) {
                variants = this.processItemVariants(row[1]);
            }

            const itemProperties = ObjectHelper.fromKeysValues(
                properties, row.splice(this.hasVariants() ? 2 : 1), false
            );

            result[index] = new DatasetItem(symbolType, displayForms, itemProperties, variants);
        }

        return result;
    }

    /**
     * @param {string[] | string} variants
     * @returns {string[]}
     */
    processItemVariants(variants) {
        if (!variants || variants === "*") {
            return Object.keys(this.variants.data);
        }
        if (Array.isArray(variants)) {
            return variants;
        }

        const adding = variants.substring(0,2) !== "*-";
        if (!adding) {
            variants = variants.substring(2);
        }

        const included = ObjectHelper.map(this.variants.data, () => !adding);
        for (const key of variants.split(",")) {
            if (key in this.variants.data) {
                included[key] = adding;
            } else if (this.variants.groups && key in this.variants.groups) {
                for (const variantKey of this.variants.groups[key]) {
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
        if (Object.keys(this.forms.data).length === 1) {
            if (Array.isArray(display)) {
                display = display[0];
            }
            return Object.fromEntries([[Object.keys(this.forms.data)[0], display]]);
        }

        if (typeof display === "string") {
            display = display.split("");
        }

        if (Array.isArray(display)) {
            const forms = {};
            const formKeys = Object.keys(this.forms.data);
            for (const [index, value] of display.entries()) {
                if (value) {
                    forms[formKeys[index]] = value;
                }
            }
            return forms;
        }

        if (typeof display !== "object") {
            throw new Error("Invalid display format: need array or object.");
        }

        return ObjectHelper.onlyKeys(display, Object.keys(this.forms.data), true);
    }

    /**
     * @param {number[]} itemIndices
     * @param {string[]} forms
     * @param {string[]} properties
     * @param {?string} [language]
     * @returns {QuizItem[]}
     */
    getQuizItems(itemIndices, forms, properties, language = null) {
        const items = [];

        for (const index of itemIndices) {
            const item = this.items[index];
            const displayStrings = item.getDisplayStrings(forms);
            const itemProperties = item.getItemProperties(properties, this.properties, language);
            items.push(...Object.entries(displayStrings).map(
                ([form, string]) => new QuizItem(item.type, string, itemProperties, form)
            ));
        }

        return items;
    }


    referencePropsData() {
        const propsData = Object.assign({}, this.properties);
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
     * @param {?string} [language]
     * @returns {Record<string,QuizItem[]>}
     */
    getReferenceItems(properties, language = null) {
        let items;
        const propsData = this.referencePropsData();

        if (this.forms.exclusive) {
            const itemsProperties = this.items.map(
                item => item.getItemProperties(properties, propsData, language)
            );

            return ObjectHelper.map(this.forms.data, (_, key) => this.items.map(
                (item, index) => new QuizItem(
                    item.type, item.getFormsDisplayString([key]), itemsProperties[index], key
                )
            ));
        } else {
            items = this.items.map(item => new QuizItem(
                item.type,
                item.getFormsDisplayString(Object.keys(this.forms.data)),
                item.getItemProperties(properties, propsData, language),
                "all"
            ));

            return ObjectHelper.map(this.forms.data, () => items);
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
     * @param {"string"} type
     * @param {Record<string,string>} displayForms
     * @param {Record<string,*>} properties
     * @param {string[]?} variants
     */
    constructor(type, displayForms, properties, variants = null) {
        this.type = type;
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

    getSelectorLabel({property = null, splitFirst = true, splitter = "[,;/]"}) {
        const str = this.properties[property];
        if (splitFirst) {
            return str.split(new RegExp(`\s*(${splitter})\s*`))[0];
        }
        return str;
    }
}
