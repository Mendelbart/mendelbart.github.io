import {argmax, mapFromKeys, avg, full} from "../utils/array";
import {osaDistance} from "./string-metrics";
import Matrix from "../utils/classes/Matrix";
import {ObjectUtils} from "../utils";
import SubString from "../utils/classes/SubString";

/** @interface QuizAnswer */
/** @type string */
/** @name QuizAnswer#display */
/** @function
 * @name QuizAnswer#grade
 * @param {string} guess
 * @returns {number} */
/** @function
 * @name QuizAnswer#mark
 * @param {string} guess
 * @returns {[number, HTMLSpanElement, HTMLSpanElement]} [grade, markedGuess, markedSolution] */

/**
 * @param {Record<string, any>} data
 * @returns {function(any): QuizAnswer}
 */
export function QuizAnswerFactory(data) {
    switch(data.type) {
        case "string":
            data = ObjectUtils.withoutKeys(data, "type");
            return (value) => new StringAnswer(value, data);
        case "list":
            const callback = QuizAnswerFactory(data.items);
            data = ObjectUtils.withoutKeys(data, ["type", "items"]);
            return (value) => new ListAnswer(value, callback, data);
        default:
            throw new Error(`Unknown quiz answer type ${data.type}.`);
    }
}

/**
 * @param {Record<string, Record<string, any>>} data
 * @returns {function(Record<string, any>): Record<string, QuizAnswer>}
 * @constructor
 */
export function QuizAnswerRecordFactory(data) {
    const factories = ObjectUtils.map(data, d => QuizAnswerFactory(d));
    return values => ObjectUtils.map(values, (value, key) => factories[key](value));
}


/** @implements QuizAnswer */
export class StringAnswer {
    /**
     * @param {string} display
     * @param {number} [maxDist]
     * @param {number} [maxDistMult]
     * @param {Record<string, string | string[]>} [substitutions]
     * @param {boolean} [forceSubstititions]
     * @param {boolean} [caseSensitive]
     * @param {string|false} [ignoreBrackets]
     */
    constructor(display, {
        maxDist = 0,
        maxDistMult,
        substitutions = {},
        forceSubstitutions = false,
        caseSensitive = false,
        ignoreBrackets = "("
    } = {}) {
        this.display = display;
        this.maxDist = maxDist;
        this.maxDistMult = maxDistMult;
        this.caseSensitive = caseSensitive;
        this.ignoreBrackets = ignoreBrackets;
        this.values = this.applySubstitutions(display, substitutions, forceSubstitutions).map(s => this.standardizeString(s));
    }

    getMaxDist(value) {
        if (!this.maxDistMult || this.maxDist === 0) return this.maxDist;

        return this.maxDist * Math.max(1, Math.ceil(value.length / this.maxDistMult));
    }

    /**
     * @param {string} display
     * @param {Record<string, string | string[]>} substitutions
     * @param {boolean} forceSubstitutions
     * @returns {string[]}
     */
    applySubstitutions(display, substitutions, forceSubstitutions) {
        if (!substitutions) return [display];

        let vals = [display];
        const flags = this.caseSensitive ? "gu" : "gui";

        for (let [pattern, subs] of Object.entries(substitutions)) {
            if (!Array.isArray(subs)) subs = [subs];

            const regex = new RegExp(pattern, flags);
            vals = vals.map(val => {
                const newVals = subs.map(sub => val.replaceAll(regex, sub));
                if (!forceSubstitutions) newVals.push(val);
                return newVals;
            }).flat();
        }

        return Array.from(new Set(vals));
    }

    standardizeString(str) {
        str = str.normalize("NFKD").replaceAll(/\p{M}/gu, "");
        if (!this.caseSensitive) str = str.toLowerCase();
        str = str.trim();

        if (this.ignoreBrackets) {
            for (const opening of this.ignoreBrackets.split("")) {
                str = removeBrackets(str, opening);
            }
        }

        return str;
    }

    _grade(guess, value) {
        return gradeFromDist(osaDistance(guess, value), this.getMaxDist(value));
    }

    /**
     * @param {string} guess
     * @return {number}
     */
    grade(guess) {
        guess = this.standardizeString(guess);
        return Math.max(...this.values.map(value => this._grade(guess, value)));
    }

    /**
     * @param {string} guess
     * @returns {[number,HTMLSpanElement,HTMLSpanElement]}
     */
    mark(guess) {
        const grade = this.grade(guess);
        return [grade, markedSpan(guess, grade), markedSpan(this.display, grade)];
    }
}


/** @implements QuizAnswer */
export class ListAnswer {
    /**
     * @param {string} value
     * @param {function(string): QuizAnswer} callback
     * @param {string | RegExp} [splitter]
     * @param {"best" | "avg"} [gradeMode]
     */
    constructor(value, callback, {
        splitter = /,\s*/,
        gradeMode = "best"
    } = {}) {
        this.display = value;
        this.splitter = new RegExp(splitter, "gu");
        this.values = new SubString(value).split(this.splitter);
        /** @type {QuizAnswer[]} */
        this.answers = this.values.map(answer => callback(answer.str));

        if (!["best", "avg"].includes(gradeMode)) {
            throw new Error(`Invalid list answer grade mode ${gradeMode}.`);
        }
        this.gradeMode = gradeMode;
    }

    splitGuesses(guessesStr) {
        return new SubString(guessesStr).split(this.splitter);
    }

    grade(guessesStr) {
        const answerGrades = this.gradingData(guessesStr)[2];
        return this.calculateGrade(answerGrades);
    }

    calculateGrade(answerGrades) {
        return this.gradeMode === "avg" ? avg(answerGrades) : Math.max(...answerGrades);
    }

    /**
     * @param guesses
     * @returns {[Matrix, number[], number[]]} [grades, bestGuessIndices, answerGrades]
     */
    gradingData(guesses) {
        const n = this.answers.length;
        const m = guesses.length;

        const grades = Matrix.full(n, m, (i, j) => this.answers[i].grade(guesses[j].str));
        const bestGuessIndices = full(n, i => argmax(grades.getRow(i)));
        const answerGrades = bestGuessIndices.map((j, i) => grades.get(i, j));

        return [grades, bestGuessIndices, answerGrades];
    }

    /**
     * @param {string} guessesStr
     */
    mark(guessesStr) {
        const guesses = this.splitGuesses(guessesStr);
        const [grades, bestGuessIndices, answerGrades] = this.gradingData(guesses);

        const grade = this.calculateGrade(answerGrades);
        const markedGuess = replaceWithElements(guessesStr, mapFromKeys(
            guesses, (guess, i) => markedSpan(guess.str, Math.max(...grades.getRow(i)))
        ));

        let markedSolution;

        if (this.gradeMode === "avg") {
            markedSolution = replaceWithElements(this.display, mapFromKeys(
                this.values, (value, i) => markedSpan(value.str, grades.get(i, bestGuessIndices[i]))
            ));
        } else {
            const answerIndex = argmax(answerGrades);

            if (passes(grade)) {
                const guessIndex = bestGuessIndices[answerIndex];
                const value = this.values[answerIndex];

                markedSolution = replaceWithElements(this.display, new Map([
                    [value, markedSpan(value.str, grades.get(answerIndex, guessIndex))]
                ]));
            } else {
                markedSolution = replaceWithElements(this.display, mapFromKeys(
                    this.values, value => markedSpan(value.str, 0)
                ));
            }
        }

        return [grade, markedGuess, markedSolution];
    }
}


export function passes(grade) {
    return grade >= 0.5;
}

/**
 * @param {string} value
 * @param {number} grade
 * @returns {HTMLSpanElement}
 */
function markedSpan(value, grade) {
    const span = document.createElement("SPAN");
    span.dataset.correct = grade === 1 ? "true" : grade > 0 ? "partially" : "false";
    span.textContent = value;

    return span;
}

/**
 * @param {string} display
 * @param {Map<SubString, HTMLElement>} elements
 * @returns {HTMLSpanElement}
 */
function replaceWithElements(display, elements) {
    const container = document.createElement("span");
    let i = 0;

    for (const [substr, element] of elements) {
        if (substr.start > i) {
            container.append(display.substring(i, substr.start));
        }
        container.append(element);
        i = substr.end;
    }

    if (i < display.length) {
        container.append(display.substring(i));
    }

    return container;
}

/**
 * @param {number} dist
 * @param {number} [maxDist=0]
 * @returns {number}
 */
function gradeFromDist(dist, maxDist = 0) {
    if (dist > maxDist) return 0;
    if (maxDist === 0) return 1;

    return 0.5 + (maxDist - dist) / maxDist;
}


const closingBrackets = Object.freeze({"(": ")", "[": "]", "{": "}"});

/**
 * @param {string} str
 * @param {'(' | '[' | '{'} opening
 * @returns {string}
 */
function removeBrackets(str, opening = '(') {
    let i = 0;
    let depth = 0;
    let bracketStart = -1;
    const closing = closingBrackets[opening];

    while (i < str.length) {
        const char = str.charAt(i);
        if (char === opening) {
            depth += 1;
            if (depth === 1) bracketStart = i;
        } else if (char === closing && depth > 0) {
            depth -= 1;
            if (depth === 0) {
                str = str.substring(0, bracketStart) + str.substring(i + 1);
                i = bracketStart - 1;
            }
        }

        i++;
    }

    return str;
}
