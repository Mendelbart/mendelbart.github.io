import * as ObjectUtils from "./object";
import _font_data from '../../json/fonts.json';

const FONT_DATA = Object.fromEntries(_font_data.map(font => [font.family, font]));
const DEFAULT_FONTFACE_DATA = {
    display: "swap",
    weight: 400,
    style: "normal",
};

/** @type {Record<string,FontFace>} */
const FONT_FACES = {};

const FONT_PROPERTY_KEYS = {
    weight: "font-weight",
    scale: "--font-scale",
    shift: "--font-shift",
    styleset: "font-variant-alternates",
    letterSpacing: "--letter-spacing",
    lineHeight: "--line-height",
};

const FONT_TRANSFORM_PROPERTIES = ["shift", "scale", "letterSpacing", "lineHeight"];

function defaultFontURL(family) {
    const url = `/kadmos/assets/fonts/scripts/${family.replaceAll(" ", "")}.woff2`;
    const format = supportsVariableFonts() ? 'woff2-variations' : 'woff2';
    return `url("${url}") format("${format}")`;
}

function supportsSupports() {
    return "CSS" in window && "supports" in CSS;
}

export function supportsStylesets() {
    return supportsSupports() && CSS.supports("font-variant-alternates", "styleset(x)");
}

export function supportsVariableFonts() {
    return supportsSupports() && CSS.supports("font-variation-settings", "normal");
}

/**
 * @param family
 * @returns {FontFace}
 */
function getFontFace(family) {
    const data = Object.assign({}, DEFAULT_FONTFACE_DATA, FONT_DATA[family]);

    if ("styleset" in data && supportsStylesets()) {
        document.styleSheets[0].insertRule(
            `@font-feature-values "${family}" {@styleset {` +
            Object.entries(data.styleset).map(([name, value]) => `${name}: ${value};`).join("") +
            '}}'
        );
        delete data.styleset;
    }

    if ("variationSettings" in data) {
        const newDescriptors = digestFontVariationSettings(data.variationSettings);
        delete data.variationSettings;
        Object.assign(data, newDescriptors);
    }

    return new FontFace(family, data.url ?? defaultFontURL(family), data);
}

function digestFontVariationSettings(variationSettings) {
    const result = {};
    if ("wght" in variationSettings) {
        result.weight = variationSettings.wght;
        variationSettings = ObjectUtils.withoutKeys(variationSettings, "wght");
    }

    if (Object.keys(variationSettings).length > 0) {
        result.variationSettings = Object.entries(variationSettings).map(([key, value]) => `"${key}" ${value}`).join(",");
    }

    return result;
}


/**
 * @param {HTMLElement} element
 */
export function clearFont(element) {
    for (const property of Object.values(FONT_PROPERTY_KEYS)) {
        element.style.removeProperty(property);
    }
}

/**
 * @param {HTMLElement} element
 * @param {string|string[]} stylesets
 * @param {string} family
 */
function setStylesets(element, stylesets, family) {
    stylesets = Array.isArray(stylesets) ? stylesets : [stylesets];

    const variantStr = `styleset(${stylesets.join(", ")})`

    if (supportsStylesets()) {
        element.style.setProperty("font-variant-alternates", variantStr);
    } else {
        const ssIDs = stylesets.map(name => FONT_DATA[family].styleset[name]);
        const ssIDsStr = ssIDs.map(id => `"ss${id.toString().padStart(2, "0")}"`).join(', ');
        element.style.setProperty("font-feature-settings", ssIDsStr);
    }
}



export class Font {
    /**
     * @param {string} family
     * @param {Record<string, *>} params
     */
    constructor(family, params = {}) {
        this.constructor.validateFamily(family);
        this.family = family;
        this.params = ObjectUtils.onlyKeys(params, Object.keys(FONT_PROPERTY_KEYS), true);
    }

    /**
     * @param {string} family
     * @returns {Font}
     */
    static get(family) {
        this.validateFamily(family);
        const params = ObjectUtils.onlyKeys(FONT_DATA[family], FONT_TRANSFORM_PROPERTIES);
        return new this(family, params);
    }

    static validateFamily(family) {
        if (!(family in FONT_DATA)) {
            throw new Error(`Unknown family ${family}.`);
        }
    }

    /**
     * @returns {Promise<FontFace>}
     */
    load() {
        if (!(this.family in FONT_FACES)) {
            FONT_FACES[this.family] = getFontFace(this.family);
            document.fonts.add(FONT_FACES[this.family]);
        }

        return FONT_FACES[this.family].load();
    }

    /**
     * @param {Record<string, *>} [params]
     * @param {Record<string, *>} [args]
     * @returns {Font}
     */
    applyParams(params, ...args) {
        if (!params) return this;

        const newParams = Object.assign({}, this.params);
        for (const [key, value] of Object.entries(params)) {
            if (key === "shift") {
                newParams.shift ??= 0;
                newParams.shift += value;
            } else if (key === "scale") {
                newParams.scale ??= 1;
                newParams.scale *= value;
            } else {
                newParams[key] = value;
            }
        }

        return new this.constructor(this.family, newParams).applyParams(...args);
    }

    /**
     * @param {HTMLElement} element
     */
    applyTo(element) {
        const data = this.getFontData();

        clearFont(element);
        element.style.fontFamily = this.family + ", " + (data.fallback ?? "system-ui, sans-serif");

        let transform = false;
        for (let [key, value] of Object.entries(this.params)) {
            if (FONT_TRANSFORM_PROPERTIES.includes(key)) {
                transform = true;
            }

            if (key === "styleset") {
                setStylesets(element, value, this.family);
            } else {
                if (typeof value === "number") {
                    value = Math.round(value * 10000) / 10000;
                }
                element.style.setProperty(FONT_PROPERTY_KEYS[key], value);
            }
        }

        element.classList.add("font-transform");
    }

    getFontData() {
        return FONT_DATA[this.family];
    }

    /**
     * @returns {[number, number]}
     */
    getWeightLimits() {
        const data = this.getFontData();
        const weightsStr = data.variationSettings?.wght ?? "100 900";
        const [min, max] = weightsStr.split(" ").map(x => parseInt(x));
        return [min, max];
    }
}

