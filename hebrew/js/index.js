const NAMES = ['alef', 'bet', 'gimel', 'dalet', 'he', 'vav', 'zayin', 'chet', 'tet', 'yod', 'kaf', 'lamed', 'mem', 'nun', 'samekh', 'ayin', 'pe', 'tsadi', 'qof', 'resh', 'shin', 'tav'];
const SOFIT_NAMES = ['kaf', 'mem', 'nun', 'pe', 'tsadi'];
const ALEF_CHARCODE = 0x5d0;

const LETTERS = {};
let i = 0;
for (const name of NAMES) {
    obj = {};
    obj.name = name;
    if (SOFIT_NAMES.indexOf(name) != -1) {
        obj.sofitchar = String.fromCharCode(ALEF_CHARCODE + i);
        i += 1
    }
    obj.char = String.fromCharCode(ALEF_CHARCODE + i);
    i += 1;
    LETTERS[name] = obj;
}
// console.log(JSON.stringify(LETTERS));

const nameInput = document.getElementById("nameInput");

class Game {
    constructor() {
        this.reset_chars();
        this.reset_score();
    }

    display_char(id, char = null) {
        if (char === null) {
            char = this.sol.char;
        }
        document.getElementById("display-" + id).getElementsByClassName('char')[0].innerText = char;
    }

    setup_round() {
        let index = randindex(this.chars);
        this.sol_index = index;
        this.sol = this.chars[index];
        
        this.display_char("cur", this.sol.char);
        nameInput.value = "";
        nameInput.focus();

        console.log(this.chars.length);
    }

    eval_round() {
        this.display_char("sol", this.sol.char);
        let entered = nameInput.value;
        this.display_entered_char(entered);
        const [evalEntered, evalSol] = get_eval_elements(nameInput);
        console.log(nameInput.nextSibling);
        evalEntered.innerText = entered;
        evalSol.innerText = this.sol.name;

        let correct = entered.toLowerCase() == this.sol.name;
        classIfElse(correct, [evalEntered, evalSol], "correct", "incorrect");
        this.clear_char(correct);
        this.update_score(correct);
    }

    display_entered_char(value) {
        value = value.toLowerCase();
        if (value in LETTERS) {
            let letter = LETTERS[value];
            let char = letter.char
            if (letter.sofitchar) {
                char += letter.sofitchar;
            }
            this.display_char("entered", char);
            classIfElse(
                letter.sofitchar,
                document.getElementById("display-entered").querySelector(".char"),
                "two-chars"
            );
        } else {
            this.display_char("entered", "");
            document.getElementById("display-entered").querySelector(".char").classList.remove("two-chars");
        }
    }

    clear_char(correct) {
        let removeCleared = this.setting("removeCleared")
        if (correct && removeCleared) {
            this.remove_char(this.sol_index);
        }
        if (this.chars.length == 0 || !removeCleared && !this.chars_complete) {
            this.reset_chars();
        }
    }

    next_round() {
        this.eval_round();
        this.setup_round();
    }

    reset_score() {
        this.points = 0;
        this.total = 0;
        this.display_score();
    }

    update_score(points = 0) {
        this.points += points;
        this.total += 1;
        this.display_score();
    }

    display_score() {
        document.getElementById("scoreCount").innerText = this.points;
        document.getElementById("scoreTotal").innerText = this.total;
        document.getElementById("symbolCount").innerText = this.chars.length;
    }

    generate_chars() {
        let chars = NAMES.map(name => {return {'name': name, 'char': LETTERS[name].char}})
        if (this.setting("sofit")) {
            chars = chars.concat(
                SOFIT_NAMES.map(name => {return {'name': name, 'char': LETTERS[name].sofitchar}})
            );
        }
        return chars;
    }

    reset_chars() {
        this.chars = this.generate_chars();
        this.chars_complete = true;
    }

    remove_char(index) {
        this.chars.splice(index, 1);
        this.chars_complete = false;
    }

    setting(switchname) {
        return document.getElementById(switchname + "Switch").checked;
    }
}

document.querySelectorAll("input[type=range]").forEach((elem) => {
    let span = document.querySelector(`label[for="${elem.id}"] .range-value`);
    if (span) {
        elem.addEventListener("input", (e) => {
            span.innerText = e.target.value;
        });
    }
});

document.getElementById("fontWeightRange").addEventListener("input", (e) => {
    set_global_css_var('char-font-weight', e.target.value);
});

const game = new Game();

document.querySelectorAll("input[type=text]").forEach((input) => {
    input.addEventListener("focus", (e) => {
        e.preventDefault();
        input.focus({preventScroll: true});
    });
});

nameInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        game.next_round();
    }
});

game.setup_round();

const fonts = {
    'serif': {family: '"Noto Serif Hebrew", serif', shift: '0'},
    'sans': {family: '"Noto Sans Hebrew", sans-serif', shift: '0.18em'}
};
document.querySelectorAll(".font-input").forEach((elem) => {
    let font = fonts[elem.value];
    elem.addEventListener("click", () => {
        set_global_css_var("char-font-family", font.family);
        set_global_css_var("char-shift", font.shift);
    });
});






function get_eval_elements(input) {
    if (typeof input === "string") {
        input = document.getElementById(input + "Input");
    }
    return [input.nextElementSibling, input.nextElementSibling.nextElementSibling];
}


function set_global_css_var(property, value) {
    if (property.substr(0, 2) != "--") {
        property = "--" + property;
    }
    document.documentElement.style.setProperty(property, value)
}

function classIfElse(bool, obj, trueclass, falseclass = "") {
    if (!bool) {
        let temp = trueclass;
        trueclass = falseclass;
        falseclass = temp;
    }

    if (!Array.isArray(obj)) {
        obj = [obj];
    }

    for (const elem of obj) {
        elem.classList.remove(...split_classes(falseclass));
        elem.classList.add(...split_classes(trueclass));
    }
}

function split_classes(classstr) {
    if (!classstr) {
        return [];
    }
    return classstr.split(" ");
}

function randint(min, max = null) {
    if (max === null) {
        max = min;
        min = 0;
    }

    return Math.floor(Math.random() * (max - min) + min);
}

function randbool() {
    return Math.random() >= 0.5;
}

function randelem(arr, keys = null) {
    if (keys) {
        return arr[randelem(keys)];
    }
    if (Array.isArray(arr)) {
        return arr[randindex(arr)];
    }

    return arr[randelem(Object.keys(arr))];
}

function randindex(arr) {
    return randint(arr.length);
}

function shuffle(array) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
}