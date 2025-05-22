class Game {
    dataset;
    properties;
    settings;
    triesBySymbol;
    scoreBySymbol;
    clearedAtTries;
    symbolKeys;
    currentSymbolIndex = null;
    symbolsScore = 0;
    symbolsHitCount = 0;
    roundsScore = 0;
    rounds = 0;
    symbolsCount;
    clearedCount = 0;
    timeStart;
    timeInterval;
    rand;

    static defaultSettings =     {
        symbolsOrder: "random",     // "random", "shuffled" or "sorted"
        scoreMode: "symbols",       // "rounds" or "symbols"
        scoreStringMode: "ratio",   // "ratio" or "percent"
        maxTries: "3",              // integer or "infty"
        removeCleared: true
    };

    constructor(inputs, dataset, symbolKeys, properties, onFinish, settings = null, seed = null) {
        this.inputs = inputs;
        this.dataset = dataset;
        this.symbolKeys = symbolKeys;
        this.properties = properties;
        this.guessedDisplaySymbols = dataset.guessedDisplaySymbols();
        this.onFinish = onFinish;
        if (seed) {
            this.rand = seeded_prng(seed);
        } else {
            this.rand = Math.random;
        }

        this.process_settings(settings);
        this.triesBySymbol = Object.fromEntries(symbolKeys.map(key => [key, 0]));
        this.scoreBySymbol = Object.fromEntries(symbolKeys.map(key => [key, 0]));
        this.clearedAtTries = Object.fromEntries(symbolKeys.map(key => [key, 0]));
        this.symbolsCount = symbolKeys.length;

        if (this.settings.symbolsOrder == "shuffled") {
            shuffle(this.symbolKeys, this.rand);
        }

        this.currentSymbolIndex = null;
        this.symbolsScore = 0;
        this.symbolsHitCount = 0;
        this.roundsScore = 0;
        this.rounds = 0;

        this.timeStart = Date.now();
        this.setupTimeInterval();

        this.display_symbols_left()
        this.display_score();
    }

    process_settings(settings) {
        const scoreModeSet = "scoreMode" in settings;

        settings = Object.assign({}, Game.defaultSettings, settings);
        if (settings.maxTries == "infty") {
            settings.maxTries = Infinity;
        } else {
            settings.maxTries = parseInt(settings.maxTries);
        }

        if (!scoreModeSet) {
            settings.scoreMode = settings.maxTries == Infinity ? "rounds" : "symbols";
        }

        this.settings = settings;
    }

    setupTimeInterval() {
        this.timeInterval = setInterval((game) => {
            game.display_current_time();
        }, 1000, this);
        this.display_current_time();
    }
    
    clearTimeInterval() {
        clearInterval(this.timeInterval);
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
        this.clearTimeInterval();
        this.remove_inputs();
        for (const id of ["current", "guessed", "previous"]) {
            this.display_symbol(id, "");
        }
    }

    finish() {
        this.cleanup();
        this.displayStats();
        this.onFinish();
    }

    current_symbol() {
        return this.dataset.getSymbol(this.symbolKeys[this.currentSymbolIndex]);
    }

    choose_new_symbol(remove_current = false) {
        if (remove_current) {
            this.remove_symbol(this.currentSymbolIndex);
        }

        let newindex;
        if (this.settings.symbolsOrder == "random") {
            newindex = Math.floor(this.rand() * this.symbolKeys.length);
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

        this.update_score(symbol_key, score, cleared);
        this.display_score();

        const remove_current_symbol =
            this.triesBySymbol[symbol_key] >= this.settings.maxTries ||
            this.settings.removeCleared && cleared;
        this.new_round(remove_current_symbol);
    }

    update_score(symbol_key, score, cleared) {
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

        if (cleared && this.clearedAtTries[symbol_key] == 0) {
            this.clearedAtTries[symbol_key] = tries;
            this.clearedCount += 1;
        }
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
        return this.current_symbol()[key].grade(guess);
    }

    display_input(key, guess, score) {
        const input = this.inputs[key];
        const solutions = this.current_symbol()[key];
        const [guess_eval, sol_eval] = this.get_eval_elements(input);
        guess_eval.innerText = guess;
        sol_eval.innerText = solutions.display;

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
        const key = this.dataset.matchEnteredSymbolsTo;
        if (!(key in this.inputs)) {
            return;
        }

        let value = this.inputs[key].value;
        if (this.dataset.properties[key].type == "istring") {
            value = value.toLowerCase();
        }
        if (value in this.guessedDisplaySymbols) {
            this.display_symbol("guessed", this.guessedDisplaySymbols[value]);
        } else {
            this.display_symbol("guessed", "");
        }
    }

    score_string(scoreMode = null, scoreStringMode = null) {
        if (!scoreMode) {
            scoreMode = this.settings.scoreMode;
        }
        if (!scoreStringMode) {
            scoreStringMode = this.settings.scoreStringMode;
        }

        let numerator, denominator;
        if (scoreMode == "rounds") {
            numerator = this.roundsScore;
            denominator = this.rounds;
        } else { // scoreMode = "symbols"
            numerator = this.symbolsScore;
            denominator = this.symbolsHitCount;
        }

        if (scoreStringMode == "percent") {
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

    time_string(seconds_digits = 0) {
        return format_time(Date.now() - this.timeStart, seconds_digits);
    }

    display_current_time() {
        const string = this.time_string();
        document.querySelectorAll(".current-time").forEach(elem => {
            elem.innerText = string;
        });
    }

    pause() {
        this.timePaused = Date.now();
        this.clearTimeInterval();
        this.displayStats();
    }

    resume() {
        this.timeStart += Date.now() - this.timePaused;
        this.setupTimeInterval();
    }

    seenCount() {
        return count_where(this.triesBySymbol, x => x > 0);
    }

    averageTries() {
        if (this.clearedCount == 0) {
            return 0;
        }

        return Object.values(this.clearedAtTries).reduce((acc, val) => acc + val, 0) / this.clearedCount;
    }

    displayStats() {
        document.getElementById("stat-score").innerText =
            this.score_string(this.settings.scoreMode, "ratio") +
            " (" + this.score_string(this.settings.scoreMode, "percent") + ")";
        document.getElementById("stat-time").innerText = this.time_string(2);
        document.getElementById("stat-cleared").innerText = this.clearedCount +  "/" + this.seenCount();
    }
}

function count_where(arr, callback) {
    arr = Object.values(arr);
    return arr.reduce((acc, val) => callback(val) ? acc + 1: acc, 0);
}

function percent_string(x, digits = 0) {
    return Math.floor(x * Math.pow(10, digits + 2)) / Math.pow(10, digits) + "%"
}

function floor(x, digits = 0, factor = 1) {
    const digits_multiplier = Math.pow(10, digits) * factor;
    return Math.floor(x * digits_multiplier) / digits_multiplier;
}

function ceil(x, ...args) {
    return -floor(-x, ...args);
}

function format_time(milliseconds, seconds_digits = 0) {
    let seconds = Math.floor(milliseconds / 1000);
    milliseconds -= seconds * 1000;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    let string = String(minutes).padStart(2, 0) + ":" + String(seconds).padStart(2, 0);
    if (seconds_digits > 0) {
        string += "." + String(Math.floor(milliseconds * Math.pow(10, seconds_digits - 3))).padStart(seconds_digits, 0);
    }

    return string;
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


function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return [h1>>>0, h2>>>0, h3>>>0, h4>>>0];
}

function sfc32(a, b, c, d) {
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

function seeded_prng(seed) {
    return sfc32(...cyrb128(seed));
}

function randint(min, max = null) {
    if (max === null) {
        max = min;
        min = 0;
    }

    return Math.floor(Math.random() * (max - min) + min);
}

function randindex(arr) {
    return randint(arr.length);
}

function shuffle(array, rand = Math.random) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(rand() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
}