import * as ObjectHelper from "./object.js";
import {classIfElse} from './dom.js';
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
    family: "font-family",
    weight: "font-weight",
    scale: "--font-scale",
    shift: "--font-shift",
    styleset: "font-variant-alternates",
    letterSpacing: "--letter-spacing",
    lineHeight: "--line-height",
};

const FONT_TRANSFORM_PROPERTIES = ["shift", "scale", "letterSpacing"];

/**
 * @param {string | Record} family
 * @returns {Promise<FontFace>}
 */
export function loadFont(family) {
    if (!family) {
        return Promise.reject("No family given.");
    }

    if (typeof family === "object") {
        return loadFont(family.family);
    }

    if (!(family in FONT_FACES)) {
        FONT_FACES[family] = getFontFace(family);
        document.fonts.add(FONT_FACES[family]);
    }

    return FONT_FACES[family].load();
}

/**
 * @param {(string | Record)[]} families
 * @returns {Promise<Awaited<FontFace>[]>}
 */
export function loadFonts(families) {
    return Promise.all(families.map(family => loadFont(family)));
}

function defaultFontURL(family) {
    const url = `/kadmos/assets/fonts/${family.replaceAll(" ", "")}.woff2`;
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
        variationSettings = ObjectHelper.withoutKeys(variationSettings, "wght");
    }

    if (Object.keys(variationSettings).length > 0) {
        result.variationSettings = Object.entries(variationSettings).map(([key, value]) => `"${key}" ${value}`).join(",");
    }
    return result;
}


/**
 * Also used as `setFont(element, properties)` with a `properties.family` entry.
 *
 * @param {HTMLElement} element
 * @param {string | Object} family
 * @param {?{weight?, shift?, scale?, styleset?}} [properties]
 */
export function setFont(element, family, properties = null) {
    if (typeof family === "object") {
        if ("family" in family && typeof family.family === "string") {
            setFont(element, family.family, family);
            return;
        } else {
            throw new Error("Need properties.family of type string if family argument is omitted.");
        }
    }

    if (!(family in FONT_DATA)) {
        throw new Error(`Unknown family ${family}.`);
    }

    clearFont(element);
    setFontFamily(element, family);
    setFontProperties(element, applyDefaultProperties(properties, family));
}

function applyDefaultProperties(properties, family) {
    const newProps = Object.assign({}, properties);
    const defaultData = FONT_DATA[family];

    if ("shift" in defaultData) {
        newProps.shift = defaultData.shift + (properties.shift ?? 0);
    }
    if ("scale" in defaultData) {
        newProps.scale = defaultData.scale * (properties.scale ?? 1);
    }
    return newProps;
}

/**
 * @param family
 * @returns {Record<string,*>}
 */
export function getFontData(family) {
    return FONT_DATA[family];
}

/**
 * @param {HTMLElement} element
 * @param {{weight?, shift?, scale?, styleset?}} properties
 */
export function setFontProperties(element, properties) {
    let transform = false;

    for (const [key, value] of Object.entries(properties)) {
        if (key === "family") {
            continue;
        }

        if (!(key in FONT_PROPERTY_KEYS)) {
            console.warn(`Unknown font property '${key}'`);
            continue;
        }

        if (FONT_TRANSFORM_PROPERTIES.includes(key)) {
            transform = true;
        }

        if (key === "styleset") {
            if (!("family" in properties)) {
                console.error("Cannot set styleset without knowing family.");
            } else {
                setStylesets(element, value, properties.family);
            }
        } else {
            element.style.setProperty(FONT_PROPERTY_KEYS[key], value);
        }
    }

    classIfElse(transform, element, "font-transform");
}

function setFontFamily(element, family) {
    const font = FONT_DATA[family];
    element.style.fontFamily = family + ", " + (font.fallback ?? "system-ui, sans-serif");
    setFontProperties(element, ObjectHelper.onlyKeys(font, FONT_TRANSFORM_PROPERTIES));
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
