const NAMES = ['alef', 'bet', 'gimel', 'dalet', 'he', 'vav', 'zayin', 'chet', 'tet', 'yod', 'kaf', 'lamed', 'mem', 'nun', 'samekh', 'ayin', 'pe', 'tsadi', 'qof', 'resh', 'shin', 'tav'];
const SOFIT_NAMES = ['kaf', 'mem', 'nun', 'pe', 'tsadi'];
const ALEF_CHARCODE = 0x5d0;

let letters = {};
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
    letters[name] = obj;
}
console.log(JSON.stringify(letters));

const nameInput = document.getElementById("nameInput");
const nameEval = document.getElementById("nameEval");

class Game {
    constructor() {
        this.reset_chars();
        this.reset_score();
    }

    setup_round() {
        let index = randindex(this.chars);
        this.sol_index = index;
        this.sol = this.chars[index];
        
        document.getElementById("display-cur").innerText = this.sol.char;
        nameInput.value = "";
        nameInput.focus();

        console.log(this.chars.length);
    }

    eval_round() {
        document.getElementById("display-prev").innerText = this.sol.char;
        let entered = nameInput.value;
        nameEval.querySelector(".eval-entered").innerText = entered;
        nameEval.querySelector(".eval-solution").innerText = this.sol.name;

        let correct = entered.toLowerCase() == this.sol.name;
        classIfElse(correct, nameEval, "correct", "incorrect");
        this.update_score(correct);

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
    }

    generate_chars() {
        let chars = NAMES.map(name => {return {'name': name, 'char': letters[name].char}})
        if (this.setting("sofit")) {
            chars = chars.concat(
                SOFIT_NAMES.map(name => {return {'name': name, 'char': letters[name].sofitchar}})
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
    document.documentElement.style.setProperty('--char-font-weight', e.target.value);
});

const game = new Game();

nameInput.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
        game.next_round();
    }
});

game.setup_round();



function classIfElse(bool, obj, trueclass, falseclass = "") {
    if (!bool) {
        let temp = trueclass;
        trueclass = falseclass;
        falseclass = temp;
    }

    obj.classList.remove(...split_classes(falseclass));
    obj.classList.add(...split_classes(trueclass));
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