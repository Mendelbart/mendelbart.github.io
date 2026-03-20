import {DOMUtils, ObjectUtils} from "../utils";
import {ElementFitter} from "../utils/classes/ElementFitter";
import {avg} from "../utils/array";

export const Corners = Object.freeze({
    TOP_RIGHT: "tr",
    TOP_LEFT: "tl",
    BOTTOM_RIGHT: "br",
    BOTTOM_LEFT: "bl"
});


export class QuizItem {
    /**
     * @param {any} content
     * @param {Record<string, QuizAnswer>} answers
     */
    constructor(content, answers) {
        this.content = content;
        this.answers = answers;
    }

    /**
     * @param {Record<string, string>} guesses
     */
    gradeAll(guesses) {
        const grades = ObjectUtils.map(guesses, (guess, key) => this.answers[key].grade(guess));
        return avg(Object.values(grades));
    }

    /**
     * @param {Record<string, string>} guesses
     */
    markAll(guesses) {
        const marked = ObjectUtils.map(guesses, (guess, key) => this.answers[key].mark(guess));
        const grade = avg(Object.values(marked).map(x => x[0]));
        return [grade, ObjectUtils.map(marked, x => x[1]), ObjectUtils.map(marked, x => x[2])];
    }

    /**
     * @param {string} key
     * @param {string} guess
     * @returns {number}
     */
    grade(key, guess) {
        return this.answers[key].grade(guess);
    }

    /**
     * @param {string} key
     * @param {string} guess
     * @returns {[number,HTMLSpanElement,HTMLSpanElement]}
     */
    mark(key, guess) {
        return this.answers[key].mark(guess);
    }
}


export class QuizCard {
    constructor() {
        this.displayNode = DOMUtils.createElement("div.qc-display");
        this.node = DOMUtils.createElement("div.quiz-card", this.displayNode);

        this.fitter = new ElementFitter();
        this.labels = {};
        this.cornerLabels = {};
    }

    setDisplayContent(content) {
        this.fitter.clearParent(this.displayNode, false);
        this.displayNode.replaceChildren(content);
        this.fitter.fit([content]);
    }

    /**
     * @param {"top" | "bottom"} position
     * @param {HTMLElement | string} content
     */
    setLabel(position, content) {
        if (typeof content === "string") content = DOMUtils.span(content);

        if (this.labels[position]) {
            this.fitter.clearParent(this.labels[position], false);
            this.labels[position].replaceChildren(content);
        } else {
            this.labels[position] = DOMUtils.createElement("div.qc-label.qc-label-" + position, content);

            if (position === "top") {
                this.node.prepend(this.labels[position]);
            } else {
                this.node.append(this.labels[position]);
            }
        }

        this.fitter.fit([content]);
    }

    /**
     * @param {{top?: string|HTMLElement, bottom?: string|HTMLElement}} contents
     */
    setLabels(contents) {
        for (const position of Object.keys(this.labels)) {
            if (!contents[position]) this.removeLabel(position);
        }
        for (const [position, content] of Object.entries(contents)) {
            this.setLabel(position, content);
        }
    }

    /**
     * @param {{tl?: string|Node, tr?: string|Node, bl?: string|Node, br?: string|Node}} contents
     */
    setCornerLabels(contents) {
        for (const position of Object.keys(this.labels)) {
            if (!contents[position]) this.removeCornerLabel(position);
        }
        for (const [position, content] of Object.entries(contents)) {
            this.setCornerLabel(position, content);
        }
    }

    /**
     * @param {"tl"|"tr"|"bl"|"br"} position
     * @param {string | Node} content
     */
    setCornerLabel(position, content) {
        if (typeof content === "string") content = DOMUtils.span(content);

        if (this.cornerLabels[position]) {
            this.cornerLabels[position].replaceChildren(content);
            this.node.append(this.cornerLabels[position]);
        } else {
            this.cornerLabels[position] = DOMUtils.createElement("div.qc-corner-label.qc-corner-" + position, content);
        }
    }

    removeCornerLabel(position) {
        this.cornerLabels[position].remove();
        delete this.cornerLabels[position];
    }

    removeLabel(position) {
        this.fitter.clearParent(this.labels[position], true);
        this.labels[position].remove();
        delete this.labels[position];
    }

    removeLabels() {
        for (const position of Object.keys(this.labels)) {
            this.removeLabel(position);
        }
    }

    removeCornerLabels() {
        for (const position of Object.keys(this.cornerLabels)) {
            this.removeCornerLabel(position);
        }
    }

    showLabels() {
        DOMUtils.show(Object.values(this.labels), "visibility");
        DOMUtils.show(Object.values(this.cornerLabels));
    }

    hideLabels() {
        DOMUtils.hide(Object.values(this.labels), "visibility");
        DOMUtils.hide(Object.values(this.cornerLabels));
    }

    teardown() {
        this.fitter.teardown();
    }
}


export class CardFactory {
    /**
     * @param {function(QuizItem): string | HTMLElement} display
     * @param {function(QuizItem): {top?, bottom?}} [labels]
     * @param {function(QuizItem): {tl?, tr?, bl?, br?}} [cornerLabels]
     */
    constructor({display, labels, cornerLabels}) {
        this.displayCallback = display;
        this.labelCallback = labels;
        this.cornerLabelCallback = cornerLabels;
    }

    /**
     * @param {QuizItem} item
     * @returns QuizCard
     */
    createCard(item) {
        const card = new QuizCard();
        this.modifyCard(card, item);
        return card;
    }

    /**
     * @param {QuizCard} card
     * @param {QuizItem} item
     */
    modifyCard(card, item) {
        card.setDisplayContent(this.displayCallback(item));
        if (this.labelCallback) {
            card.setLabels(this.labelCallback(item));
        } else {
            card.removeLabels();
        }
        if (this.cornerLabelCallback) {
            card.setCornerLabels(this.cornerLabelCallback(item));
        } else {
            card.removeCornerLabels();
        }
    }

    /**
     * @param {QuizItem[]} items
     * @returns {QuizCard[]}
     */
    createCards(items) {
        return items.map(item => this.createCard(item));
    }
}
