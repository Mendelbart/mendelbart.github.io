import {argmax, mapFromKeys, avg, full} from "../utils/array";
import {osaDistance} from "./string-metrics";
import {Matrix, SubString} from "../utils";

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
            return (value) => new StringAnswer(value, data.properties);
        case "list":
            const callback = QuizAnswerFactory(data.items);
            return (value) => new ListAnswer(value, callback, data.properties);
        case "number":
        case "integer":
            data.integer = data.type === "integer";
            return (value) => new NumberAnswer(value, data.properties);
        default:
            throw new Error(`Unknown quiz answer type ${data.type}.`);
    }
}

export const DefaultListSplitter = "[,;/]";

/** @implements QuizAnswer */
class SimpleQuizAnswer {
    /**
     * @param {string} display
     * @param value
     * @param {number} maxDist
     */
    constructor(display, value, maxDist = 0) {
        this.display = display;
        this.value = value;
        this.maxDist = maxDist;
    }

    parseGuess(guess) {
        return guess;
    }

    distance(value, guess) {
        throw new Error("Not implemented.");
    }

    grade(guess) {
        try {
            guess = this.parseGuess(guess);
        } catch {
            return 0;
        }

        const dist = this.distance(this.value, guess);
        return gradeFromDist(dist, this.maxDist);
    }

    /**
     * @param guess
     * @returns {[number, HTMLSpanElement, HTMLSpanElement]}
     */
    mark(guess) {
        const grade = this.grade(guess);
        return [grade, markedSpan(guess, grade), markedSpan(this.display, grade)];
    }
}

export class NumberAnswer extends SimpleQuizAnswer {
    constructor(value, {
        integer = false,
        maxDist = 0,
        distanceMode = "linear"
    } = {}) {
        if (typeof value === "string") {
            super(value, integer ? parseInt(value) : parseFloat(value), maxDist);
        } else {
            super(value.toString(), value, maxDist);
        }

        if (distanceMode.substring(0, 3) === "log") {
            this.distanceMode = "log";
            const logBaseString = distanceMode.substring(3);
            this.logBase = logBaseString ? parseFloat(logBaseString) : 10;
        }

        this.integer = integer;
    }

    parseGuess(guess) {
        return this.integer ? parseFloat(guess) : parseInt(guess);
    }

    distance(value, guess) {
        if (this.distanceMode === "log") {
            return Math.abs(Math.log(value) - Math.log(guess)) / Math.log(this.logBase);
        } else {
            return Math.abs(value - guess);
        }
    }
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
        maxDistMult = Infinity,
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

    /**
     * @param {string} value
     * @returns {number}
     */
    getMaxDist(value) {
        return this.maxDist + Math.floor(value.length / this.maxDistMult);
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

    /**
     * @param {string} str
     * @returns {string}
     */
    standardizeString(str) {
        str = str.trim().normalize("NFKD").replaceAll(/\p{M}/gu, "");
        if (!this.caseSensitive) str = str.toLowerCase();

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
     * @param {"one" | "all"} [gradeMode]
     */
    constructor(value, callback, {
        splitter = DefaultListSplitter,
        gradeMode = "one"
    } = {}) {
        this.display = value;
        this.splitter = new RegExp(splitter, "gu");
        this.values = new SubString(value).split(this.splitter);
        /** @type {QuizAnswer[]} */
        this.answers = this.values.map(answer => callback(answer.str));

        if (!["one", "all"].includes(gradeMode)) {
            throw new Error(`Invalid list answer grade mode ${gradeMode}.`);
        }
        this.gradeMode = gradeMode;
    }

    /**
     * @param {string} guessesStr
     * @returns {SubString[]}
     */
    splitGuesses(guessesStr) {
        return new SubString(guessesStr).split(this.splitter);
    }

    /**
     * @param {string} guessesStr
     * @returns {number|number}
     */
    grade(guessesStr) {
        const answerGrades = this.gradingData(this.splitGuesses(guessesStr))[2];
        return this.calculateGrade(answerGrades);
    }

    /**
     * @param {number[]} answerGrades
     * @returns {number}
     */
    calculateGrade(answerGrades) {
        return this.gradeMode === "all" ? avg(answerGrades) : Math.max(...answerGrades);
    }

    /**
     * @param {SubString[]} guesses
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
     * @returns {[number, HTMLSpanElement, HTMLSpanElement]}
     */
    mark(guessesStr) {
        const guesses = this.splitGuesses(guessesStr);
        const [grades, bestGuessIndices, answerGrades] = this.gradingData(guesses);

        const grade = this.calculateGrade(answerGrades);
        const markedGuess = replaceWithElements(guessesStr, mapFromKeys(
            guesses.filter(guess => guess.length > 0),
            (guess, i) => markedSpan(guess.str, Math.max(...grades.getRow(i)))
        ));

        let markedSolution;

        if (this.gradeMode === "all") {
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


/**
 * @param {number} grade
 * @returns {boolean}
 */
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

    return 0.5 + 0.5 * (maxDist - dist) / maxDist;
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
