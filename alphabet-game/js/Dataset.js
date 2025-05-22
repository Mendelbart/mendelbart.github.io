class Dataset {
    name
    gameName
    terms
    fonts
    groups
    properties
    symbols
    propertyKeys
    groupKeys
    matchedDisplayStrings
    matchEnteredSymbolsTo
    symbolKeysByGroups

    constructor(data) {
        this.name = data.name;
        this.gameName = data.gameName;
        this.terms = data.terms;
        this.fonts = data.fonts;
        this.groups = data.groups;
        this.properties = data.properties;
        this.propertyKeys = Object.keys(this.properties);
        this.groupKeys = Object.keys(this.groups);
        this.matchEnteredSymbolsTo = data.matchEnteredSymbolsTo;

        if (data.symbols) {
            this.symbols = this.buildSymbols(data.symbols, data.defaultGroup, !!data.autoGroup);
            this.matchedDisplayStrings = this.buildMatchedDisplayStrings(data.matchPropertyForDisplay || this.propertyKeys[0]);
        }
    }

    getSymbol(key) {
        return this.symbols[key];
    }

    buildMatchedDisplayStrings(property) {
        const strs = {};
        for (const symbol of Object.values(this.symbols)) {
            const key = symbol[property];
            if (!(key in strs)) {
                strs[key] = "";
            }

            strs[key] += symbol.string;
        }
        return strs;
    }

    buildSymbols(symbols, defaultGroup, autoGroup) {
        const result = {};
        for (const [key, symbol] of Object.entries(symbols)) {
            if ("mult" in symbol) {
                const multsymbol = Object.assign({}, symbol);    
                delete multsymbol.mult;
                for (const [multkey, multdata] of Object.entries(symbol.mult)) {
                    result[key + "_" + multkey] = this.processSymbol(multsymbol, multdata);
                }
            } else if (Array.isArray(symbol.string)) {
                for (const [index, string] of Object.entries(symbol.string)) {
                    const multsymbol = Object.assign({}, symbol);
                    multsymbol.string = string;
                    if (autoGroup) {
                        multsymbol.group = this.groupKeys[index];
                    }
                    result[key + "_" + this.groupKeys[index]] = this.processSymbol(multsymbol);
                }
            } else {
                result[key] = this.processSymbol(symbol);
            }
        }

        if (defaultGroup) {
            for (const symbol of Object.values(result)) {
                if (!("group" in symbol)) {
                    symbol.group = defaultGroup;
                }
            }
        }
        return result;
    }

    processSymbol(...args) {
        const symbol = Object.assign({}, ...args);
        for (const [key, value] of Object.entries(symbol)) {
            if (key !== "string" && key !== "group") {
                symbol[key] = SymbolEntry.fromData(
                    this.properties[key].type,
                    value,
                    this.properties[key].maxDist
                );
            }
        }
        return symbol;
    }

    symbolKeysByGroupDict() {
        const result = {};
        for (const [key, symbol] of Object.entries(this.symbols)) {
            if (!(symbol.group in result)) {
                result[symbol.group] = [];
            }
            result[symbol.group].push(key);
        }
        return result;
    }

    symbolKeysFromGroups(groupKeys) {
        return Object.entries(this.symbols)
            .filter(([_, symbol]) => groupKeys.includes(symbol.group))
            .map(([key, _]) => key);
    }

    propertiesFromKeys(propertyKeys) {
        return Object.fromEntries(
            propertyKeys.map(key => [key, this.properties[key]])
        );
    }

    guessedDisplaySymbols() {
        const symbols = {};
        for (const symbol of Object.values(this.symbols)) {
            let keys = symbol[this.matchEnteredSymbolsTo].solutions.flat();

            for (const k of keys) {
                const key = k.toLowerCase();
                if (key in symbols) {
                    symbols[key] += symbol.string;
                } else {
                    symbols[key] = symbol.string;
                }
            }
        }

        return symbols;
    }
}

class SymbolEntry {
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
            return new SymbolEntry(type, data.display, solutions, maxDist);
        } else {
            const solutions = this.normalizeSolutions(data);
            return new SymbolEntry(type, this.solutionsString(solutions), solutions, maxDist);
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
            if (this.maxDist == 0) {
                return [1, true];
            }
            return [Math.pow(2, -dist / this.maxDist), true];
        }

        return [0, false];
    }

    _distance(guess, sol) {
        if (this.type == "integer") {
            return parseInt(guess) - parseInt(sol);
        } else if (this.type == "real") {
            return parseFloat(guess) - parseFloat(sol);
        } else if (this.type == "string" || this.type == "istring"){
            guess = guess.trim();
            sol = sol.trim();

            if (this.type == "istring") {
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