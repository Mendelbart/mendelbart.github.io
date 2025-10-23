import {map as objectMap} from './object.js';

/**
 * @typedef {Element | NodeListOf<Element> | Element[]} Elements
 */

const TEMPLATES_HTML = {
    slider:
        `<div class="slider-container">
            <span class="range-min"></span><span class="range-value"></span><span class="range-max"></span>
            <input type="range" class="form-range">
        </div>`,
    buttonLabel: `<label class="button"></label>`,
    buttonInput: `<input class="button-check form-input" autocomplete="off">`,
    buttonGroupContainer: `<div class="button-group" role="group"></div>`,
    switch:
        `<div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch">
        </div>`,
    setting: `<div class="setting labeled-value-element"></div>`,
    eval: `<div class="item-eval">
        <span class="submitted"></span><span class="solution"></span>
    </div>`
}


/**
 * @type {{[p: string]: HTMLElement}}
 */
export const TEMPLATES = objectMap(TEMPLATES_HTML, (html) => {
    const template = document.createElement("TEMPLATE");
    template.insertAdjacentHTML("beforeend",  html);
    return template;
});

let IdPrefixCounter = 0;


/**
 * @param {string} type
 * @param {string} value
 * @param {string} labelContent
 * @param {string | null} id
 * @returns {[HTMLElement, HTMLElement]} [labelNode, inputNode]
 */
export function button(type, value, labelContent, id = null) {
    const label = getTemplate("buttonLabel");
    const input = getTemplate("buttonInput");
    id ??= uniqueIdPrefix("button") + value;

    setAttrs(input, {
        type: type,
        value: value,
        id: id
    });
    label.setAttribute("for", id);
    label.innerHTML = labelContent;

    return [input, label];
}

/**
 * @param {string | Node} element - Element or ID to label.
 * @param {string} content
 * @param {string | null} [defaultId]
 */
export function label(element, content, defaultId = null) {
    const label = document.createElement("LABEL");
    if (element instanceof Node) {
        element = setDefaultId(element, defaultId);
    }
    label.setAttribute("for", element);
    label.innerHTML = content;
    return label;
}

/**
 *
 * @param {HTMLSelectElement} select
 * @param {Object<string,string>} data
 * @param {?string} selected
 * @param {?(string[])} disabled
 */
export function setOptions(select, data, selected = null, disabled = null) {
    if (!selected) {
        selected = Object.keys(data)[0];
    }
    if (!disabled) {
        disabled = [];
    }
    for (const [key, value] of Object.entries(data)) {
        const option = document.createElement("OPTION");
        option.value = key;
        option.innerHTML = value;
        if (selected === key) {
            option.selected = "selected";
        }
        if (disabled.includes(key)) {
            option.disabled = "disabled";
        }
        select.add(option);
    }
}

/**
 * @param {Node} parent Parent node
 * @param {Node[] | NodeList} children Can be Object with Nodes as values.
 */
export function appendChildren(parent, children) {
    for (const child of children) {
        parent.appendChild(child);
    }
}

/**
 * @param {Object.<string,Element>} elements
 * @param {string[] | string} keys
 * @param {string} attr
 * @param {string} [value]
 */
export function setAttrOnKeys(elements, keys, attr, value = "") {
    if (!keys) {
        return;
    }
    if (typeof keys === "string") {
        keys = [keys];
    }
    for (const key of keys) {
        elements[key].setAttribute(attr, value);
    }
}

/**
 * Set the `attrs` on the `object`.
 * @param {Element} element
 * @param {Object.<string,string>} attrs
 */
export function setAttrs(element, attrs) {
    for (const [key, value] of Object.entries(attrs)) {
        if (value === false) {
            element.removeAttribute(key);
        } else if (key === "class") {
            addClass(element, value);
        } else {
            element.setAttribute(key, value);
        }
    }
}

/**
 * @param {string} prefix
 * @param {string} [connector] - default "_"
 * @returns {string}
 */
export function uniqueIdPrefix(prefix, connector = "_") {
    IdPrefixCounter += 1;
    return prefix + IdPrefixCounter + connector;
}

/**
 * If the node doesn't have an ID, set it to defaultId.
 * Return its ID.
 * @param {Element} element
 * @param {string} defaultId
 * @returns
 */
export function setDefaultId(element, defaultId) {
    if (element.hasAttribute("id")) {
        element.id = defaultId;
        return defaultId;
    } else {
        return element.id;
    }
}

/**
 * @param {Elements} elements
 * @param {function(Element): void} callback
 */
export function forEachElement(elements, callback) {
    if (!elements) {
        console.warn("No elements.");
        return;
    }
    if (elements instanceof Node) {
        callback(elements);
    } else {
        for (const element of elements) {
            callback(element);
        }
    }
}

/**
 * Toggle classes depending on the given `bool`: Add `trueClasses` and `falseClasses`
 * if `bool` is truthy, and vice versa.
 * @param {boolean} bool
 * @param {Elements} elements
 * @param {string | string[]} trueClasses
 * @param {string | string[]} [falseClasses]
 */
export function classIfElse(bool, elements, trueClasses, falseClasses = []) {
    if (!bool) {
        [trueClasses, falseClasses] = [falseClasses, trueClasses];
    }

    trueClasses = classesToList(trueClasses);
    falseClasses = classesToList(falseClasses);

    forEachElement(elements, (elem) => {
        elem.classList.remove(...falseClasses);
        elem.classList.add(...trueClasses);
    });
}

/**
 * @param {Elements} elements
 * @param {string | string[]} classes
 */
export function addClass(elements, classes) {
    classIfElse(true, elements, classes);
}

/**
 * @param {Elements} elements
 * @param {string | string[]} classes
 */
export function removeClass(elements, classes) {
    classIfElse(false, elements, classes);
}

/**
 * @param {Elements} elements
 */
export function show(elements) {
    forEachElement(elements, elem => {
        elem.style.display = "";
    });
    removeClass(elements, "hidden");
}

/**
 * @param {Elements} elements
 */
export function hide(elements) {
    forEachElement(elements, elem => {
        elem.style.display = "none";
    });
}

/**
 * @param {boolean} showFirst
 * @param {Elements} first
 * @param {Elements} second
 */
export function toggleShown(showFirst, first, second) {
    if (showFirst) {
        hide(second);
        show(first);
    } else {
        hide(first);
        show(second);
    }
}

/**
 * @param {string | string[]} classes
 * @returns {string[]}
 */
export function classesToList(classes) {
    classes ??= [];
    if (typeof classes === "string")
        return classes.split(" ");
    return Array.from(classes);
}

/**
 * Return the `n`th child of `container`.
 * If `n` is negative, return `-n`th last child.
 * @param {Element} container
 * @param {number} n
 * @returns {Element}
 */
export function nthChild(container, n) {
    const children = container.children;
    if (n < 0) {
        return children[children.length + n];
    } else {
        return children[n];
    }
}

/**
 * @param {string} key
 * @returns {HTMLElement}
 */
export function getTemplate(key) {
    if (!(key in TEMPLATES)) {
        console.error("Unknown template key " + key);
    }
    return TEMPLATES[key].firstChild.cloneNode(true);
}

/**
 * @param {Element} element
 * @param {boolean} with_padding
 * @returns {[number,number]} [width,height]
 */
export function elementSize(element, with_padding = false) {
    let width = element.clientWidth;
    let height = element.clientHeight;

    if (!with_padding) {
        const computedStyle = getComputedStyle(element);
        width -= parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
        height -= parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
    }

    return [width, height];
}

/**
 * Set global CSS, or specify an element.
 * @param {Object<string,string>} data
 * @param {HTMLElement} element
 */
export function setCSS(data, element = document.documentElement) {
    for (const [property, value] of Object.entries(data)) {
        element.style.setProperty(property, value);
    }
}