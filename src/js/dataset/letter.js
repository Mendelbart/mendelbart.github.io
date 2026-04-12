import {DOMUtils} from '../utils';

/**
 * @interface CardContent
 *//**
 * @function CardContent#getNode
 * @returns HTMLElement
 */

/**
 * @interface Letter
 * @extends CardContent
 */

/** @implements Letter */
export class StringLetter {
    /**
     * @param {string} str
     * @param {{lang?, dir?, form?}} [params]
     */
    constructor(str, params = {}) {
        this.str = str;
        this.params = params;
    }

    /**
     * @returns {HTMLSpanElement}
     */
    getNode() {
        const node = DOMUtils.createElement("span.letter.letter-string", this.str);
        const {lang, dir, form} = this.params;
        if (lang) node.lang = lang;
        if (dir) node.dir = dir;
        if (form) node.dataset.form = form;

        return node;
    }
}

/** @implements Letter */
export class ImageLetter {
    constructor(src) {
        this.src = src;
    }

    /**
     * @returns {HTMLImageElement}
     */
    getNode() {
        const img = new Image();
        img.src = this.src;
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
    getNode() {
        return DOMUtils.createElement("span.letter-combination", ...this.letters.map(letter => letter.getNode()));
    }
}


/**
 * @param {string[]} keys
 * @param {Record<string, string | RegExp>} sourceRegExps
 * @param {string} template
 * @returns {function(Record<string, string>): string}
 */
export function stringComponentCombiner(keys, sourceRegExps, template) {
    const pattern = keys.map(key => {
        let s = sourceRegExps[key] ?? "[^\\t]*";
        if (typeof s !== 'string') s = s.source;
        return `(?<${key}>${s})`;
    }).join('\\t');
    const sourceRegExp = new RegExp("^" + pattern + "$", "u");

    return (components) => {
        const source = keys.map(key => components[key] ?? "").join('\t');
        if (!sourceRegExp.test(source)) throw new Error("Components don't match RegExps.");
        return source.replace(sourceRegExp, template);
    }
}
