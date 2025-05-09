// --------------- GAME CLASS -----------------
/** Game class */
class Game {
    symbols;
    properties;
    guessedDisplaySymbols;
    settings;
    triesBySymbol;
    scoreBySymbol;
    symbolKeys;
    currentSymbolIndex = null;
    previousSymbolIndex = null;
    symbolsScore = 0;
    symbolsHitCount = 0;
    roundsScore = 0;
    rounds = 0;

    static defaultSettings = {
        symbolsOrder: "random",     // "random", "shuffled" or "sorted"
        scoreMode: "rounds",        // "rounds" or "symbols"
        scoreStringMode: "ratio",   // "ratio" or "percent"
        maxTries: "3",              // integer or "infty"
        removeCleared: true
    };

    constructor(inputs, symbols, properties, guessedDisplaySymbols, onFinish, settings = null) {
        this.inputs = inputs;
        this.symbols = symbols;
        this.properties = properties;
        this.guessedDisplaySymbols = guessedDisplaySymbols;
        this.onFinish = onFinish;

        this.settings = Game.process_settings(settings);
        this.triesBySymbol = objectMap(symbols, () => 0);
        this.scoreBySymbol = objectMap(symbols, () => 0);

        this.symbolKeys = Object.keys(symbols);
        if (this.settings.symbolsOrder == "shuffled") {
            shuffle(this.symbolKeys);
        }

        this.previousSymbolIndex = null;
        this.currentSymbolIndex = null;
        this.symbolsScore = 0;
        this.symbolsHitCount = 0;
        this.roundsScore = 0;
        this.rounds = 0;

        this.display_symbols_left()
        this.display_score();
    }

    static process_settings(settings) {
        settings = Object.assign({}, Game.defaultSettings, settings);
        if (settings.maxTries == "infty") {
            settings.maxTries = Infinity;
        } else {
            settings.maxTries = parseInt(settings.maxTries);
        }
        return settings;
    }

    remove_inputs() {
        for (const [key, input] of Object.entries(this.inputs)) {
            input.nextElementSibling.remove();
            input.nextElementSibling.remove();
            input.remove();
            delete this.inputs[key];
        }
    }

    cleanup() {
        this.remove_inputs();
        for (const id of ["current", "guessed", "previous"]) {
            this.display_symbol(id, "");
        }
    }

    finish() {
        this.cleanup();
        this.onFinish();
    }

    _symbol_by_index(index) {
        return this.symbols[this.symbolKeys[index]];
    }

    current_symbol() {
        return this._symbol_by_index(this.currentSymbolIndex);
    }
    previous_symbol() {
        return this._symbol_by_index(this.previousSymbolIndex);
    }

    choose_new_symbol(remove_current = false) {
        if (remove_current) {
            this.remove_symbol(this.currentSymbolIndex);
        }

        this.previousSymbolIndex = this.currentSymbolIndex;

        let newindex;
        if (this.settings.symbolsOrder == "random") {
            newindex = randindex(this.symbolKeys);
        } else {
            if (this.currentSymbolIndex === null) {
                newindex = 0;
            } else {
                newindex = remove_current ? this.currentSymbolIndex : this.currentSymbolIndex + 1;
                if (newindex == this.symbolKeys.length) {
                    newindex = 0;
                }
            }
        }

        this.currentSymbolIndex = newindex;
    }

    submit_round() {
        const [score, cleared] = this.grade_inputs();

        const symbol_key = this.symbolKeys[this.currentSymbolIndex];

        this.display_previous_symbols();

        this.update_score(symbol_key, score);
        this.display_score();

        const remove_current_symbol =
            this.triesBySymbol[symbol_key] >= this.settings.maxTries ||
            this.settings.removeCleared && cleared;
        this.new_round(remove_current_symbol);
    }

    update_score(symbol_key, score) {
        const tries = (this.triesBySymbol[symbol_key] += 1);
        if (tries == 1) {
            this.symbolsHitCount += 1;
        }

        const symbolScore = score * this.tries_multiplier(tries); 

        if (this.scoreBySymbol[symbol_key] < symbolScore) {
            this.symbolsScore += symbolScore - this.scoreBySymbol[symbol_key];
            this.scoreBySymbol[symbol_key] = symbolScore;
        }

        this.roundsScore += score;
        this.rounds += 1;
    }

    grade_inputs() {
        let score = 0;
        let cleared = true;
        for (const [key, input] of Object.entries(this.inputs)) {
            const [input_score, input_cleared] = this.grade_input(key, input.value);
            score += input_score;
            this.display_input(key, input.value, input_score);
            cleared &&= input_cleared;
        }
        return [this.normalize_score(score), cleared];
    }

    normalize_score(score) {
        return score / Object.keys(this.properties).length;
    }

    tries_multiplier(tries) {
        return 1 / tries;
    }

    grade_input(key, guess) {
        const solutions = this.current_symbol()[key];
        const property = this.properties[key];
        if (property.scoring == "string") {
            return grade_string(guess, solutions, property.maxDist, property.listScoringMode);
        } else if (property.scoring == "integer") {
            return grade_integer(guess, solutions);
        }
    }

    display_input(key, guess, score) {
        const input = this.inputs[key];
        const solutions = this.current_symbol()[key];
        const [guess_eval, sol_eval] = this.get_eval_elements(input);
        guess_eval.innerText = guess;
        sol_eval.innerText = solution_to_string(solutions);

        const displays = [guess_eval, sol_eval];
        
        classIfElse(score == 1, displays, "correct");
        classIfElse(0 < score && score < 1, displays, "almost-correct");
        classIfElse(score == 0, displays, "incorrect");
    }

    get_eval_elements(input) {
        const guess_eval = input.nextElementSibling;
        return [guess_eval, guess_eval.nextElementSibling];
    }

    new_round(remove_current_symbol) {
        if (remove_current_symbol && this.symbolKeys.length == 1) {
            this.finish();
            return;
        }

        this.choose_new_symbol(remove_current_symbol);
        this.display_symbol("current", this.current_symbol().string);

        for (const input of Object.values(this.inputs)) {
            input.value = "";
        }

        this.focus();
    }

    nth_input(n) {
        return Object.values(this.inputs)[n];
    }

    focus() {
        this.nth_input(0).focus();
    }

    display_previous_symbols() {
        this.display_symbol("previous", this.current_symbol().string);
        this.display_guess_matching_symbols();
    }

    display_symbol(id, symbol) {
        const container = document.getElementById(id + "-symbol");
        const symbolElement = container.querySelector('.symbol');
        symbolElement.innerHTML = symbol;
        symbolElement.style.setProperty("--symbol-scale", 1);
        const [symbolWidth, symbolHeight] = element_size(symbolElement, true);
        const [containerWidth, containerHeight] = element_size(container, false);

        const scale = Math.min(containerWidth / symbolWidth, containerHeight / symbolHeight);
        if (scale < 1) {
            symbolElement.style.setProperty("--symbol-scale", scale);
        }
    }

    display_guess_matching_symbols() {
        if (!(this.guessedDisplaySymbols.matchTo in this.inputs)) {
            return;
        }

        const value = this.inputs[this.guessedDisplaySymbols.matchTo].value.toLowerCase();
        if (value in this.guessedDisplaySymbols.symbols) {
            this.display_symbol("guessed", this.guessedDisplaySymbols.symbols[value]);
        } else {
            this.display_symbol("guessed", "");
        }
    }

    score_string() {
        let numerator, denominator;
        if (this.settings.scoreMode == "rounds") {
            numerator = this.roundsScore;
            denominator = this.rounds;
        } else { // scoreMode = "symbols"
            numerator = this.symbolsScore;
            denominator = this.symbolsHitCount;
        }

        if (this.settings.scoreStringMode == "percent") {
            if (denominator == 0) {
                return percent_string(0);
            }
            return percent_string(numerator / denominator);
        } else { // scoreStringMode = "ratio"
            return floor(numerator, 1, 2) + "/" + denominator;
        }
    }

    display_score() {
        const score_string = this.score_string();
        document.querySelectorAll(".current-score").forEach(elem => {
            elem.innerText = score_string;
        });
    }

    display_symbols_left() {
        document.getElementById("symbolCount").innerText = this.symbolKeys.length;
    }

    remove_symbol(index) {
        this.symbolKeys.splice(index, 1);
        this.display_symbols_left();
    }
}


function _grade_string(guess, sol, maxDist) {
    const dist = levDist(normalize_string(sol), normalize_string(guess));
    if (dist <= maxDist) {
        if (maxDist == 0) {
            return [1, true];
        }
        return [Math.pow(2, -dist / maxDist), true];
    }

    return [0, false];
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

function _grade_string_list(guesses, sols, maxDist, scoringMode) {
    if (scoringMode !== "best" && scoringMode !== "average") {
        console.error('listScoringMode parameter can only be "best" or "average".');
    }

    guesses = guesses.split(/,\s*/g);

    return _grade_list(
        sols, scoringMode,
        (sol) => _grade_list(
            guesses, "best",
            (guess) => _grade_string(guess, sol, maxDist)
        )
    )
}

function grade_string(guess, sol, maxDist, listScoringMode) {
    if (Array.isArray(sol)) {
        return _grade_string_list(guess, sol, maxDist, listScoringMode);
    }
    return _grade_string(guess, sol, maxDist);
}

function grade_integer(guess, sol) {
    return parseInt(guess) === parseInt(sol) ? [1, true] : [0, false];
}

function solution_to_string(solutions) {
    if (typeof solutions === "string") {
        return solutions;
    }
    if (Array.isArray(solutions)) {
        return solutions.join(", ");
    }
    return String(solutions);
}

function percent_string(x, digits = 0) {
    return Math.floor(x * Math.pow(10, digits + 2)) / Math.pow(10, digits) + "%"
}

function floor(x, digits = 0, factor = 1) {
    const digits_multiplier = Math.pow(10, digits) * factor;
    return Math.floor(x * digits_multiplier) / digits_multiplier;
}

function one_true(arr) {
    return arr.reduce((bool, elem) => bool || elem, false);
}

function all_true(arr) {
    return arr.reduce((bool, elem) => bool && elem, true);
}

function normalize_string(str) {
    return str.trim().toLowerCase();
}



function element_size(element, with_padding = false) {
    const computedStyle = getComputedStyle(element);

    let width = element.clientWidth;
    let height = element.clientHeight;

    if (!with_padding) {
        width -= parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight),
        height -= parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom)
    }

    return [width, height];
}
