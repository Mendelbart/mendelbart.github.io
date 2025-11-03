/**
 * @typedef {Element | NodeListOf<Element> | Element[] | HTMLCollection} Elements
 */


let IdPrefixCounter = 0;

/**
 * @type {Record<string. HTMLTemplateElement>}
 */
const TEMPLATES = {};

/**
 * @param {Record<string,string>} htmls
 */
export function registerTemplates(htmls) {
    for (const [key, html] of Object.entries(htmls)) {
        registerTemplate(key, html);
    }
}

/**
 * Register a template, which can be retrieved as a Node using `getTemplate(key)`.
 * @param {string} key
 * @param {string} html
 */
export function registerTemplate(key, html) {
    if (key in TEMPLATES) {
        console.warn(`Overwriting existing template key ${key}.`);
    }

    const template = document.createElement("TEMPLATE");
    template.insertAdjacentHTML("beforeend",  html);
    TEMPLATES[key] = template;
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

registerTemplates({
    buttonLabel: `<label class="button"></label>`,
    buttonInput: `<input class="button-check form-input" autocomplete="off">`
});

/**
 * @param {string} type
 * @param {string} value
 * @param {string | Node | null} labelContent
 * @param {string | null} id
 * @returns {[HTMLElement, HTMLElement]} [inputNode, labelNode]
 */
export function button(type, value, labelContent = null, id = null) {
    const input = getTemplate("buttonInput");
    const label = getTemplate("buttonLabel");
    id ??= uniqueIdPrefix("button") + value;

    setAttrs(input, {
        type: type,
        value: value,
        id: id
    });
    label.setAttribute("for", id);

    if (labelContent) {
        if (typeof labelContent === "string") {
            labelContent = document.createTextNode(labelContent);
        }
        label.appendChild(labelContent);
    }

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
    label.textContent = content;
    return label;
}

/**
 * @param {string} html
 * @returns {HTMLCollection}
 */
export function htmlToElements(html) {
    const template = document.createElement("TEMPLATE");
    template.innerHTML = html;
    return template.content.children;
}

/**
 * @param {string} html
 */
export function htmlToElement(html) {
    const elements = htmlToElements(html);
    if (elements.length !== 1) {
        throw new Error("HTML doesn't contain exactly one element.");
    }
    return elements[0];
}

/**
 * @param {string} str of the format tag#id.class1.class2 etc
 */
export function createElement(str) {
    const [tagId, ...classes] = str.split(".");

    let tag, id;
    if (tagId.includes("#")) {
        [tag, id] = tagId.split("#");
    } else {
        tag = tagId;
        id = null;
    }

    const element = document.createElement(tag);
    if (id) {
        element.id = id;
    }

    element.classList.add(...classes);
    return element;
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
    if (typeof classes === "string")
        return classes.split(" ");
    return Array.from(classes);
}

/**
 * @param {Element} element element
 * @param {"content-box" | "padding-box" | "border-box"} [box] default `"border-box"`
 * @param {boolean} [scrollSize] default `false`
 * @returns {[number,number]} [width, height]
 */
export function elementSize(element, box = "border-box", scrollSize = false) {
    let width = scrollSize ? element.scrollWidth : element.clientWidth;
    let height = scrollSize ? element.scrollHeight : element.clientHeight;

    const style = window.getComputedStyle(element);

    let scale = style.scale;
    if (!scale || scale === "none") {
        scale = 1;
    } else {
        scale = parseFloat(scale);
    }

    if (box === "border-box") {
        width += scale * (parseFloat(style.borderLeftWidth || 0) + parseFloat(style.borderRightWidth || 0));
        height += scale * (parseFloat(style.borderTopWidth || 0) + parseFloat(style.borderBottomWidth || 0));
    } else if (box === "content-box") {
        width -= scale * (parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0));
        height -= scale * (parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0));
    } else if (box !== "padding-box") {
        console.error("Invalid value for element size box, use padding-box, content-box or border-box.");
    }

    return [width, height];
}


/**
 * @param {Element} element
 * @param {?Element} container - default `element.parentElement`
 * @param {"width" | "height" | "both"} dimension
 * @param {"content-box" | "padding-box" | "border-box"} elementBox
 * @param {"content-box" | "padding-box" | "border-box"} containerBox
 * @param {boolean} grow
 */
export function scaleToFit(element, {
    container = null,
    dimension = "width",
    elementBox = "border-box",
    containerBox = "content-box",
    grow = false
}) {
    container ??= element.parentElement;

    let [elementWidth, elementHeight] = elementSize(element, elementBox, true);
    let [containerWidth, containerHeight] = elementSize(container, containerBox);

    const scaleWidth = getScale(elementWidth, containerWidth, grow);
    const scaleHeight = getScale(elementHeight, containerHeight, grow);

    if (!["width", "height", "both"].includes(dimension)) {
        console.error("Invalid dimension, use 'width', 'height' or 'both'.");
        dimension = "width";
    }
    return dimension === "width" ? scaleWidth : dimension === "height" ? scaleHeight : Math.min(scaleWidth, scaleHeight);
}


/**
 * @param {Element[]} elements
 * @param options
 */
export function scaleAllToFit(elements, options) {
    const uniformFactor = options.uniform ?? 0;
    const containers = options.containers ?? elements.map(element => element.parentElement);
    if ("container" in options) {
        console.warn("Can't set single container for scaleAllToFit.");
        delete options.container;
    }

    if (!Array.isArray(containers) || containers.length !== elements.length) {
        console.error("Containers and elements length don't match.");
        return;
    }

    const scales = elements.map(
        (element, index) => scaleToFit(
            element,
            Object.assign(options, {container: containers[index]})
        )
    );

    if (uniformFactor > 0) {
        const minScale = Math.min(...scales);
        const newMaxScale = minScale / uniformFactor;
        for (const [index, scale] of scales.entries()) {
            scales[index] = Math.min(newMaxScale, scale);
        }
    }

    for (const [index, element] of elements.entries()) {
        element.style.scale = scales[index];
    }
}

function getScale(elementSize, containerSize, grow = false) {
    if (elementSize === 0) {
        console.warn("getScale: Element's size is 0.");
        return 1;
    }

    if (isNaN(elementSize)) {
        console.error("Element size is NaN.");
        return 1;
    }
    if (isNaN(containerSize)) {
        console.error("Container size is NaN.");
        return 1;
    }

    let scale = containerSize / elementSize;

    return grow ? scale : Math.min(scale, 1);
}

/**
 * @param {[function, ...*][]} updates
 * @param {string[]} fonts
 */
export function batchUpdate(updates, fonts = []) {
    Promise.all(fonts.map(font => document.fonts.load(`16px "${font}"`))).then(() => {
        requestAnimationFrame(() => {
            for (const [update, ...args] of updates) {
                update(...args);
            }
        });
    });
}