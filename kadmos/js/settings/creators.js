import {DOMHelper, ObjectHelper} from "../helpers/helpers.js";
import {ValueElement, SingleNodeValueElement, ButtonGroup, Slider} from "./valueelement.js";

/**
 * @param {Record<string,any>} attrs
 * @returns {SingleNodeValueElement}
 */
export function createInput(attrs) {
    const node = document.createElement("INPUT");
    DOMHelper.setAttrs(node, attrs);
    return new SingleNodeValueElement(node);
}

/**
 *
 * @param {Record<string,string> | string[]} data
 * @param {boolean} [exclusive]
 * @param {?string} [name]
 * @param {?string|string[]|Record<string,boolean>} [checked]
 * @param {?string|string[]|Record<string,boolean>} [disabled]
 * @param {?HTMLElement} [container]
 * @param {boolean} [decheckable]
 * @returns {ButtonGroup}
 */
export function createButtonGroup(data, {
    exclusive = false,
    name= null,
    checked = null,
    disabled = null,
    container = null,
    decheckable = false
} = {}) {
    if (Array.isArray(data)) {
        data = Object.fromEntries(data.map(x => [x, x]));
    }

    const values = Object.keys(data);
    const type = exclusive ? "radio" : "checkbox";
    name ??= ValueElement.generateName("buttongroup_")

    if (exclusive) {
        if (typeof checked === "string") {
            checked = [checked];
        }

        if (!decheckable && checked === null) {
            checked = [values[0]];
        }
    }

    checked = ObjectHelper.subsetToBoolRecord(checked ?? "none", values);
    disabled = ObjectHelper.subsetToBoolRecord(disabled ?? "none", values);

    if (!container) {
        container = DOMHelper.getTemplate("buttonGroupContainer");
    } else {
        container.replaceChildren();
    }

    for (const [value, displayName] of Object.entries(data)) {
        const [input, label] = DOMHelper.button(type, value, displayName);
        const valueName = exclusive ? name : `${name}_${value}`;

        DOMHelper.setAttrs(input, {
            name: valueName,
            disabled: disabled[value],
            checked: checked[value]
        });

        if (exclusive && decheckable) {
            input.addEventListener("click", (e) => {
                if (e.target.checked) {
                    e.target.checked = false;
                }
            });
        }

        container.append(input, label);
    }

    return new ButtonGroup(container, exclusive, decheckable);
}


/**
 * @param {number} min
 * @param {number} max
 * @param {number} value
 */
export function createSlider(min, max, value) {
    const node = DOMHelper.getTemplate("slider");
    const input = node.lastElementChild;
    DOMHelper.setAttrs(input, {min: min.toString(), max: max.toString(), step: "1"});

    const slider = new Slider(node, min, max);
    slider.setValue(value);
    return slider;
}
