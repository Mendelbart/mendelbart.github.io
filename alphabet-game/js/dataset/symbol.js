import {osaDistance} from "../game/string-metrics.js";
import {ArrayHelper} from "../helpers/helpers.js";

export class QuizItem {
    /**
     *
     * @param {*} display
     * @param {Record<string,ItemProperty>} properties
     * @param {Record<string,*>} filters
     */
    constructor(display, properties, filters) {
        this.display = display;
        this.properties = properties;
        this.filters = filters;
    }
}


export class ItemProperty {
    constructor(value, maxDist) {
        this.value = value;
        this.maxDist = maxDist;
        this.displayString = typeof value === "string" ? value : value.toString();
    }

    /**
     * @param {*} data
     * @param {Record<string,*>} propData
     * @returns {ItemProperty}
     */
    static fromData(data, propData) {
        const maxDist = propData.maxDist ?? 0;
        const type = propData.type;

        if (type === "number") {
            return new NumberProperty(data, maxDist, propData.distanceMode ?? "linear");
        } else if (type === "string") {
            return new StringProperty(data, maxDist, propData.ignoreCase ?? true);
        } else if (type === "list") {
            return new ListProperty(data, maxDist, propData);
        } else {
            console.error(`Unknown property type "${propData.type}"`)
        }
    }

    /**
     * Returns the grade, a list of nodes with the marked guesses,
     * and a list of nodes with the marked solution string.
     *
     * @param {string} guess
     * @returns {[number, Node[], Node[]]}
     */
    grade(guess) {
        const grade = this.gradeSingle(guess, this.value);
        return [
            grade,
            guess.length > 0 ? [this.markGradedText(guess, grade)] : [],
            [this.markGradedText(this.displayString, grade)]
        ];
    }

    gradeSingle(guess, sol) {
        const dist = this.distance(guess, sol);
        if (dist <= this.maxDist) {
            if (this.maxDist === 0) {
                return 1;
            }
            return Math.pow(2, -dist / this.maxDist);
        }

        return 0;
    }

    markGradedText(text, grade) {
        const span = document.createElement("SPAN");
        span.dataset.correct = grade === 1 ? "true" : grade > 0 ? "partially" : "false";
        span.textContent = text;

        return span;
    }

    /**
     * @param a
     * @param b
     * @returns {number}
     */
    distance(a, b) {
        console.error("Not implemented.");
    }
}


export class NumberProperty extends ItemProperty {
    /**
     * @param {string|number} value
     * @param {number} maxDist
     * @param {"linear" | "log"} distanceMode
     */
    constructor(value, maxDist, distanceMode = "linear") {
        let number, displayString;
        if (typeof value === "string") {
            number = parseFloat(value);
            if (isNaN(number)) {
                console.error(`Invalid number property value "${value}"`);
            }
            displayString = value;
        } else {
            number = value;
            displayString = value.toString();
        }

        if (distanceMode === "log" && number === 0) {
            console.error("Invalid value 0 for NumberProperty with distanceMode \"log\"");
        }

        super(number, maxDist);
        this.displayString = displayString;
        this.distanceMode = distanceMode;
    }

    distance(a, b) {
        return this.distanceMode === "linear" ? Math.abs(a - b) : Math.abs(Math.log(a / b));
    }
}


export class StringProperty extends ItemProperty {
    /**
     * @param {string} value
     * @param {number} maxDist
     * @param {boolean} ignoreCase
     */
    constructor(value, maxDist, ignoreCase = true) {
        super(value, maxDist);
        this.ignoreCase = ignoreCase;
    }

    distance(a, b) {
        if (this.ignoreCase) {
            a = a.toLowerCase();
            b = b.toLowerCase();
        }
        return osaDistance(a.trim(), b.trim());
    }
}

export class ListProperty extends StringProperty {
    /**
     * @param {string} displayString
     * @param {number} maxDist
     * @param {"best"|"avg"} listMode
     * @param {boolean} ignoreCase
     * @param {string} splitter - regex string of splitters
     * @param {string[]} excludeFromList
     */
    constructor(
        displayString,
        maxDist, {
            listMode = "best",
            ignoreCase = true,
            splitter = "[,;/]",
            excludeFromList = ["\\(.*\\)"]}) {

        displayString = displayString.trim();

        super(displayString, maxDist, ignoreCase);

        this.splitter = splitter;
        /**
         * @type {SubString[]}
         */
        this.values = this.constructor.getValues(displayString, maxDist, this.splitter, excludeFromList);
        this.listMode = listMode;
    }

    /**
     * @param {string} displayString
     * @param {number} maxDist
     * @param {string|RegExp} splitter
     * @param {string[]} excludeFromList
     * @returns {SubString[]}
     */
    static getValues(displayString, maxDist, splitter, excludeFromList) {
        let values = [new SubString(displayString)];

        for (const pattern of [...excludeFromList, splitter]) {
            values = values
                .map(s => s.split(pattern))
                .flat()
                .map(s => s.trim())
                .filter(x => x.end > x.start);
        }

        return values;
    }

    grade(guess) {
        const guesses = new SubString(guess).split(this.splitter).map(s => s.trim());
        const guessScores = new Array(guesses.length).fill(0);
        const valueScores = new Array(this.values.length).fill(0);

        for (const [i, value] of this.values.entries()) {
            for (const [j, guess] of guesses.entries()) {
                const score = this.gradeSingle(guess.str, value.str);
                if (score > 0) {
                    if (guessScores[j] > 0) {
                        console.warn("Guess matches multiple values, maxDist too high.");
                    }
                    valueScores[i] = Math.max(valueScores[j], score);
                    guessScores[j] = Math.max(guessScores[j], score);
                }
            }
        }

        const grade = this.listMode === "best"
            ? Math.max(...valueScores)
            : ArrayHelper.avg(guessScores);

        return [
            grade,
            this.markSubStrings(guesses, guessScores),
            this.markSubStrings(this.values, valueScores)
        ];
    }

    /**
     * @param {SubString[]} subStrings
     * @param {number[]} grades
     * @returns {Node[]}
     */
    markSubStrings(subStrings, grades) {
        if (subStrings.length === 0) {
            return [];
        }

        const source = subStrings[0].source;
        const nodes = [];

        let pos = 0;

        for (const [i, subString] of subStrings.entries()) {
            if (pos < subString.start) {
                nodes.push(document.createTextNode(source.substring(pos, subString.start)));
            }

            if (subString.start < subString.end) {
                nodes.push(this.markGradedText(subString.str, grades[i]));

                pos = subString.end;
            }
        }

        if (pos < source.length) {
            nodes.push(document.createTextNode(source.substring(pos)))
        }

        return nodes;
    }
}


class SubString {
    /**
     * @param {string|SubString} source
     * @param {number} start
     * @param {?number} [end]
     * */
    constructor(source, start = 0, end = null) {
        if (source instanceof SubString) {
            start += source.start;
            if (end === null) {
                end = source.end;
            } else {
                end += source.start;
            }
            source = source.source;
        }

        if (end === null) {
            end = source.length;
        }

        this.source = source;
        this.str = source.substring(start, end);
        this.start = start;
        this.end = end;
    }

    /**
     * @param splitter
     * @param {boolean} [includeEmpty]
     * @returns {SubString[]}
     */
    split(splitter, includeEmpty = false) {
        const result = [];
        const matches = this.str.matchAll(splitter);

        let i = 0;
        for (const match of matches) {
            if (!includeEmpty && i === match.index) {
                continue;
            }

            result.push(new this.constructor(this, i, match.index));
            i = match.index + match.length;
        }

        if (includeEmpty || i < this.end - this.start) {
            result.push(new this.constructor(this, i));
        }

        return result;
    }

    /**
     * @returns {SubString}
     */
    trimStart() {
        return this._trim(true);
    }

    /**
     * @returns {SubString}
     */
    trimEnd() {
        return this._trim(false);
    }

    /**
     * @param {boolean} atStart
     * @returns {SubString}
     * @private
     */
    _trim(atStart = true) {
        const pattern = atStart ? /^\s*/ : /\s*$/;
        const whiteSpaceLen = this.str.match(pattern)[0].length;
        if (whiteSpaceLen === 0) {
            return this;
        }

        const start = atStart ? this.start + whiteSpaceLen : this.start;
        const end = atStart ? this.end : this.end - whiteSpaceLen
        return new this.constructor(this.source, start, end);
    }

    /**
     * @returns {SubString}
     */
    trim() {
        return this.trimStart().trimEnd();
    }
}



/**
 * @typedef {"real"|"integer"|"string"|"istring"} SymbolPropertyType
 */

export class SymbolProperty {
    /**
     * @param {SymbolPropertyType} type
     * @param {any} display
     * @param {string[]|string[][]} solutions
     * @param {"best" | "avg"} listMode
     * @param {number} maxDist
     */
    constructor(type, display, solutions, listMode, maxDist) {
        this.type = type;
        this.display = display;
        this.solutions = solutions;
        this.listMode = listMode;
        this.maxDist = maxDist;
    }

    /**
     * @param {string | {display: string, solution?: string, solutions?: string[][]}} data
     * @param {Record<string, *>} propData
     * @returns {SymbolProperty}
     */
    static fromData(data, propData) {
        const maxDist = propData.maxDist ?? 0;
        const listMode = propData.listMode ?? "best";
        const type = propData.type;
        const display = typeof data === "string" ? data : data.display;
        const solutions =
            typeof data === "string"
                ? this.parseSolutions(data, propData)
                : "solutions" in data
                    ? data.solutions
                    : data.solution;

        console.log(solutions);

        return new this(type, display, solutions, listMode, maxDist);
    }

    /**
     * @param {string|number} display
     * @param {Record<string,*>} propData
     * @returns {string[]|number[]|string|number}
     */
    static parseSolutions(display, propData) {
        if (propData.listMode === "none") {
            return this.standardizeSolution(display, propData.type);
        }

        if (propData.removeInParens ?? true) {
            display = display.replaceAll(new RegExp("\\(.*?\\)", "g"), "");
        }
        const splitter = propData.splitter ?? ",;/";

        return display
            .split(new RegExp(`[${splitter}]`))
            .map(s => this.standardizeSolution(s, propData.type));
    }

    /**
     * @param {string|number} sol
     * @param {string} type
     * @returns {string|number}
     */
    static standardizeSolution(sol, type) {
        if (typeof sol !== "string") {
            return sol;
        }

        sol = sol.trim();
        if (type === "istring") {
            return sol.toLowerCase();
        } else if (type === "integer" || type === "float") {
            const number = type === "float" ? parseFloat(sol) : parseInt(sol);
            if (isNaN(number)) {
                console.error(`Couldn't parse ${type} from "${sol}"`);
            }
            return number;
        }

        return sol;
    }

    /**
     * @param {string} guessString
     * @returns {number}
     */
    grade(guessString) {
        if (this.listMode === "none") {
            return this.gradeSingle(guessString, this.solutions);
        }

        const guesses = guessString.split(/[,;/]\s*/g);

        return this.gradeList(
            this.solutions, this.listMode, sol => this.gradeList(
                guesses, "best", guess => this.gradeSingle(guess, sol)
            )
        );
    }

    /**
     * @param guess
     * @param sol
     * @returns {number}
     */
    gradeSingle(guess, sol) {
        const dist = this.distance(guess, sol);
        if (dist <= this.maxDist) {
            if (this.maxDist === 0) {
                return 1;
            }
            return Math.pow(2, -dist / this.maxDist);
        }

        return 0;
    }

    /**
     * @param {string} guess
     * @param {string|number} sol
     * @returns {number}
     */
    distance(guess, sol) {
        if (this.type === "integer" || this.type === "float") {
            const guessNumber = this.type === "float" ? parseFloat(guess) : parseInt(guess);
            if (isNaN(guessNumber)) {
                return Infinity;
            }
            return Math.abs(guessNumber - sol);
        } else if (this.type === "string" || this.type === "istring"){
            guess = guess.trim();

            if (this.type === "istring") {
                guess = guess.toLowerCase();
            }
            return osaDistance(guess, sol);
        } else {
            console.error("Invalid SymbolEntry type:", this.type);
        }
    }

    /**
     *
     * @param {any[]} list
     * @param {"best"|"avg"} scoringMode
     * @param {function(any): number} grade_func
     * @returns {number}
     */
    gradeList(list, scoringMode, grade_func) {
        if (scoringMode !== "best" && scoringMode !== "avg") {
            console.error('scoringMode parameter can only be "best" or "avg".');
        }
        const matchAll = scoringMode === "avg";

        let total_score = 0;

        for (const elem of list) {
            const score = grade_func(elem);
            if (matchAll) {
                total_score += score / list.length;
            } else if (total_score < score) {
                total_score = score;
            }
        }

        return total_score;
    }
}