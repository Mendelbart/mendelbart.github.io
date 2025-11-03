import * as ObjectHelper from "./object.js";
import {classIfElse} from './dom.js';

/**
 * @type {Record<string,Record<string,*>>}
 */
const FONT_DATA = {};

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
 * @type {Record<string,*>}
 */
const fontDataReady = fetch("/kadmos/json/fonts.json")
    .then(response => response.json())
    .then(json => {
        for (const fontData of json) {
            FONT_DATA[fontData.family] = fontData;
        }
    });

// const fontSetupPromise = Promise.all([
//     fetch("/kadmos/json/fonts.json").then(response => response.json()),
//     document.fonts.ready
// ]).then(([json, fontFaceSet]) => {
//     for (const fontData of json) {
//         FONT_DATA[fontData.family] = fontData;
//
//         const weight = fontData.weight ??
//             ("variationSettings" in fontData && "wght" in fontData.variationSettings
//             ?  fontData.variationSettings.wght
//             : 400);
//
//         const descriptors = {
//             weight: weight,
//             style: fontData.style ?? "normal",
//             display: "swap"
//         };
//
//         if ("variationSettings" in fontData) {
//            descriptors.variationSettings = variationSettingsString(fontData.variationSettings);
//         }
//
//         const source = `url("/kadmos/assets/fonts/subset/${fontData.subsetFilename}")`;
//
//         fontFaceSet.add(new FontFace(fontData.family, source, descriptors));
//     }
// });
//
//
// function variationSettingsString(params) {
//     return Object.entries(params)
//         .filter(([k,_]) => k !== "wght")
//         .map(([key, value]) => `"${key}" ${value}`)
//         .join(",");
// }
//
// async function loadFontFamily(family) {
//     await fontSetupPromise;
//     await document.fonts.load(`1rem "${family}"`);
// }

/**
 * @param {HTMLElement} element
 * @param {{family, weight?, shift?, scale?, styleset?}} properties
 */
export function setFont(element, properties) {
    clearFont(element);
    if ("family" in properties) {
        setFontFamily(element, properties.family).then(() => {
            setFontProperties(element, properties);
        });
    } else {
        setFontProperties(element, properties);
    }
}

/**
 * @param family
 * @returns {Promise<Record<string,*>>}
 */
export function getFontData(family) {
    return fontDataReady.then(() => {
        return FONT_DATA[family];
    })
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
    return fontDataReady.then(() => {
        const font = FONT_DATA[family];
        element.style.fontFamily = family + ", " + (font.fallback ?? "system-ui, sans-serif");
        setFontProperties(element, ObjectHelper.onlyKeys(font, FONT_TRANSFORM_PROPERTIES));
    });
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
        fontDataReady.then(() => {
            const ssIDs = stylesets.map(name => FONT_DATA[family].styleset[name]);
            const ssIDsStr = ssIDs.map(id => `"ss${id.toString().padStart(2, "0")}"`).join(', ');
            element.style.setProperty("font-feature-settings", ssIDsStr);
        });
    }
}
