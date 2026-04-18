import {DOMUtils} from '../utils';

/**
 * @interface CardContent
 *//**
 * @function CardContent#getNode
 * @returns HTMLElement
 */

/** @implements CardContent */
export class Letter {
    /**
     * @param {any} data
     * @param {string | number} key
     * @param {string} [form]
     */
    constructor(data, key, form) {
        this.data = data;
        this.key = key;
        this.form = form;
    }

    getNode() {
        throw new Error('Not implemented');
    }
}


export class StringLetter extends Letter {
    /**
     * @returns {HTMLSpanElement}
     */
    getNode() {
        const node = DOMUtils.createElement("span.letter.letter-string", this.data);
        if (this.form) node.dataset.form = this.form;
        return node;
    }
}


export class CombiningStringLetter extends StringLetter {
    /**
     * @param {string} str
     * @param {function(string[]): string} combiner
     * @param {string|number} key
     * @param {string} [form]
     */
    constructor(str, combiner, key, form) {
        super(str, key, form);
        this.combiner = combiner;
    }

    /**
     * @param {string} base
     * @returns {HTMLSpanElement}
     */
    getNode(base) {
        const node = super.getNode();
        node.textContent = this.combiner([base, this.str]);
        return node;
    }
}


export class ImageLetter extends Letter{
    /**
     * @returns {HTMLImageElement}
     */
    getNode() {
        const img = new Image();
        img.src = this.data;
        img.classList.add('letter', 'letter-image');
        return img;
    }
}


/** @implements CardContent */
export class LetterCombination {
    /**
     * @param {Letter[]} letters
     */
    constructor(letters) {
        this.letters = letters;
    }

    /**
     * @returns {HTMLSpanElement}
     */
    getNode(...args) {
        return DOMUtils.createElement("span.letter-combination", ...this.letters.map(letter => letter.getNode(...args)));
    }
}


/**
 * @param {string} template
 * @param {number | (string | RegExp)[]} sourceRegExps - if number `n`, will use default RegExp `/[\t+]*\/` `n` times
 * @returns {function(string[]): string}
 */
export function stringComponentCombiner(template, sourceRegExps) {
    if (typeof sourceRegExps === 'number') {
        sourceRegExps = new Array(sourceRegExps).fill('[\\t+]*');
    }

    const pattern = sourceRegExps.map((regex, index) => {
        if (typeof regex !== 'string') regex = regex.source;
        return `(?<g${index}>${regex})`;
    }).join('\\t');
    const sourceRegExp = new RegExp("^" + pattern + "$", "u");

    return (components) => {
        const source = components.join('\t');
        if (!sourceRegExp.test(source)) throw new Error("Components don't match RegExps.");
        return source.replace(sourceRegExp, template);
    }
}
