import { RadioGroupSetting } from "./Setting.js";

export class Dataset {
    constructor(data) {
        this.data = data;
        this.settings = {};
        this.settingsLabels = {};
        this.filters = this.data.filters ?? {};
        this.locales = this.data.locales ?? {};
        this.setupLocaleSetting();
        this.setupFilterSettings();
        this.preprocessSymbols();
    }

    getSettings() {
        return Settings.fromSettingsLabelContents(
            this.settings,
            this.settingsLabels
        )
    }

    filterSettingKey(filterKey) {
        return "filter_" + filterKey;
    }

    setupFilterSettings() {
        for (const [filterKey, filterData] of Object.entries(this.data.filters)) {
            const key = this.filterSettingKey(filterKey);
            this.settings[key] = ButtonGroupSetting.create(
                filterData.options,
                filterData.defaults ?? Object.keys(filterData.options)
            );
            this.settingsLabels[key] = filterData.label ?? filterKey;
        }
    }

    hasLocales() {
        return Object.keys(this.locales).length === 0;
    }

    setupLocaleSetting() {
        if (!this.hasLocales()) {
            return;
        }
        this.settings.locale = RadioGroupSetting.create(
            this.data.locales,
            this.data.defaultLocale ?? null
        );
        this.settingsLabels.locale = this.data.localeSettingName ?? "Language";
    }

    preprocessSymbols() {
        if (!("prototypes" in this.data)) {
            return;
        }

        for (const prototypeData of Object.values(this.data.prototypes)) {
            const prototype = SymbolPrototype.deserialize(prototypeData);
            this.data.symbols = prototype.processSymbols(this.data.symbols);
        }
    }

    /**
     * @param symbols {SymbolsData}
     * @returns {SymbolsData}
     */
    getFilteredSymbols(symbols) {
        let keys = Object.keys(symbols);
        for (const [filterKey, filterData] of Object.entries(this.data.filters)) {
            const values = this.settings[this.filterSettingKey(filterKey)].value;
            keys = keys.filter(key => values.indexOf(symbols[key][filterData.property]) !== -1);
        }
        return Object.fromEntries(keys.map(key => [key, symbols[key]]));
    }

    /**
     * @returns {SymbolsData}
     */
    generateSymbols() {
        let symbols = this.getFilteredSymbols(this.data.symbols);
        if (this.hasLocales()) {
            this.applyLocale(symbols);
        }
        return symbols;
    }

    /**
     * @param {string} key
     * @param {string} locale
     * @returns {string}
     */
    localeKey(key, locale) {
        return key + ":" + locale;
    }

    /**
     * @param {SymbolsData} symbols
     */
    applyLocale(symbols) {
        const keys = this.data.localeProperties;
        for (const data of Object.values(symbols)) {
            for (const key of keys) {
                const localeKey = this.localeKey(key, this.settings.locale.value);
                if (localeKey in data) {
                    data[key] = data[localeKey];
                }
            }
        }
        return symbols;
    }


}

class SymbolMapDataset extends Dataset {
    constructor(data) {
        super(data);
        this.preprocessSymbols();
    }
}


class SymbolPrototype {
    /**
     * @param {string[]} keys
     * @param {Object.<string, Object>} objects
     * @param {boolean} [useByDefault]
     */
    constructor(keys, objects, useByDefault = true) {
        this.keys = keys;
        this.objectKeys = Object.keys(objects);
        this.objects = objects;
        this.useByDefault = useByDefault;
    }

    getObject(index) {
        return this.objects[this.objectKeys[index]];
    }

    nPrototypes(symbolData) {
        let len = -1;
        for (const key of this.keys) {
            const currentLen = symbolData[key].length;
            if (len === -1) {
                len = currentLen;
                if (len > this.keys.length) {
                    console.warn(`Too many elements of key "${key}" to prototype.`);
                }
            } else if (symbolData[key].length !== len) {
                console.warn("Inconsistent number of elements for prototype generation");
                break;
            }
        }
        return len;
    }

    processSymbol(data, symbolKey) {
        const symbols = {};
        const nSymbols = this.nPrototypes(data);

        for (let i = 0; i < nSymbols; i++) {
            const symbol = Object.assign({}, data, this.getObject(i));
            for (const key of this.keys) {
                symbol[key] = symbol[key][i];
            }
            symbols[symbolKey + "_" + this.objectKeys[i]] = symbol;
        }

        return symbols;
    }

    processSymbols(symbolsData) {
        const newData = {};
        for (const [symbolKey, symbolData] of Object.entries(symbolsData)) {
            if (symbolData.usePrototype ?? this.useByDefault) {
                Object.assign(newData, this.processSymbol(symbolData, symbolKey));
            } else {
                newData[symbolKey] = symbolData;
            }
        }
        return newData;
    }

    /**
     * @param {Object.<string,*>} data
     * @returns {SymbolPrototype}
     */
    static deserialize(data) {
        return new this(data.keys, data.objects, data.useByDefault ?? true);
    }
}

/**
 * @typedef {Object} SymbolData
 * @property {*} display
 */

/**
 * @typedef {Object.<string,SymbolData>} SymbolsData
 */


class SymbolFilter {
    key;
    setting;

    constructor(key, setting) {
        this.key = key;
        this.setting = setting;
    }

    /**
     * @param {string} key
     * @param {Object.<string,string>} labels
     * @param {?string[]} [defaults]
     * @param {?string} idPrefix
     */
    static create(key, labels, defaults = null, idPrefix = null) {
        defaults ??= Object.keys(labels);
        const setting = ButtonGroupSetting.create(labels, defaults, null, idPrefix);
        return new this(key, setting);
    }

    filteredBy(symbolData) {
        return symbolData[this.key];
    }

    /**
     * @template V
     * @param {Object<string, V>} data
     * @param {function(V, string): *} func
     * @param {*[]} values
     * @returns {Object<string, V>}
     */
    static filterBy(data, func, values) {
        return ObjectHelper.filter(data, (v, k) => values.indexOf(func(v, k)) !== -1);
    }

    /**
     * @param {string[]} values
     * @param {string} key
     * @param {?Object.<string,string>} [labels]
     * @param {?string[]} [defaults]
     * @param {?string} idPrefix
     */
    static fromValues(values, key, labels = null, defaults = null, idPrefix = null) {
        labels = Object.assign({}, labels);
        labels = Object.fromEntries(Object.map(values, value => [value, labels[value] ?? value]));

        return new this(key, labels, defaults, idPrefix);
    }
}



class SymbolProperty {
    type;
    display;
    solutions;
    maxDist;

    constructor(type, display, solutions, maxDist) {
        this.type = type;
        this.display = display;
        this.solutions = solutions;
        this.maxDist = maxDist;
    }

    static fromData(type, data, maxDist) {
        if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
            const solutions = this.normalizeSolutions(data.solutions || data.solution);
            return new this(type, data.display, solutions, maxDist);
        } else {
            const solutions = this.normalizeSolutions(data);
            return new this(type, this.solutionsString(solutions), solutions, maxDist);
        }
    }

    static normalizeSolutions(solutions) {
        if (!Array.isArray(solutions)) {
            solutions = [solutions];
        }
        const result = [];
        for (const solution of solutions) {
            if (!Array.isArray(solution)) {
                result.push([solution])
            } else {
                result.push(solution);
            }
        }
        return result;
    }

    static solutionsString(solutions) {
        return solutions.map(
            solution => Array.isArray(solution) ? solution.join("/") : solution
        ).join(", ");
    }

    grade(guesses) {
        guesses = guesses.split(/[,;/]\s*/g);

        return _grade_list(
            this.solutions, "average",
            (options) => _grade_list(
                options, "best",
                (option) => _grade_list(
                    guesses, "best",
                    (guess) => this._grade(guess, option)
                )
            )
        )
    }

    _grade(guess, sol) {
        const dist = this._distance(guess, sol);
        if (dist <= this.maxDist) {
            if (this.maxDist === 0) {
                return [1, true];
            }
            return [Math.pow(2, -dist / this.maxDist), true];
        }

        return [0, false];
    }

    _distance(guess, sol) {
        if (this.type === "integer") {
            return Math.abs(parseInt(guess) - parseInt(sol));
        } else if (this.type === "real") {
            return Math.abs(parseFloat(guess) - parseFloat(sol));
        } else if (this.type === "string" || this.type === "istring"){
            guess = guess.trim();
            sol = sol.trim();

            if (this.type === "istring") {
                guess = guess.toLowerCase();
                sol = sol.toLowerCase();
            }
            return levDist(guess, sol);
        } else {
            console.error("Invalid SymbolEntry type:", this.type);
        }
    }
}

function _grade_list(list, scoringMode, grade_func) {
    if (scoringMode !== "best" && scoringMode !== "average") {
        console.error('listScoringMode parameter can only be "best" or "average".');
    }
    const matchAll = scoringMode === "average";

    let total_score = 0;
    let total_passed = matchAll;

    for (const elem of list) {
        const [score, passed] = grade_func(elem);
        if (matchAll) {
            total_passed &&= passed;
            total_score += score;
        } else {
            total_passed ||= passed;
            if (total_score < score) {
                total_score = score;
            }
        }
    }

    if (matchAll) {
        total_score /= list.length;
    }
    return [total_score, total_passed];
}