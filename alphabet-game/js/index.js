// --------------- CONSTANTS -----------------
const datasets_metadata = {
    hebrew: {name: "Hebrew", file: "./json/datasets/hebrew.json"},
    greek: {name: "Greek", file: "./json/datasets/greek.json"},
    elder_futhark: {name: "Elder Futhark", file: "./json/datasets/elder_futhark.json"}
}
const _datasets_cache = {};
const html_templates = {
    option: `<option value="{VALUE}" {SELECTED}>{DISPLAYNAME}</option>`,
    button: `<input type="{TYPE}" class="btn-check form-input {CLASS}" name="{NAME}" id="{ID}" autocomplete="off" value="{VALUE}" {CHECKED} {DISABLED}>
             <label class="btn btn-outline-primary" for="{ID}">{DISPLAYNAME}</label>`,
    inputRow: `<input type="text" class="game-input" placeholder="{PLACEHOLDER}">
               <span class="eval-field eval-entered"></span>
               <span class="eval-field eval-solution"></span>`
}

async function get_dataset(key) {
    if (key in _datasets_cache) {
        return _datasets_cache[key];
    }

    let dataset = await fetch(datasets_metadata[key].file).then(response => response.json());
    dataset = new Dataset(dataset);
    _datasets_cache[key] = dataset;
    return dataset;
}
const datasetSelect = document.getElementById("datasetSelect");
const groupsButtons = document.getElementById("groupsButtons");


// --------------- EVENT LISTENERS -----------------
(function() {
    // Range Value Span
    document.querySelectorAll("input[type=range]").forEach((elem) => {
        if (!elem.id) {
            return;
        }

        let span = document.querySelector(`label[for="${elem.id}"] .range-value`);

        if (!span) {
            return;
        }

        const update_elem = () => {
            span.innerText = elem.value;
        }
        elem.addEventListener("input", update_elem);
        update_elem();
    });

    // update fontWeightrange
    const fontWeightRange = document.getElementById("fontWeightRange");
    const update_font_weight = () => {
        set_global_css_var('symbol-font-weight', fontWeightRange.value);
    } 
    fontWeightRange.addEventListener("input", update_font_weight);
    update_font_weight();
})();


// --------------- GAME SETUP -----------------
(async function() {
    let game = null;

    datasetSelect.innerHTML = select_options_html(
        objectMap(datasets_metadata, data => data.name)
    );
    datasetSelect.addEventListener("change", () => {
        select_dataset(datasetSelect.value);
    });
    document.getElementById("new-game-button").addEventListener("click", () => {
        const [groupKeys, propertyKeys, settings, seed, valid] = get_game_settings();
        if (valid) {
            new_game(datasetSelect.value, groupKeys, propertyKeys, settings, seed);
        }
    });

    document.getElementById("pause-game-button").addEventListener("click", () => {
        game.pause();
        toggle_dialogue(true);
    });
    document.getElementById("stop-game-button").addEventListener("click", () => {
        game.cleanup();
        hide(document.getElementById("game-stats-container"));
        toggle_dialogue(true);
    });
    document.getElementById("resume-game-button").addEventListener("click", () => {
        toggle_dialogue(false);
        game.resume();
        game.focus();
    });
    document.querySelectorAll("#current-time, #current-time-alt").forEach(elem => {
        elem.addEventListener("click", () => {
            toggle_shown(
                elem.id == "current-time",
                document.getElementById("current-time-alt"),
                document.getElementById("current-time")
            );
        });
    });
    document.querySelectorAll(".current-score").forEach(elem => {
        elem.addEventListener("click", () => {
            game.settings.scoreStringMode = game.settings.scoreStringMode == "percent" ? "ratio" : "percent";
            game.display_score();
        });
    });

    const allfonts = await fetch("./json/fonts.json").then(response => response.json());

    select_dataset(datasetSelect.value);
    hide(document.getElementById("game-stats-container"));
    toggle_dialogue(true);

    async function new_game(datasetKey, groupKeys, propertyKeys, settings, seed) {
        if (game) {
            game.cleanup();
        }

        const dataset = await get_dataset(datasetKey);

        set_dataset_terms(document.getElementById("game-container"), dataset, true);
        set_dataset_terms(document.getElementById("game-stats-container"), dataset, true);
    
        game = create_game_instance(dataset, groupKeys, propertyKeys, settings, seed);
        game_input_listeners(game);

        setup_font_buttons(dataset.fonts, allfonts);

        toggle_dialogue(false);
        game.new_round();

        show(document.getElementById("game-stats-container"));
        // document.querySelector("#score-display .score-label").innerText = "Current Score:";
        show(document.getElementById("resume-game-button"));
    }

    function game_input_listeners(game) {
        const input_keys = Object.keys(game.inputs);
        const inputs_length = input_keys.length;
        for (const [i, key] of Object.entries(input_keys)) {
            const input = game.inputs[key];
            if (i == input_keys.length - 1) {
                // Focus on next input on Enter
                input.addEventListener("keydown", event => {
                    if (event.key == "Enter") {
                        game.submit_round();
                    }
                });
            } else {
                // Submit if it's the last input
                input.addEventListener("keydown", event => {
                    if (event.key == "Enter") {
                        input.nextElementSibling.nextElementSibling.nextElementSibling.focus();
                    }
                });
            }

            // Focus on previous input on Backspace if current was empty.
            if (i > 0) {
                input.addEventListener("keydown", event => {
                    if (event.key == "Backspace") {
                        input.isEmpty = event.target.value === "";
                    }
                });
                input.addEventListener("keyup", event => {
                    if (event.key == "Backspace" && input.isEmpty) {
                        input.previousElementSibling.previousElementSibling.previousElementSibling.focus();
                    }
                });
            }
        }
    }

    async function select_dataset(dataset_key) {
        const dataset = await get_dataset(dataset_key);
        setup_properties_buttons(dataset);
        setup_groups_buttons(dataset);
    
        set_dataset_terms(
            document.getElementById("new-game-settings"),
            dataset
        )
    }

    function set_dataset_terms(container, dataset, setGameName = false) {
        container.querySelectorAll(".symbol-term-plural").forEach(elem => {
            elem.innerText = dataset.terms.symbols;
        });
        container.querySelectorAll(".symbol-term").forEach(elem => {
            elem.innerText = dataset.terms.symbol;
        });
        if (setGameName) {
            container.querySelectorAll(".game-name").forEach(elem => {
                let fontFamily = null;
                if (dataset.gameName.font) {
                    fontFamily = allfonts[dataset.gameName.font].family;
                }
                gameNameScale = dataset.gameName.scale ? dataset.gameName.scale : 1;
                set_global_css_var("--game-name-scale", gameNameScale);
                setup_gamename_heading(elem, dataset.gameName.string, fontFamily);
            });
        
            classIfElse(
                dataset.rtl,
                container.getElementsByClassName("game-name-heading"),
                "rtl"
            );
        }
    }
})();

function toggle_shown(showfirst, first, second) {
    if (showfirst) {
        hide(second);
        show(first);
    } else {
        hide(first);
        show(second);
    }
}

function update_heading_scale() {
    const h2 = document.querySelector("#game-heading h2");
    const scale = Math.min(1, h2.clientWidth / h2.scrollWidth);
    set_global_css_var("--heading-scale", scale);
}

function toggle_dialogue(show_dialogue) {
    toggle_shown(
        show_dialogue,
        document.getElementById("game-dialogue"),
        document.getElementById("game-container")
    );
}

function get_game_settings() {
    const settings = {};
    let valid = true;

    removeClass(document.getElementsByClassName("invalid-setting"), "invalid-setting");

    const groupKeys = get_button_group_values("groupsButtons");
    if (groupKeys.length == 0) {
        document.getElementById("groupsButtons").parentElement.classList.add("invalid-setting");
        valid = false;
    }

    const propertyKeys = get_button_group_values("propertiesButtons");
    if (propertyKeys.length == 0) {
        document.getElementById("propertiesButtons").parentElement.classList.add("invalid-setting");
        valid = false;
    }

    settings.maxTries = get_button_group_values("triesButtons")[0];
    settings.symbolsOrder = get_button_group_values("orderButtons")[0];
    settings.removeCleared = document.getElementById("removeClearedSwitch").checked;

    const seed = document.getElementById("seedInput").value;

    return [groupKeys, propertyKeys, settings, seed, valid];
}

function create_game_instance(dataset, groupKeys, propertyKeys, settings, seed = null) {
    const gameProperties = dataset.propertiesFromKeys(propertyKeys);
    const symbolKeys = dataset.symbolKeysFromGroups(groupKeys);
    const inputs = create_game_inputs(gameProperties);

    const onFinish = () => {
        toggle_dialogue(true);
        hide(document.getElementById("resume-game-button"));
        // document.querySelector("#score-display .score-label").innerText = "Final Score:";
    };

    return game = new Game(inputs, dataset, symbolKeys, gameProperties, onFinish, settings, seed);
}

function create_game_inputs(properties) {
    const inputs = {};
    const inputsContainer = document.getElementById("game-inputs");

    for (const [key, property] of Object.entries(properties)) {
        const html = html_from_template("inputRow", {placeholder: property.displayName});
        inputsContainer.insertAdjacentHTML("beforeend", html);
        inputs[key] = nth_child(inputsContainer, -3);

        // Prevent Auto Scroll on phones
        inputs[key].addEventListener("focus", (e) => {
            e.preventDefault();
            e.target.focus({preventScroll: true});
        });
    }

    return inputs;
}


function get_button_group_values(id) {
    const values = [];
    document.getElementById(id).querySelectorAll(".btn-check").forEach(elem => {
        if (elem.checked) {
            values.push(elem.value);
        }
    });
    return values;
}

function set_button_group_values(id, values) {
    if (typeof values === "string") {
        values = [values];
    }
    document.getElementById(id).querySelectorAll(".btn-check").forEach(elem => {
        elem.checked = values.includes(elem.value);
    });
}

function setup_gamename_heading(element, gameName, fontFamily) {
    element.dataset.gameNameIndex = 0;
    element.style.fontFamily = fontFamily;
    
    if (typeof gameName === "string") {
        element.innerText = gameName;
        element.onclick = null;
    } else { // gameName is Array
        element.innerText = gameName[0];
        element.onclick = () => {
            let index = Number(element.dataset.gameNameIndex) + 1;
            if (index == gameName.length) {
                index = 0;
            }
            element.dataset.gameNameIndex = index;
            element.innerText = gameName[index];
        };
    }
}


// --------------- GAME SETUP FUNCTIONS -----------------
function select_options_html(data, selected = null, disabled = null) {
    if (!selected) {
        selected = Object.keys(data)[0];
    }
    if (!disabled) {
        disabled = [];
    }
    let html = "";
    for (const [value, displayName] of Object.entries(data)) {
        html += html_from_template("option", {
            value: value,
            displayName: displayName,
            selected: selected.includes(value),
            disabled: disabled.includes(value)
        });
    }
    return html;
}

function update_font(font) {
    set_global_css_var("--symbol-font-family", font.family);
    set_global_css_var("--symbol-shift", font.shift ? font.shift + "em" : 0);
    set_global_css_var("--symbol-font-scale", font.scale ? font.scale : 1);
    document.getElementById("fontWeightRange").value = font.weight ? font.weight : 400;
    document.getElementById("fontWeightRange").dispatchEvent(new Event('input', {
        bubbles: true,
    }));
}

function button_group_inner_html(data, type, btnclass, idprefix, checked = null, disabled = null) {
    if (!checked) {
        checked = [];
    } else if (typeof checked === "string") {
        checked = [checked];
    } else if (checked === true) {
        checked = Object.keys(data);
    }

    if (!disabled) {
        disabled = [];
    } else if (disabled === true) {
        disabled = Object.keys(data);
    }
    
    let html = "";
    for (const [i, [value, displayName]] of Object.entries(Object.entries(data))) {
        html += html_from_template("button", {
            type: type,
            class: btnclass,
            name: idprefix,
            id: idprefix + i,
            value: value,
            displayName: displayName,
            disabled: disabled.includes(value),
            checked: checked.includes(value)
        });
    }

    return html;
}

function setup_groups_buttons(dataset, checked, disabled) {
    if (!checked) {
        checked = Object.keys(dataset.groups);
    }
    groupsButtons.innerHTML = button_group_inner_html(
        dataset.groups, "checkbox", "group-button", "groupButton", checked, disabled
    );
    groupsButtons.querySelectorAll(".group-button").forEach(elem => {
        elem.addEventListener("change", () => {
            update_symbolcount(dataset);
        });
    });
    update_symbolcount(dataset);
}

function get_active_symbolcount(dataset) {
    return dataset.symbolKeysFromGroups(get_button_group_values("groupsButtons")).length;
}

function update_symbolcount(dataset) {
    const count = get_active_symbolcount(dataset);
    document.getElementById("totalSymbolCount").innerText = count;
}

function setup_properties_buttons(dataset, checked = null, disabled = null) {
    if (!checked) {
        checked = Object.keys(dataset.properties);
    }
    document.getElementById("propertiesButtons").innerHTML = button_group_inner_html(
        objectMap(dataset.properties, property => property.displayName),
        "checkbox", "property-button", "propertyButton", checked, disabled
    );
}

function setup_font_buttons(fonts, allfonts, checked = null) {
    if (!checked) {
        checked = fonts[0].key;
    }

    fonts_dict = {};
    for (const font of fonts) {
        fonts_dict[font.key] = Object.assign({}, allfonts[font.key], font);
    }

    fontNames = objectMap(fonts_dict, font => font.displayName);

    document.getElementById("fontButtons").innerHTML = button_group_inner_html(
        fontNames, "radio", "font-button", "fontButton", checked, false
    );

    document.querySelectorAll("#fontButtons .font-button").forEach(elem => {
        elem.addEventListener("change", (e) => {
            update_font(fonts_dict[e.target.value]);
        });
        if (elem.checked) {
            update_font(fonts_dict[elem.value]);
        }
    });
}

// --------------- DOM FUNCTIONS ---------------
function html_from_template(key, data) {
    let html = html_templates[key];
    for (let [key, value] of Object.entries(data)) {
        if (!value) {
            value = "";
        } else if (value === true) {
            value = key;
        }
        html = html.replaceAll(`{${key.toUpperCase()}}`, value);
    }
    html = html.replaceAll(/\{[A-Z]+\}/g, "");
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
    document.documentElement.style.setProperty(property, value);
}

function forEachElement(elements, callback) {
    if (elements instanceof Node) {
        callback(elements);
        return;
    }
    for (const element of elements) {
        callback(element);
    }
}

function classIfElse(bool, elements, trueclass, falseclass = "") {
    if (!bool) {
        const temp = trueclass;
        trueclass = falseclass;
        falseclass = temp;
    }

    forEachElement(elements, elem => {
        if (falseclass.length > 0) {
            elem.classList.remove(...split_classes(falseclass));
        }
        if (trueclass.length > 0) {
            elem.classList.add(...split_classes(trueclass));
        }
    });
}

function addClass(elements, classes) {
    classIfElse(true, elements, classes);
}
function removeClass(elements, classes) {
    classIfElse(false, elements, classes);
}

function show(elements) {
    forEachElement(elements, elem => {
        elem.style.display = "";
    });
    removeClass(elements, "hidden");
}
function hide(elements) {
    forEachElement(elements, elem => {
        elem.style.display = "none";
    });
}

function split_classes(classstr) {
    if (!classstr) {
        return [];
    }
    return classstr.split(" ");
}

function nth_child(container, n) {
    children = container.children;
    if (n < 0) {
        return children[children.length + n];
    } else {
        return children[n];
    }
}

function capitalize(str) {
    if (typeof str !== "string") {
        str = String(str);
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function arange(start, stop = null, step = 1) {
    if (stop === null) {
        stop = start;
        start = 0;
    }

    return Array.from(
        {length: (stop - start) / step},
        (_, index) => start + index * step
    );
}

function objectMap(obj, fn) {
    return Object.fromEntries(
        Object.entries(obj).map(
            ([k, v], i) => [k, fn(v, k, i)]
        )
    );
}

function cloneObjectKeys(obj, keys) {
    const clone = {};
    for (const key of keys) {
        clone[key] = obj[key];
    }
    return clone;
}
