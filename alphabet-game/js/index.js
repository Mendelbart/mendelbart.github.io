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

    dataset = await fetch(datasets_metadata[key].file).then(response => response.json());
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
        const [groupKeys, propertyKeys, settings, valid] = get_game_settings();
        if (valid) {
            new_game(datasetSelect.value, groupKeys, propertyKeys, settings, true);
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
    document.getElementById("restart-game-button").addEventListener("click", () => {
        set_url_play(true);
        execute_url_settings();
    });
    document.querySelectorAll(".current-score").forEach(elem => {
        elem.addEventListener("click", () => {
            game.settings.scoreStringMode = game.settings.scoreStringMode == "percent" ? "ratio" : "percent";
            game.display_score();
        });
    });
    window.addEventListener("popstate", () => {
        execute_url_settings();
    });

    const allfonts = await fetch("./json/fonts.json").then(response => response.json());

    execute_url_settings();

    function set_settings(datasetKey, groupKeys, propertyKeys, settings) {
        datasetSelect.value = datasetKey;
        select_dataset(datasetKey);
        set_button_group_values("groupsButtons", groupKeys);
        set_button_group_values("propertiesButtons", propertyKeys);
        if ("symbolsOrder" in settings) {
            set_button_group_values("orderButtons", settings.symbolsOrder);
        }
        if ("maxTries" in settings) {
            set_button_group_values("triesButtons", settings.maxTries);
        }
        if ("removeCleared" in settings) {
            document.getElementById("removeClearedSwitch").checked = settings.removeCleared;
        }
    }

    function execute_url_settings() {
        if (!url_settings_exist()) {
            select_dataset(datasetSelect.value);
            hide(document.getElementById("game-stats-container"));
            toggle_dialogue(true);
            return;
        }
        
        const [datasetKey, groupKeys, propertyKeys, settings, play] = parse_settings_from_url();
        set_settings(datasetKey, groupKeys, propertyKeys, settings);

        if (play) {
            new_game(datasetKey, groupKeys, propertyKeys, settings, false);
        } else {
            hide(document.getElementById("game-stats-container"));
            toggle_dialogue(true);
        }
    }

    async function new_game(datasetKey, groupKeys, propertyKeys, settings, write_to_url) {
        if (game) {
            game.cleanup();
        }

        const dataset = await get_dataset(datasetKey);

        set_dataset_terms(document.getElementById("game-container"), dataset, true);
        set_dataset_terms(document.getElementById("game-stats-container"), dataset, true);
    
        game = create_game_instance(dataset, groupKeys, propertyKeys, settings);
        game_input_listeners(game);

        setup_font_buttons(dataset.fonts, allfonts);

        toggle_dialogue(false, false);
        game.new_round();

        show(document.getElementById("game-stats-container"));
        // document.querySelector("#score-display .score-label").innerText = "Current Score:";
        show(document.getElementById("resume-game-button"));
        hide(document.getElementById("restart-game-button"));

        if (write_to_url) {
            write_settings_to_url(datasetKey, groupKeys, propertyKeys, settings, true);
        }
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
            elem.innerText = dataset.symbolTermPlural;
        });
        container.querySelectorAll(".symbol-term").forEach(elem => {
            elem.innerText = dataset.symbolTerm;
        });
        if (setGameName) {
            container.querySelectorAll(".game-name").forEach(elem => {
                let fontFamily = null;
                if (dataset.gameNameFont) {
                    fontFamily = allfonts[dataset.gameNameFont].family;
                }
                gameNameScale = dataset.gameNameScale ? dataset.gameNameScale : 1;
                set_global_css_var("--game-name-scale", gameNameScale);
                setup_gamename_heading(elem, dataset.gameName, fontFamily);
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

function url_settings_exist() {
    const params = new URLSearchParams(window.location.search);
    return params.has("dataset") && params.has("groups") && params.has("properties");
}

function write_settings_to_url(datasetKey, groupKeys, propertyKeys, settings, play) {
    const url = new URL(location);

    url.searchParams.set("dataset", datasetKey);
    url.searchParams.set("groups", groupKeys);
    url.searchParams.set("properties", propertyKeys);
    for (const [key, value] of Object.entries(settings)) {
        url.searchParams.set(key, value);
    }
    url.searchParams.set("play", play);

    update_url(url);
}

function update_url(url) {
    history.pushState({}, "", url);
};

function parse_settings_from_url() {
    const params = new URLSearchParams(window.location.search);

    const datasetKey =  params.get("dataset"); 
    const groupKeys = params.get("groups").split(",");
    const propertyKeys = params.get("properties").split(",");

    const settings = {};
    for (const [key, default_value] of Object.entries(Game.defaultSettings)) {
        if (params.has(key)) {
            settings[key] = match_type(params.get(key), default_value);
        }
    }
    const play = match_type(params.get("play"), true);

    return [datasetKey, groupKeys, propertyKeys, settings, play];
}

function match_type(str, matched) {
    if (Array.isArray(matched)) {
        return str.split(",");
    } else if (typeof matched === "boolean") {
        return str === "true" || str === "1";
    } else if (typeof matched === "number") {
        return Number(str);
    } else if (typeof matched === "string") {
        return String(str);
    }

    return str;
}

function toggle_dialogue(show_dialogue, update_url_play = true) {
    toggle_shown(
        show_dialogue,
        document.getElementById("game-dialogue"),
        document.getElementById("game-container")
    );

    if (update_url_play) {
        set_url_play(!show_dialogue);
    }
}

function set_url_play(play) {
    const url = new URL(location);
    if (!url.searchParams.has("play") || play !== match_type(url.searchParams.get("play"), play)) {
        url.searchParams.set("play", play);
        update_url(url);
    }
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

    return [groupKeys, propertyKeys, settings, valid];
}

function create_game_instance(dataset, groupKeys, propertyKeys, settings) {
    const inputs = create_game_inputs(dataset.properties, propertyKeys);
    const gameProperties = cloneObjectKeys(dataset.properties, propertyKeys);
    const symbols = get_active_symbols(dataset, groupKeys);
    const guessedDisplaySymbols = {
        matchTo: dataset.matchEnteredSymbols.matchTo,
        symbols: guessed_display_symbols(dataset),
    }

    const onFinish = () => {
        toggle_dialogue(true);
        hide(document.getElementById("resume-game-button"));
        show(document.getElementById("restart-game-button"));
        // document.querySelector("#score-display .score-label").innerText = "Final Score:";
    };

    return game = new Game(inputs, symbols, gameProperties, guessedDisplaySymbols, onFinish, settings);
}

function create_game_inputs(properties, keys = null) {
    if (!keys) {
        keys = Object.keys(properties);
    }

    const inputs = {};
    const inputsContainer = document.getElementById("game-inputs");

    for (const key of keys) {
        const html = html_from_template("inputRow", {placeholder: properties[key].displayname});
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


function get_active_symbols(dataset, groupKeys) {
    const symbols = {};
    for (const groupkey of groupKeys) {
        for (const [key, symbol] of Object.entries(dataset.groups[groupkey].symbols)) {
            symbols[key + "_" + groupkey] = symbol;
        }
    }
    return symbols;
}

function guessed_display_symbols(dataset) {
    const symbols = {};
    for (const groupkey of dataset.matchEnteredSymbols.fromGroups) {
        for (const symbol of Object.values(dataset.groups[groupkey].symbols)) {
            let keys = symbol[dataset.matchEnteredSymbols.matchTo];
            if (!Array.isArray(keys)) {
                keys = [keys];
            }
            for (let key of keys) {
                key = key.toLowerCase();
                if (key in symbols) {
                    symbols[key] += symbol.string;
                } else {
                    symbols[key] = symbol.string;
                }
            }
        }
    }
    return symbols;
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
    for (const [value, displayname] of Object.entries(data)) {
        html += html_from_template("option", {
            value: value,
            displayname: displayname,
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
    for (const [i, [value, displayname]] of Object.entries(Object.entries(data))) {
        html += html_from_template("button", {
            type: type,
            class: btnclass,
            name: idprefix,
            id: idprefix + i,
            value: value,
            displayname: displayname,
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
        objectMap(dataset.groups, group => group.displayname),
        "checkbox", "group-button", "groupButton", checked, disabled
    );
    groupsButtons.querySelectorAll(".group-button").forEach(elem => {
        elem.addEventListener("change", () => {
            update_symbolcount(dataset);
        });
    });
    update_symbolcount(dataset);
}

function get_active_symbolcount(dataset) {
    let count = 0;
    groupsButtons.querySelectorAll(".group-button").forEach(elem => {
        if (elem.checked) {
            count += Object.keys(dataset.groups[elem.value].symbols).length;
        }
    });
    return count;
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
        objectMap(dataset.properties, property => property.displayname),
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

    fontNames = objectMap(fonts_dict, font => font.displayname);

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
