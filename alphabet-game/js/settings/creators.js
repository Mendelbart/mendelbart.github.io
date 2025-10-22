import {DOMHelper, ObjectHelper} from "../helpers/helpers.js";
import {ValueElement, SingleNodeValueElement, ButtonGroup, Slider, LogarithmicSlider} from "./valueelement.js";

/**
 * Create a setting using a select box.
 * @param {Object} options  `value => htmlcontent` pairs for <option> elements
 * @param {string} selected value of selected option
 * @param {string[]} [disabled] values of disabled options
 * @returns {ValueElement}
 */
export function createSelect(options, selected, disabled = null) {
    const select = document.createElement("SELECT");
    const optionElements = ObjectHelper.map(options, (content, value) => {
        const option = document.createElement("OPTION");
        option.setAttribute("value", value);
        option.innerHTML = content;
        return option;
    });

    DOMHelper.setAttrOnKeys(optionElements, selected, "selected");
    DOMHelper.setAttrOnKeys(optionElements, disabled, "disabled");

    DOMHelper.appendChildren(select, Object.values(optionElements));

    const container = document.createElement("DIV");
    container.classList.add("styled-select");
    container.appendChild(select);

    return new SingleNodeValueElement(container);
}

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
 * @param {boolean} checked
 * @param {Object} [checkboxAttrs]
 * @returns {SingleNodeValueElement}
 */
export function createSwitch(checked, checkboxAttrs = {}) {
    if (checked) {
        checkboxAttrs.checked = "checked";
    } else if ("checked" in checkboxAttrs) {
        delete checkboxAttrs.checked;
    }

    const node = DOMHelper.getTemplate("switch");
    DOMHelper.setAttrs(node.querySelector("INPUT"), checkboxAttrs);

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
 * @param {Object} [options]
 */
export function createSlider(min, max, value, options = {}) {
    const digits = options.digits ?? 0;
    const SliderType = options.logarithmic ? LogarithmicSlider : Slider;
    const nSteps = SliderType.calculateNSteps(min, max, digits, options);

    const node = DOMHelper.getTemplate("slider");
    const input = node.lastElementChild;
    DOMHelper.setAttrs(input, {min: 0, max: nSteps, step: 1});

    if (options.attrs) {
        DOMHelper.setAttrs(input, options.attrs);
    }

    const slider = new SliderType(node, min, max, nSteps, digits);
    slider.setValue(value);
    return slider;
}
