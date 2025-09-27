import {Game} from "./Game.js";
import {Dataset, DATASETS_METADATA, DEFAULT_DATASET} from "./Dataset.js";
import {DOMHelper, ObjectHelper} from "./helpers.js";

// --------------- CONSTANTS -----------------
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
            span.textContent = elem.value;
        }
        elem.addEventListener("input", update_elem);
        update_elem();
    });

    // update fontWeightrange
    const fontWeightRange = document.getElementById("fontWeightRange");
    const update_font_weight = () => {
        DOMHelper.setCSS({'symbol-font-weight': fontWeightRange.value});
    } 
    fontWeightRange.addEventListener("input", update_font_weight);
    update_font_weight();
})();


// --------------- GAME SETUP -----------------
(async function() {
    let game = null;

    DOMHelper.setOptions(
        datasetSelect,
        ObjectHelper.map(DATASETS_METADATA, data => data.name),
        DEFAULT_DATASET
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
        DOMHelper.hide(document.getElementById("game-stats-container"));
        toggle_dialogue(true);
    });
    document.getElementById("resume-game-button").addEventListener("click", () => {
        toggle_dialogue(false);
        game.resume();
        game.focus();
    });
    document.querySelectorAll("#current-time, #current-time-alt").forEach(elem => {
        elem.addEventListener("click", () => {
            DOMHelper.toggleShown(
                elem.id === "current-time",
                document.getElementById("current-time-alt"),
                document.getElementById("current-time")
            );
        });
    });
    document.querySelectorAll(".current-score").forEach(elem => {
        elem.addEventListener("click", () => {
            game.settings.scoreStringMode = game.settings.scoreStringMode === "percent" ? "ratio" : "percent";
            game.display_score();
        });
    });

    const allfonts = await fetch("./json/fonts.json").then(response => response.json());

    await select_dataset(datasetSelect.value);
    DOMHelper.hide(document.getElementById("game-stats-container"));
    toggle_dialogue(true);

    async function new_game(datasetKey, groupKeys, propertyKeys, settings, seed) {
        if (game) {
            game.cleanup();
        }

        const dataset = await Dataset.fromKey(datasetKey);

        set_dataset_terms(document.getElementById("game-container"), dataset, true);
        set_dataset_terms(document.getElementById("game-stats-container"), dataset, true);
    
        game = create_game_instance(dataset, groupKeys, propertyKeys, settings, seed);
        game_input_listeners(game);

        setup_font_buttons(dataset.fonts, allfonts);

        toggle_dialogue(false);

        game.new_round();

        DOMHelper.show(document.getElementById("game-stats-container"));
        // document.querySelector("#score-display .score-label").textContent = "Current Score:";
        DOMHelper.show(document.getElementById("resume-game-button"));
    }

    function game_input_listeners(game) {
        const input_keys = Object.keys(game.inputs);
        for (const [i, key] of input_keys.entries()) {
            const input = game.inputs[key];
            if (i === input_keys.length - 1) {
                // Submit if it's the last input
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        game.submit_round();
                    }
                });
            } else {
                // Focus on next input on Enter
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.target.nextGameInput.focus();
                    }
                });
            }

            // Focus on previous input on Backspace if current was empty.
            if (i > 0) {
                input.addEventListener("keydown", event => {
                    if (event.key === "Backspace" && event.target.value === "") {
                        event.target.previousGameInput.focus();
                        event.preventDefault();
                    }
                });
            }
        }
    }

    async function select_dataset(dataset_key) {
        const dataset = await Dataset.fromKey(dataset_key);
        setup_properties_buttons(dataset, true);
        setup_groups_buttons(dataset, true);
    
        set_dataset_terms(
            document.getElementById("new-game-settings"),
            dataset
        )
    }

    function set_dataset_terms(container, dataset, setGameName = false) {
        container.querySelectorAll(".symbol-term-plural").forEach(elem => {
            elem.textContent = dataset.terms.symbols;
        });
        container.querySelectorAll(".symbol-term").forEach(elem => {
            elem.textContent = dataset.terms.symbol;
        });
        if (setGameName) {
            container.querySelectorAll(".game-name").forEach(elem => {
                let fontFamily = null;
                if (dataset.gameName.font) {
                    fontFamily = allfonts[dataset.gameName.font].family;
                }
                const gameNameScale = dataset.gameName.scale ? dataset.gameName.scale : 1;
                DOMHelper.setCSS({"--game-name-scale": gameNameScale});
                setup_gamename_heading(elem, dataset.gameName.string, fontFamily);
            });
        
            DOMHelper.classIfElse(
                dataset.rtl ?? false,
                container.getElementsByClassName("game-name-heading"),
                "rtl"
            );
        }
    }
})();

function toggle_dialogue(show_dialogue) {
    DOMHelper.toggleShown(
        show_dialogue,
        document.getElementById("game-dialogue"),
        document.getElementById("game-container")
    );
}

function get_game_settings() {
    const settings = {};
    let valid = true;

    DOMHelper.removeClass(document.getElementsByClassName("invalid-setting"), "invalid-setting");

    const groupKeys = get_button_group_values("groupsButtons");
    if (groupKeys.length === 0) {
        document.getElementById("groupsButtons").parentElement.classList.add("invalid-setting");
        valid = false;
    }

    const propertyKeys = get_button_group_values("propertiesButtons");
    if (propertyKeys.length === 0) {
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
        DOMHelper.hide(document.getElementById("resume-game-button"));
    };

    return new Game(inputs, dataset, symbolKeys, gameProperties, onFinish, settings, seed);
}

function create_game_inputs(properties) {
    const inputs = {};
    const inputsContainer = document.getElementById("game-inputs");

    const keys = Object.keys(properties);

    for (const [i, key] of keys.entries()) {
        const row = inputRow(properties[key].displayName);
        inputsContainer.append(...row);

        const input = row[0];
        inputs[key] = input;

        // Prevent Auto Scroll on phones
        input.addEventListener("focus", (e) => {
            e.preventDefault();
            e.target.focus({preventScroll: true});
        });
        if (i > 0) {
            input.previousGameInput = inputs[keys[i - 1]];
            inputs[keys[i - 1]].nextGameInput = input;
        }
    }

    return inputs;
}

/**
 *
 * @param {string} displayName
 * @returns {Element[]}
 */
function inputRow(displayName) {
    const row = Array.from(DOMHelper.getTemplate("inputRow").children);
    const input = row[0];
    input.placeholder = displayName;
    input.addEventListener("focus", (e) => {
        e.preventDefault();
        e.target.focus({preventScroll: true});
    });
    return row;
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
    element.dataset.gameNameIndex = "0";
    element.style.fontFamily = fontFamily;
    
    if (typeof gameName === "string") {
        element.textContent = gameName;
        element.onmousedown = null;
    } else { // gameName is Array
        element.textContent = gameName[0];
        element.onmousedown = () => {
            let index = Number(element.dataset.gameNameIndex) + 1;
            if (index === gameName.length) {
                index = 0;
            }
            element.dataset.gameNameIndex = index.toString();
            element.textContent = gameName[index];
        };
    }
}


// --------------- GAME SETUP FUNCTIONS -----------------
function update_font(font) {
    DOMHelper.setCSS({
        "--symbol-font-family": font.family,
        "--symbol-shift": font.shift ? font.shift + "em" : 0,
        "--symbol-font-scale": font.scale ? font.scale : 1
    });
    const range = document.getElementById("fontWeightRange");
    range.value = font.weight ? font.weight : 400;
    range.dispatchEvent(new Event('input', {
        bubbles: true,
    }));
}

function setup_groups_buttons(dataset, checked, disabled) {
    DOMHelper.buttonGroup(dataset.groups, {
        type: "checkbox",
        name: "group-button",
        checked: checked,
        disabled: disabled,
        container: groupsButtons
    });
    groupsButtons.querySelectorAll("input").forEach(elem => {
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
    document.getElementById("totalSymbolCount").textContent = get_active_symbolcount(dataset);
}

function setup_properties_buttons(dataset, checked = null, disabled = null) {
    DOMHelper.buttonGroup(ObjectHelper.map(dataset.properties, property => property.displayName), {
        type: "checkbox",
        name: "property-button",
        checked: checked,
        disabled: disabled,
        container: document.getElementById("propertiesButtons"),
    });
}

function setup_font_buttons(fonts, allfonts, checked = null) {
    if (!checked) {
        checked = fonts[0].key;
    }

    const fonts_dict = {};
    for (const font of fonts) {
        fonts_dict[font.key] = Object.assign({}, allfonts[font.key], font);
    }

    const fontNames = ObjectHelper.map(fonts_dict, font => font.displayName);

    DOMHelper.buttonGroup(fontNames, {
        type: "radio",
        name: "font-button",
        checked: checked,
        container: document.getElementById("fontButtons")
    });

    document.querySelectorAll("#fontButtons input").forEach(elem => {
        elem.addEventListener("change", (e) => {
            update_font(fonts_dict[e.target.value]);
        });
        if (elem.checked) {
            update_font(fonts_dict[elem.value]);
        }
    });
}
