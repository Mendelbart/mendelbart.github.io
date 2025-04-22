// --------------- CONSTANTS -----------------
const SCRIPTS = {};
const TEMPLATES = {
    button: `
        <input type="{TYPE}" class="btn-check form-input {CLASS}" name="{NAME}" id="{ID}" autocomplete="off" value="{VALUE}" {CHECKED}>
        <label class="btn btn-outline-primary" for="{ID}">{DISPLAYNAME}</label>
    `,
};
const scriptSelect = document.getElementById("scriptSelect");


// --------------- GAME CLASS -----------------
class Game {
    constructor() {
        this.reset();
    }

    reset() {
        this.script = scriptSelect.value;
        this.chars = [];
        this.reset_score();
        
        for (const id of ["cur", "entered", "sol"]) {
            this.display_char(id, "");
        }
        document.querySelectorAll(".eval-field").forEach(elem => {
            elem.innerHTML = "";
            elem.classList.remove("correct", "incorrect");
        });
    }

    start() {
        this.setup_chars();
        this.setup_round();
    }

    restart() {
        this.reset();
        this.start();
    }

    fonts() {
        return SCRIPTS[this.script].fonts;
    }

    forms() {
        return SCRIPTS[this.script].forms;
    }

    display_char(id, char = null) {
        if (char === null) {
            char = this.sol.char;
        }
        document.getElementById("display-" + id).getElementsByClassName('char')[0].innerHTML = char;
    }

    setup_round() {
        let index = randindex(this.chars);
        this.sol_index = index;
        this.sol = this.chars[index];

        this.display_score();
        
        this.display_char("cur", this.sol.char);
        nameInput.value = "";
        nameInput.focus();
    }

    eval_round() {
        this.display_char("sol", this.sol.char);
        let entered = nameInput.value;
        this.display_entered_char(entered);
        const [evalEntered, evalSol] = get_eval_elements(nameInput);
        
        evalEntered.innerText = entered;
        evalSol.innerText = this.sol.name;

        let correct = entered.toLowerCase() == this.sol.name;
        classIfElse(correct, [evalEntered, evalSol], "correct", "incorrect");
        this.clear_char(correct);
        this.update_score(correct);
    }

    display_entered_char(value) {
        value = value.toLowerCase();
        if (value in this.letters) {
            let letter = this.letters[value];
            let joined_chars = "";
            for (const char of Object.values(letter.chars)) {
                joined_chars += char;
            }
            joined_chars = joined_chars.match(/.{1,2}/g).join("<br>");
            this.display_char("entered", joined_chars);

            classIfElse(
                joined_chars.length == 2,
                document.getElementById("display-entered").querySelector(".char"),
                "two-chars"
            );
        } else {
            this.display_char("entered", "");
            document.getElementById("display-entered").querySelector(".char").classList.remove("two-chars");
        }
    }

    clear_char(correct) {
        let removeCleared = this.setting("removeCleared");
        if (correct && removeCleared) {
            this.remove_char(this.sol_index);
        }
        if (this.chars.length == 0 || !removeCleared && !this.chars_complete) {
            this.setup_chars();
        }
    }

    submit() {
        this.eval_round();
        this.setup_round();
    }

    reset_score() {
        this.points = 0;
        this.total = 0;
    }

    update_score(points = 0) {
        this.points += points;
        this.total += 1;
    }

    display_score() {
        document.getElementById("scoreCount").innerText = this.points;
        document.getElementById("scoreTotal").innerText = this.total;
        document.getElementById("symbolCount").innerText = this.chars.length;
    }

    generate_chars() {
        let chars = [];
        for (const letter of Object.values(this.letters)) {
            for (const [form, char] of Object.entries(letter.chars)) {
                if (this.active_forms.includes(form)) {
                    chars.push({name: letter.name, char: char});
                }
            }
        }
        
        return chars;
    }

    update_active_forms() {
        this.active_forms = [];
        document.querySelectorAll(".form-button").forEach(elem => {
            if (elem.checked) {
                this.active_forms.push(elem.value);
            }
        });
    }

    setup_chars() {
        this.letters = {};
        for (const letter of SCRIPTS[this.script].letters) {
            this.letters[letter.name] = letter;
        }

        this.update_active_forms();
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


// --------------- GAME SETUP -----------------
const game = new Game();

fetch("./json/scripts.json")
    .then(response => response.json())
    .then(json => {
        Object.assign(SCRIPTS, json);
        setup_game();
    });

const nameInput = document.getElementById("nameInput");
const fontButtons = document.getElementById("fontButtons");
const formsButtons = document.getElementById("formsButtons");

scriptSelect.addEventListener("change", setup_game);

function setup_game() {
    let scripttype = SCRIPTS[scriptSelect.value].type;
    let gamename = scripttype + " Game";
    document.querySelectorAll("h2, title").forEach(elem => {
        elem.innerText = gamename;
    });

    game.reset();
    setup_font_buttons();
    setup_forms_buttons();
    update_font();
    game.start();
}



// --------------- EVENT LISTENERS -----------------
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

document.querySelectorAll("input[type=text]").forEach((input) => {
    input.addEventListener("focus", (e) => {
        e.preventDefault();
        input.focus({preventScroll: true});
    });
});

nameInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        game.submit();
    }
});

document.querySelectorAll(".font-input").forEach((elem) => {
    let font = fonts[elem.value];
    elem.addEventListener("click", () => {
        set_global_css_var("char-font-family", font.family);
        set_global_css_var("char-shift", font.shift);
    });
});

formsButtons.addEventListener("click", (e) => {
    if (e.target.classList.contains("form-button")) {
        game.restart();
    }
});

function update_font(index = 0) {
    let font = game.fonts()[index];
    set_global_css_var("--char-font-family", font.family);
    
    let shift = game.script == "hebrew" && font.displayname == "Sans" ? "0.18em" : 0;
    set_global_css_var("--char-shift", shift);
    
    let scale = game.script == "greek" ? 0.85 : 1;
    set_global_css_var("--char-scale", scale);
}

function setup_font_buttons() {
    let html = "";
    for (const [index, font] of Object.entries(game.fonts())) {
        html += html_from_template("button", {
            type: "radio",
            name: "font-button",
            checked: index == 0 ? "checked" : "",
            class: "font-button",
            id: "fontButton" + index,
            value: index,
            displayname: font.displayname
        });
    }
    fontButtons.innerHTML = html;
    fontButtons.querySelectorAll(".font-button").forEach(elem => {
        elem.addEventListener("change", () => {
            if (elem.checked) {
                update_font(elem.value);
            }
        })
    })
}

function setup_forms_buttons() {
    let html = "";
    for (const [index, form] of Object.entries(game.forms())) {
        html += html_from_template("button", {
            type: "checkbox",
            name: "form-button",
            checked: "checked",
            class: "form-button",
            id: "formButton" + index,
            value: form.key,
            displayname: form.displayname
        });
    }
    formsButtons.innerHTML = html;
}


// --------------- DOM FUNCTIONS ---------------
function html_from_template(template_name, data) {
    let html = TEMPLATES[template_name];
    for (const [key, value] of Object.entries(data)) {
        html = html.replaceAll(`{${key.toUpperCase()}}`, value);
    }
    return html;
}

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

// --------------- RANDOM FUNCTIONS -----------------
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