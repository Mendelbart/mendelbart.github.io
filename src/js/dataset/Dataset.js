import {DOMUtils, ObjectUtils, FontUtils, Matrix, ParametricValue} from '../utils';
import {SettingCollection, ButtonGroup, ValueElement} from "../settings";
import DATASETS_METADATA from '../../json/datasets_meta.json';
import {range} from "../utils/array";
import {Selector, SelectorBlock, SelectorGridBlock} from "../selector";
import {
    completeIndexSubsets,
    containsDuplicates,
    parseMatrixRanges,
    parseRanges
} from "../utils/indices";
import {DefaultListSplitter, QuizAnswerFactory} from "../quiz/answer";
import QuizItem from '../quiz/QuizItem';
import {LetterCombination, StringLetter} from "./letter";


DOMUtils.registerTemplate(
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
        this.properties = this.processProperties(data.properties);

        this.languages = data.languages ?? DEFAULT_LANGUAGES;
        this.languages.default ??= this.languages.keys[0];

        this.variants = data.variants;

        this.items = this.processItems(data.items);
        /** @type {Record<string, Map<*, number>>} */
        this.itemIndexMaps = {};

        this.processVariantIndices();

        this.selectorData = this.processSelectorData(data.selector);
    }

    /**
     * @param {string} key
     * @returns {?Promise<Dataset>}
     */
    static fetch(key) {
        if (!(key in DATASETS_METADATA)) {
            throw new Error(`Invalid dataset key "${key}".`);
        }

        if (key in this._cache) return Promise.resolve(this._cache[key]);

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

    // ============================= INITIAL PROCESSING ============================
    processSelectorData(selectorData) {
        selectorData ??= {};
        selectorData.blocks ??= [selectorData.block ?? {}];
        delete selectorData.block;

        for (const block of selectorData.blocks) {
            if (block.letters) {
                block.indices = this.getLetterIndices(block.letters, selectorData.defaultLetterKey);
            }
        }

        return selectorData;
    }

    processMetadata(metadata) {
        metadata = Object.assign({}, DEFAULT_METADATA, metadata);
        metadata.terms.letter ||= "letter";
        metadata.terms.letters ||= metadata.terms.letter + "s";
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

    processProperties(properties) {
        for (const data of Object.values(properties)) {
            data.factory = QuizAnswerFactory(data.config);
        }
        return properties;
    }

    processVariantIndices() {
        if (!this.variants) return;

        for (const [key, value] of Object.entries(this.variants.data)) {
            if (this.variants.useKeyAsLang) value.lang ??= key;

            if (value.letters) {
                value.indices = this.getLetterIndices(value.letters, this.variants.defaultLetterKey);
                value.includesItem = new Array(this.items.length).fill(false);
                for (const index of value.indices) {
                    value.includesItem[index] = true;
                }
            } else {
                value.indices = range(this.items.length);
                value.includesItem = new Array(this.items.length).fill(true);
            }
        }
    }

    /**
     * @param {string[]} properties
     * @param {any[][]} data
     * @returns {DatasetItem[]}
     */
    processItems({properties, data}) {
        const propParams = properties.map(key => {
            const [prop, params] = processPropKey(key);
            if (!(prop in this.properties)) throw new Error("Unknown property " + prop);
            return [prop, params];
        });

        return data.map(([forms, propValues]) => new DatasetItem(
            this.processLetterForms(forms),
            this.processItemProperties(propParams, propValues)
        ));
    }

    /**
     * @param {[string, Record<string, string[]>][]} propParams
     * @param {(string|Record<string, *>)[]} values
     * @returns {Record<string, ParametricValue>}
     */
    processItemProperties(propParams, values) {
        const paramKeys = [];
        if (this.hasVariants()) paramKeys.push("variant");
        if (this.hasSetting("language")) paramKeys.push("language");

        const result = ObjectUtils.map(this.properties, () => new ParametricValue(paramKeys));

        if (typeof values === "string") values = [values];

        for (const [index, [prop, params]] of propParams.entries()) {
            if (index >= values.length) break;
            extendPropertyValue(result[prop], params, values[index]);
        }

        return result;
    }

    /**
     * @param {string|string[]|Record<string,string>} display
     * @returns {Record<string, string>}
     */
    processLetterForms(display) {
        if (Object.keys(this.forms.data).length === 1) {
            if (Array.isArray(display)) display = display[0];

            return Object.fromEntries([[Object.keys(this.forms.data)[0], display]]);
        }

        if (typeof display === "string") display = display.split("");

        if (Array.isArray(display)) {
            const forms = {};
            const formKeys = Object.keys(this.forms.data);
            for (const [index, value] of display.entries()) {
                if (value) forms[formKeys[index]] = value;
            }
            return forms;
        }

        if (typeof display !== "object") {
            throw new Error("Invalid display format: need array or object.");
        }

        return ObjectUtils.onlyKeys(display, Object.keys(this.forms.data), true);
    }


    // ============================= SETTINGS ============================
    getGameSettings(checked = {}) {
        const settings = {};
        if (this.hasSetting("properties")) {
            settings.properties = this.propertySetting(checked.properties);
        }
        if (this.hasSetting("language")) {
            settings.language = this.languageSetting(checked.language);
        }
        return SettingCollection.createFrom(settings);
    }

    getSelectorSettings(checked = {}) {
        const settings = {};
        if (this.hasVariants()) {
            settings.variant = this.variantSetting(checked.variant);
        }
        if (this.hasSetting("forms")) {
            settings.forms = this.formsSetting(checked.forms);
        }
        return SettingCollection.createFrom(settings);
    }

    /**
     * @param {Record<string, boolean>} [checked]
     * @returns {ButtonGroup}
     */
    propertySetting(checked) {
        return ButtonGroup.from(
            ObjectUtils.map(this.properties, p => p.label),
            {
                label: "Properties",
                checked: checked ?? ObjectUtils.map(this.properties, p => !!p.active)
            }
        );
    }

    /**
     * @param {string} [checked]
     * @returns {ButtonGroup}
     */
    languageSetting(checked) {
        return ButtonGroup.from(
            ObjectUtils.onlyKeys(LANGUAGES, this.languages.keys, true),
            {
                label: "Language",
                checked: checked ?? this.languages.default,
                exclusive: true
            }
        );
    }

    ungroupedForms() {
        return ObjectUtils.filter(this.forms.data, f => !("groupWith" in f));
    }

    /**
     * @param {string[]} [checked]
     * @returns {ButtonGroup|null}
     */
    formsSetting(checked) {
        if (!this.hasSetting("forms")) {
            return null;
        }

        const label = this.forms.label ?? (this.forms.exclusive ? "Form" : "Forms");
        const ungroupedForms = this.ungroupedForms();
        return ButtonGroup.from(
            ObjectUtils.map(ungroupedForms, (p) => p.label),
            {
                label: label,
                exclusive: this.forms.exclusive,
                checked: checked ?? ObjectUtils.map(ungroupedForms, f => f.active ?? !this.forms.exclusive),
            },
        );
    }

    /**
     * @param {string} [selected]
     * @returns {Setting}
     */
    variantSetting(selected) {
        const data = ObjectUtils.map(this.variants.data, (variant) => variant.label);
        selected ||=  this.variants.default || Object.keys(this.variants.data)[0];
        const label = this.variants.setting?.label || "Variant";

        if (this.variants.setting?.type === "buttonGroup") {
            return ButtonGroup.from(data, {
                label: label,
                exclusive: true,
                checked: selected
            });
        } else {
            const groups = this.variants.groups ? Object.values(this.variants.groups) : []
            return ValueElement.createSelect(data, {
                label: label,
                selected: selected,
                groups: groups
            });
        }
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
        return !!this.variants?.data;
    }


    // ==================================== SELECTOR ================
    /**
     * @param {SelectorGridBlock} block
     * @param {[number, number]} dimensions
     * @param {string} gaps
     * @param {"rows" | "columns"} [fillDirection="rows"]
     */
    setupSelectorGrid(block, {dimensions, gaps, fillDirection = "rows"} = {}) {
        const covered = new Matrix(...dimensions).fill(true);
        for (const [i, j] of parseMatrixRanges(gaps, x => parseInt(x) - 1)) {
            covered.set(i, j, false);
        }
        block.generateGrid(covered, fillDirection);
    }

    /**
     * @param {SelectorGridBlock} block
     * @param {string} type
     * @param {string | string[]} labels
     * @param {"start" | "end"} position
     */
    setupGridLabels(block, type, labels, position) {
        if (typeof labels === "string") {
            labels = labels.split("");
        }
        block.setGridLabels(type, labels, position);
    }

    /**
     * @returns {Selector}
     */
    createSelector() {
        const subsets = completeIndexSubsets(this.selectorData.blocks.map(block => block.indices), this.items.length);

        return new Selector(this.items, subsets, (items, b) => {
            const data = this.selectorData.blocks[b];
            if (data.grid) {
                const block = new SelectorGridBlock(items);

                this.setupSelectorGrid(block, data);
                if (data.rowLabels) this.setupGridLabels(block, "row", data.rowLabels, data.rowLabelPosition);
                if (data.columnLabels) this.setupGridLabels(block, "column", data.columnLabels, data.columnLabelPosition);

                if (data.rangeMode) block.setRangeMode(data.rangeMode);

                return block;
            } else {
                return new SelectorBlock(items);
            }
        });
    }

    getSelectorBlockStyles() {
        const baseStyle = this.selectorData.style ?? {};
        return this.selectorData.blocks.map(block => Object.assign(baseStyle, block.style));
    }

    /**
     * @param {string} [variant]
     * @returns {string | undefined}
     */
    getLang(variant) {
        if (variant) {
            if ("lang" in this.variants.data[variant]) return this.variants.data[variant].lang;
            if (this.variants.useKeyAsLang) return variant;
        }

        return this.metadata.lang;
    }

    getDir() {
        return this.metadata.dir;
    }

    /**
     * @param {string | Record<string,string>} which
     * @param {string} [defaultKey]
     * @returns {number[]}
     */
    getLetterIndices(which, defaultKey = "i1") {
        let result;
        if (typeof which === "string") {
            result = parseRanges(which, x => this.getLetterIndex(defaultKey, x));
        } else {
            result = Object.entries(which)
                .map(([key, ranges]) => parseRanges(
                    ranges, x => this.getLetterIndex(key, x)
                ))
                .flat();
        }

        if (containsDuplicates(result)) {
            console.warn("Indices contain duplicates");
            return Array.from(new Set(result));
        }

        return result;
    }

    /**
     * @param {string} key
     * @param {string | number} value
     * @returns {number}
     */
    getLetterIndex(key, value) {
        if (key === "i0" || key === "i1") {
            value = parseInt(value);
            return key === "i1" ? value - 1 : value;
        }

        let mapKey;

        if (key.substring(0, 5) === "prop:") {
            let [prop, params] = processPropKey(key.substring(5));
            params = toSingleParams(params);
            mapKey = "prop:" + createSinglePropKey(prop, params);
            this.itemIndexMaps[mapKey] ??= this.createPropertyIndexMap(prop, params);
        } else if (key === "form" || key.substring(0, 5) === "form:") {
            const formKey = key === "form" ? Object.keys(this.forms.data)[0] : key.substring(5);
            mapKey = "form:" + formKey;
            this.itemIndexMaps[mapKey] ??= this.createFormIndexMap(formKey);
        } else {
            throw new Error(`Invalid key ${key}.`);
        }

        if (!this.itemIndexMaps[mapKey].has(value)) {
            console.log(this.itemIndexMaps[mapKey]);
            throw new Error(`Couldn't find value ${value} with key ${mapKey}.`);
        }

        return this.itemIndexMaps[mapKey].get(value);
    }

    /**
     * @param {string} property
     * @param {Record<string, string>} params
     * @returns {Map<string|number, number>}
     */
    createPropertyIndexMap(property, params) {
        const splitter = this.getPropertySplitter(property);
        return new Map(this.items.map((item, index) => [
            item.getProperty({
                property: property,
                splitter: splitter,
                params: params
            }),
            index
        ]));
    }

    /**
     * @param {string} formKey
     * @returns {Map<string, number>}
     */
    createFormIndexMap(formKey) {
        return new Map(this.items.map(
            (item, index) => [item.forms[formKey], index]
        ));
    }

    /**
     * @param property
     * @returns {RegExp | null}
     */
    getPropertySplitter(property) {
        let config = this.properties[property].config;
        let regex = "";
        while (config.type === "list") {
            const splitter = config.properties?.splitter ?? DefaultListSplitter;
            if (regex.length > 0) regex += "|";
            regex += splitter;
            config = config.items;
        }
        return regex ? new RegExp(regex, "g") : null;
    }

    /**
     * @param {number} index
     * @param {string} [variant]
     * @return
     */
    isItemIncluded(index, variant) {
        return !variant || this.variants.data[variant].includesItem[index];
    }

    /**
     * @param {string[] | string} [value]
     * @returns {string[]}
     */
    getFormKeysFromGrouped(value) {
        if (!value) return Object.keys(this.forms.data);

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


    // ============================= FONTS ====================================
    /**
     * @param {string | Record<string, *>} font
     * @param {string} [variant]
     * @returns {Record<string, *>}
     */
    getFont(font = {}, variant) {
        if (typeof font === "string") font = {key: font};
        if ("family" in font) {
            console.warn(`Found family property "${font.family}" in font: Will be overwritten! Use 'key' property to reference dataset fonts instead.`);
        }

        font.key ??= this.defaultFontKey;
        if (!(font.key in this.fonts)) {
            console.error(`Unknown font key "${font.key}".`);
            font.key = this.defaultFontKey;
        }

        return ObjectUtils.withoutKeys(
            Object.assign({},
                this.fonts[font.key],
                this.getVariantFontModification(font.key, variant),
                font
            ),
            ["key", "default", "label"]
        );
    }

    /**
     * @param {string} key
     * @param {string} [variant]
     * @returns {Record<string, *>}
     */
    getVariantFontModification(key, variant) {
        if (variant) {
            const fonts = this.variants.data[variant].fonts;
            if (fonts && key in fonts) {
                return fonts[key];
            }
        }

        return {};
    }

    getSelectorDisplayFont(variant) {
        return this.getFont(this.selectorData.font, variant);
    }

    processFonts(fonts) {
        this.fonts = fonts;
        const defaultEntry = Object.entries(fonts).find(([_, font]) => font.default);
        this.defaultFontKey = defaultEntry ? defaultEntry[0] : Object.keys(fonts)[0];
    }

    /**
     * @param {string} [checked]
     * @returns {ButtonGroup}
     */
    fontFamilySetting(checked) {
        const setting = ButtonGroup.from(
            ObjectUtils.map(this.fonts, font => font.label ?? font.family),
            {
                label: "Font",
                exclusive: true,
                checked: checked ?? this.defaultFontKey
            }
        );
        setting.node.classList.add("font-family-setting");
        return setting;
    }


    // =================================== QUIZ ITEMS ===================================
    getAnswerFactories() {
        return ObjectUtils.map(this.properties, p => p.factory);
    }

    /**
     * @param {DatasetItem[]} items
     * @param {string[]} forms
     * @param {string[]} properties
     * @param {Record<string, string>} [params]
     * @returns {QuizItem[]}
     */
    getQuizItems(items, forms, properties, params) {
        const result = [];
        const factories = this.getAnswerFactories();

        for (const item of items) {
            const availableForms = item.getAvailableForms(forms);
            const answers = item.getQuizAnswers(properties, factories, params);
            result.push(availableForms.map(
                form => new QuizItem(item.getForm(form), answers)
            ));
        }

        return result.flat();
    }


    /**
     * @param {string[]} properties
     * @param {string[]} forms
     * @param {Record<string, string>} [params]
     * @returns {QuizItem[]}
     */
    getReferenceItems(properties, forms, params) {
        const factories = this.getAnswerFactories();

        if (!this.forms.exclusive) forms = Object.keys(this.forms.data);

        return this.items.map(item => new QuizItem(
            item.combineForms(forms),
            item.getQuizAnswers(properties, factories, params)
        ));
    }

    /**
     * @param {HTMLElement} element
     * @param {string} [variant]
     */
    setupGameHeading(element, variant) {
        const gameHeading = this.metadata.gameHeading;

        FontUtils.setFont(element, this.getFont(gameHeading.font, variant));

        if (this.name === "Atomic Elements") {
            const container = document.createElement("div");
            container.classList.add("element-heading-container");
            const els = [];
            for (const [no, symbol] of [[19, "K"], [85, "At"], [42, "Mo"], [16, "S"]]) {
                const el = DOMUtils.getTemplate("headingElement");
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
     * @param {Record<string, string>} forms
     * @param {Record<string, ParametricValue>} properties
     */
    constructor(forms, properties) {
        this.forms = forms;
        this.properties = properties;
    }

    /**
     * @param {string[]} properties
     * @param {Record<string, function>} factories
     * @param {Record<string, string>} [params]
     * @returns {Object<string,QuizAnswer>}
     */
    getQuizAnswers(properties, factories, params) {
        return ObjectUtils.fromKeys(properties, prop => factories[prop](this.properties[prop].get(params)));
    }

    /**
     * Returns the form keys that this letter possesses, optionally constrained to elements of the argument `forms`.
     * @param {string[]} forms
     * @returns {string[]}
     */
    getAvailableForms(forms) {
        return forms.filter(form => this.forms[form]);
    }

    /**
     * @param {string} form
     * @returns {StringLetter}
     */
    getForm(form) {
        return new StringLetter(this.forms[form], {form: form});
    }

    /**
     * @param {string} form
     * @returns {boolean}
     */
    hasForm(form) {
        return form in this.forms;
    }

    /**
     * @param {string[]} forms
     * @returns {LetterCombination}
     */
    combineForms(forms) {
        const letters = forms.filter(form => this.hasForm(form)).map(form => this.getForm(form));
        return new LetterCombination(letters);
    }

    /**
     * Counts the number of QuizItems this DatasetItem supplies, i.e. the number of form keys that are set
     * for this item.
     * @param forms
     */
    countQuizItems(forms) {
        return forms.reduce((acc, form) => form in this.forms ? acc + 1 : acc, 0);
    }

    /**
     * @param {string} property
     * @param {string | RegExp} [splitter]
     * @param {Record<string, string>} [params]
     * @returns {string | number}
     */
    getProperty({
        property,
        splitter,
        params = {}
    } = {}) {
        let value = this.properties[property].get(params);
        if (splitter) value = value.split(new RegExp(splitter, "g"))[0].trim();
        return value;
    }
}


/**
 * @param {string} prop
 * @param {Record<string, string>} params
 * @returns {string}
 */
function createSinglePropKey(prop, params) {
    let propKey = prop;
    for (const key of ["variant", "language"]) {
        if (key in params) propKey += `>${key}:${params[key]}`;
    }
    return propKey;
}

/**
 * @param {string} key
 * @returns {[string, Record<string, string[]>]}
 */
function processPropKey(key) {
    const [prop, paramsStr] = key.split(">", 2);
    return [prop, parsePropParams(paramsStr)];
}

/**
 * @param {string} paramsStr
 * @param {Record<string, string[]>} [baseParams]
 * @returns {Record<string, string[]>}
 */
function parsePropParams(paramsStr, baseParams) {
    const params = Object.assign({}, baseParams);
    if (!paramsStr) return params;

    for (const str of paramsStr.split(">")) {
        const [key, value] = str.split(":");
        extendPropParams(params, key, value);
    }

    return params;
}


const propKeyRegistry = {
    variant: ["v", "var", "variant"],
    language: ["l", "lang", "langauge"]
}
const propKeyDict = {};
for (const [k, vs] of Object.entries(propKeyRegistry)) {
    for (const v of vs) {
        propKeyDict[v] = k;
    }
}

/**
 * @param {Record<string, string[] | string>} params
 * @param {string} key
 * @param {string} value
 */
function extendPropParams(params, key, value) {
    if (!propKeyDict[key]) throw new Error("Invalid property key " + key);

    key = propKeyDict[key];
    if (key in params) throw new Error(`${key} already set.`);

    if (key === "variant" && "language" in params) {
        console.warn("Setting variant after language.");
    }

    params[key] = value.split(",");
}


/**
 * @param {ParametricValue} propVal
 * @param {Record<string, string | string[]>} params
 * @param {any} value
 */
function extendPropertyValue(propVal, params, value) {
    const isSingleValue = typeof value === "string" || typeof value === "number";

    if (isSingleValue) {
        propVal.set(params, value);
    } else {
        for (const [paramsStr, val] of Object.entries(value)) {
            extendPropertyValue(propVal, parsePropParams(paramsStr, params), val);
        }
    }
}

/**
 * @param {Record<string, string[]>} params
 * @returns {Record<string, string>}
 */
function toSingleParams(params) {
    const result = {};
    for (const [key, value] of Object.entries(params)) {
        if (value.length > 1) {
            throw new Error(`Can only parse index for one ${key} value.`);
        }

        if (value.length === 1) {
            result[key] = value[0];
        }
    }
    return result;
}
