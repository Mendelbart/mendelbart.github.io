/**
 * @typedef {Element | NodeListOf<Element> | Element[]} Elements
 */

/**
 * @typedef {Object.<string,*>} SettingData
 * @property {string} type
 * @property {boolean} [checked]
 */

const TEMPLATES_HTML = {
    slider:
        `<div class="slider-container">
            <span class="range-min"></span>
            <span class="range-value"></span>
            <span class="range-max"></span>
            <input type="range" class="form-range">
        </div>`,
    buttonLabel: `<label class="btn btn-outline-primary"></label>`,
    buttonInput: `<input class="btn-check form-input" autocomplete="off">`,
    buttonGroupContainer: `<div class="btn-group" role="group"></div>`,
    switch: `<div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" role="switch">
    </div>`,
    settingLabel: `<label class="setting-label"></label>`,
    inputRow: `<div class="input-row">
        <input type="text" class="game-input">
        <span class="eval-field eval-entered"></span>
        <span class="eval-field eval-solution"></span>
    </div>`,
}



export class ObjectHelper {
    /**
     * @template V,W
     * @param {Object<string,V>} obj
     * @param {function(V,string,number): W} fn
     * @returns {Object<string,W>}
     */
    static map(obj, fn) {
        return Object.fromEntries(
            Object.entries(obj).map(
                ([k, v], i) => [k, fn(v, k, i)]
            )
        );
    }

    /**
     * @template V
     * @param {Object<string,V>} obj
     * @param {function(V,string,number): boolean} fn
     * @returns {Object<string,V>}
     */
    static filter(obj, fn) {
        return Object.fromEntries(
            Object.entries(obj).filter(
                ([k, v], i) => fn(v, k, i)
            )
        );
    }

    /**
     * @param {Object} object
     * @param {Array} keys
     * @returns {Object}
     */
    static withoutKeys(object, keys) {
        const result = Object.assign({}, object);
        for (const key of keys) {
            delete result[key];
        }
        return result;
    }

    /**
     * @param {Object} object
     * @param {Array} keys
     * @param {boolean} [appendObject]
     * @returns {Array}
     */
    static extractKeys(object, keys, appendObject = true) {
        const arr = keys.map((key) => object[key] ?? null);
        if (appendObject)
            arr.push(this.withoutKeys(object, keys));
        return arr;
    }

    /**
     * @param {Object} object
     * @param {Array} keys
     * @returns {Object}
     */
    static onlyKeys(object, keys) {
        return Object.fromEntries(keys.map(key => [key, object[key]]));
    }

    static assignKeyCallback(object, assigned, keyCallback) {
        for (const [key, value] of Object.entries(assigned)) {
            object[keyCallback(key)] = value;
        }
    }
}

/**
 * @type {{[p: string]: HTMLElement}}
 */
export const TEMPLATES = ObjectHelper.map(TEMPLATES_HTML, (html) => {
    const template = document.createElement("TEMPLATE");
    template.insertAdjacentHTML("beforeend",  html);
    return template;
});

export class DOMHelper {
    static IdPrefixCounter;

    /**
     * @param {string} type
     * @param {string} value
     * @param {string} labelContent
     * @param {string | null} id
     * @returns {[HTMLElement, HTMLElement]} [labelNode, inputNode]
     */
    static button(type, value, labelContent, id = null) {
        const label = this.getTemplate("buttonLabel");
        const input = this.getTemplate("buttonInput");
        id ??= this.uniqueIdPrefix("button") + value;

        this.setAttrs(input, {
            type: type,
            value: value,
            id: id
        });
        label.setAttribute("for", id);
        label.innerHTML = labelContent;

        return [input, label];
    }

    static attributeKeys(value, keys) {
        if (!value) {
            return [];
        } else if (typeof value === "string") {
            return [value];
        } else if (value === true) {
            return keys;
        } else {
            return value;
        }
    }

    /**
     *
     * @param {Object<string,string>} data
     * @param {string} type
     * @param {?string} name
     * @param {?string|string[]} checked
     * @param {?string|string[]} disabled
     * @param {?HTMLElement} container
     * @returns {HTMLElement}
     */
    static buttonGroup(data, {
            type, name, checked = null, disabled = null, container = null
        }) {
        const values = Object.keys(data);

        if (type === "radio") {
            checked ??= values[0];
        } else {
            checked = this.attributeKeys(checked, values);
        }
        disabled = this.attributeKeys(disabled, values);

        if (!container) {
            container = this.getTemplate("buttonGroupContainer");
        } else {
            container.replaceChildren();
        }

        for (const [value, displayName] of Object.entries(data)) {
            const [input, label] = this.button(type, value, displayName);
            let valueName = name;
            if (type === "checkbox") {
                valueName += "_" + value;
            }
            this.setAttrs(input, {
                name: valueName,
                disabled: disabled.includes(value),
                checked: checked.includes(value)
            });
            container.append(input, label);
        }

        return container;
    }

    /**
     * @param {string | Node} element - Element or ID to label.
     * @param {string} content
     * @param {string | null} [defaultId]
     */
    static label(element, content, defaultId = null) {
        const label = document.createElement("LABEL");
        if (element instanceof Node) {
            element = this.setDefaultId(element, defaultId);
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
    static setOptions(select, data, selected = null, disabled = null) {
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
    static appendChildren(parent, children) {
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
    static setAttrOnKeys(elements, keys, attr, value = "") {
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
     * @param {Object.<string,any>} attrs
     */
    static setAttrs(element, attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            if (value === false) {
                element.removeAttribute(key);
            } else if (key === "class") {
                this.addClass(element, value);
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
    static uniqueIdPrefix(prefix, connector = "_") {
        this.IdPrefixCounter += 1;
        return prefix + this.IdPrefixCounter + connector;
    }

    /**
     * If the node doesn't have an ID, set it to defaultId.
     * Return its ID.
     * @param {Element} element
     * @param {string} defaultId
     * @returns
     */
    static setDefaultId(element, defaultId) {
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
    static forEachElement(elements, callback) {
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
    static classIfElse(bool, elements, trueClasses, falseClasses = []) {
        if (!bool) {
            [trueClasses, falseClasses] = [falseClasses, trueClasses];
        }

        trueClasses = this.classesToList(trueClasses);
        falseClasses = this.classesToList(falseClasses);

        this.forEachElement(elements, (elem) => {
            elem.classList.remove(...falseClasses);
            elem.classList.add(...trueClasses);
        });
    }

    /**
     * @param {Elements} elements
     * @param {string | string[]} classes
     */
    static addClass(elements, classes) {
        this.classIfElse(true, elements, classes);
    }

    /**
     * @param {Elements} elements
     * @param {string | string[]} classes
     */
    static removeClass(elements, classes) {
        this.classIfElse(false, elements, classes);
    }

    /**
     * @param {Elements} elements
     */
    static show(elements) {
        this.forEachElement(elements, elem => {
            elem.style.display = "";
        });
        this.removeClass(elements, "hidden");
    }

    /**
     * @param {Elements} elements
     */
    static hide(elements) {
        this.forEachElement(elements, elem => {
            elem.style.display = "none";
        });
    }

    /**
     * @param {boolean} showFirst
     * @param {Elements} first
     * @param {Elements} second
     */
    static toggleShown(showFirst, first, second) {
        if (showFirst) {
            this.hide(second);
            this.show(first);
        } else {
            this.hide(first);
            this.show(second);
        }
    }

    /**
     * @param {string | string[]} classes
     * @returns {string[]}
     */
    static classesToList(classes) {
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
    static nthChild(container, n) {
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
    static getTemplate(key) {
        return TEMPLATES[key].firstChild.cloneNode(true);
    }

    /**
     * @param {Element} element
     * @param {boolean} with_padding
     * @returns {[number,number]} [width,height]
     */
    static elementSize(element, with_padding = false) {
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
    static setCSS(data, element = document.documentElement) {
        for (const [property, value] of Object.entries(data)) {
            element.style.setProperty(property, value);
        }
    }
}


export class RandomHelper {
    /**
     * Generate a PRNG seed from `str`.
     * @param {string} str
     * @returns {[number, number, number, number]}
     */
    static cyrb128(str) {
        let h1 = 1779033703, h2 = 3144134277,
            h3 = 1013904242, h4 = 2773480762;

        for (let i = 0; i < str.length; i++) {
            const k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }

        h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
        h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
        h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
        h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

        h1 ^= (h2 ^ h3 ^ h4);
        h2 ^= h1;
        h3 ^= h1;
        h4 ^= h1;

        return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
    }

    /**
     * Simple Fast Counter. A pseudo-random number generator, initialized with
     * four 32-bit integers.
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @param {number} d
     * @returns {function(): number}
     */
    static sfc32(a, b, c, d) {
        return function() {
            a |= 0; b |= 0; c |= 0; d |= 0;
            const t = (a + b | 0) + d | 0;
            d = d + 1 | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        }
    }

    /**
     * @param {string} seed
     * @returns {function(): number}
     */
    static seededPRNG(seed) {
        return this.sfc32(...this.cyrb128(seed));
    }

    /**
     * @param {Array} array - Array to be shuffled
     * @param {function(): number} rand - RNG returning values in [0,1).
     */

    static shuffle(array, rand = Math.random) {
        for (let length = array.length; length > 0; length--) {
            const randomIndex = Math.floor(rand() * length);
            if (randomIndex !== length - 1) {
                [array[length - 1], array[randomIndex]] = [
                    array[randomIndex], array[length - 1]
                ];
            }
        }
    }

    /**
     * Return a random integer n with `min <= n < max`.
     * @param {number} min
     * @param {number} max
     * @param {function(): number} rand - RNG returning values in [0,1)
     * @returns
     */
    static randInt(min, max, rand = Math.random) {
        return Math.floor(rand() * (max - min) + min);
    }

    /**
     * @param {number[]} weights
     * @returns {number[]}
     */
    static unitIntervalPartitionFromWeights(weights) {
        const cumsums = Array(weights.length + 1);
        let cumsum = cumsums[0] = 0;
        for (const [i, weight] of Object.entries(weights)) {
            cumsum += weight;
            cumsums[i + 1] = cumsum;
        }
        const sum = cumsums[weights.length];
        return cumsums.map(cumsum => cumsum / sum);
    }

    /**
     * Return the largest `index` such that `arr[index] <= val`.
     * (Right bisection)
     * @param {number[]} arr - sorted array
     * @param {number} val
     * @returns {number}
     */
    static bisect(arr, val) {
        if (arr[0] > val) {
            return -1;
        }

        let lo = 0;
        let hi = arr.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (arr[mid] > val) {
                hi = mid - 1;
            } else { // arr[mid] <= val
                lo = mid;
            }
        }
        return lo;
    }
}
