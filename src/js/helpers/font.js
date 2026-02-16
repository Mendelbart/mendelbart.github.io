import * as ObjectHelper from "./object.js";
import {classIfElse} from './dom.js';
import _font_data from '../../json/fonts.json';

const FONT_DATA = Object.fromEntries(_font_data.map(font => [font.family, font]));

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
 * @param {HTMLElement} element
 * @param {{family, weight?, shift?, scale?, styleset?}} properties
 */
export function setFont(element, properties) {
    clearFont(element);
    if (!properties.family) {
        throw new Error("Key 'family' in properties required. Otherwise use setFontProperties instead.");
    }

    const family = properties.family;
    setFontFamily(element, family);
    const newProps = Object.assign({}, properties);
    const defaultData = FONT_DATA[family];
    if ("shift" in defaultData) {
        newProps.shift = defaultData.shift + (properties.shift ?? 0);
    }
    if ("scale" in defaultData) {
        newProps.scale = defaultData.scale * (properties.scale ?? 1);
    }
    setFontProperties(element, newProps);
}

/**
 * @param family
 * @returns {Promise<Record<string,*>>}
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

export function setFontFamily(element, family) {
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

    if (window.CSS.supports("font-variant-alternates", variantStr)) {
        element.style.setProperty("font-variant-alternates", variantStr);
    } else {
        const ssIDs = stylesets.map(name => FONT_DATA[family].styleset[name]);
        const ssIDsStr = ssIDs.map(id => `"ss${id.toString().padStart(2, "0")}"`).join(', ');
        element.style.setProperty("font-feature-settings", ssIDsStr);
    }
}
