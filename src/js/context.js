import {SettingCollection, Slider, ButtonGroup} from "./settings/settings.js";
import {Game} from "./game/Game.js";
import {Dataset, DEFAULT_DATASET, TERMS} from "./dataset/Dataset.js";
import DATASETS_METADATA from '../json/datasets_meta.json';
import {DOMHelper, Base64Helper, ObjectHelper} from "./helpers/helpers.js";
import * as FontHelper from "./helpers/font";


/** @type {?Game} */
let GAME = null;

/** @type {?Dataset} */
let DATASET = null;

let SELECTOR_SETTINGS = new SettingCollection();
let DATASET_GAME_SETTINGS = new SettingCollection();
let GENERIC_GAME_SETTINGS = new SettingCollection();

/** @type {?ItemSelector} */
let SELECTOR = null;

/** @type {?SettingCollection} */
let PAGE_SETTINGS = null;



/******************** SETUP ***********************/

export function setup() {
    setupButtonListeners();
    setupPageSettings();

    GENERIC_GAME_SETTINGS.replaceSelf(Game.genericSettings());
    document.getElementById("generic-game-settings").append(...GENERIC_GAME_SETTINGS.nodeList());

    window.addEventListener("popstate", () => DOMHelper.transition(readFromSearchParams));

    setupDatasetSelect();
    readFromSearchParams(false);
}

function setupButtonListeners() {
    document.getElementById("start-game-button").addEventListener("click", () => DOMHelper.transition(startGame));
    document.getElementById("stop-game-button").addEventListener("click", () => {
        GAME.finish();
    });
    document.getElementById("item-submit-button").addEventListener("click", () => {
        DOMHelper.transition(() => {
            GAME.submitRound();
        }, ["game"]);
    });
    document.getElementById("item-next-button").addEventListener("click", () => {
        DOMHelper.transition(() => {
            GAME.newRound();
        }, ["game"]);
    });
}

function setupDatasetSelect() {
    const select = document.getElementById("datasetSelect");
    DOMHelper.setOptions(
        select, ObjectHelper.map(DATASETS_METADATA, data => data.name)
    );

    select.addEventListener("change", (e) => {
        const key = e.target.value;
        Dataset.fetch(key).then(dataset => DOMHelper.transition(() => selectDataset(dataset))).catch(console.error);
    });
}


/**
 * @param {boolean} playing
 */
function setPlaying(playing) {
    if (!playing) {
        DOMHelper.showPage(document.getElementById('game-filters'));
    }

    DOMHelper.toggleShown(playing,
        [
            document.getElementById('game-container'),
            document.getElementById('stop-game-button'),
            document.getElementById('progress-bar')
        ],
        [
            document.getElementById('new-game-settings')
        ]
    );
}


/***************************** PAGE SETTINGS ************************/

function setupPageSettings() {
    PAGE_SETTINGS = SettingCollection.createFrom({
        accentColor: getAccentHueSetting(),
        colorMode: getPageLightDarkModeSetting()
    });

    document.querySelector("#page-settings .settings").replaceChildren(...PAGE_SETTINGS.nodeList());

    document.getElementById("open-settings-button").addEventListener("click", () => {
        DOMHelper.transition(showPageSettings, ["page-settings", "ease-in"]);
    });
    document.getElementById("close-settings-button").addEventListener("click", () => {
        DOMHelper.transition(hidePageSettings, ["page-settings", "ease-out"]);
    });
}

function showPageSettings() {
    DOMHelper.show(document.getElementById("page-settings-container"));
    document.documentElement.style.overflowY = "hidden";
}

function hidePageSettings() {
    DOMHelper.hide(document.getElementById("page-settings-container"));
    document.documentElement.style.removeProperty("overflow-y");
}


function getAccentHueSetting() {
    const hue = window.localStorage.getItem("accentHue") || 250;
    setAccentHue(hue);
    const slider = Slider.create(0, 360, hue);
    slider.label("Accent Hue");
    slider.updateListeners.push(hue => setAccentHue(hue));
    slider.node.id = "accentHueSlider";
    return slider;
}

function setAccentHue(hue) {
    document.documentElement.style.setProperty("--accent-hue", hue);
    window.localStorage.setItem("accentHue", hue);
}


function getPageLightDarkModeSetting() {
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const mode = window.localStorage.getItem("colorMode") || (colorSchemeQuery.matches ? "dark" : "light");
    setLightDarkMode(mode);

    const colorModeSetting = ButtonGroup.from(
        {
            dark: "Dark Mode",
            light: "Light Mode"
        },
        {
            label: "Color Mode",
            exclusive: true,
            checked: mode
        });

    colorSchemeQuery.addEventListener("change", event => {
        const mode = event.matches ? "dark" : "light"
        colorModeSetting.value = [mode];
        setLightDarkMode(mode);
    });

    colorModeSetting.updateListeners.push(mode => DOMHelper.transition(
        () => setLightDarkMode(mode, {updateLocalStorage: true})
    ));

    return colorModeSetting;
}

/**
 * @param {"dark" | "light"} mode
 * @param {boolean} [updateLocalStorage=false]
 */
function setLightDarkMode(mode, {updateLocalStorage = false} = {}) {
    if (mode !== "dark" && mode !== "light") {
        throw new Error(`Invalid color mode ${mode}, use dark or light.`);
    }

    DOMHelper.classIfElse(mode === "dark", document.documentElement, "dark-mode", "light-mode");

    if (updateLocalStorage) {
        window.localStorage.setItem("colorMode", mode);
    }
}




/************************************ SELECTOR ********************************/
/**
 * @param {Dataset} dataset
 */
function selectDataset(dataset) {
    DATASET = dataset;
    DOMHelper.setSearchParams({dataset: dataset.key});
    updateDocumentTitle();

    const cachedSettings = getCachedSettings();
    const gameHeading = DATASET.metadata.gameHeading;

    return FontHelper.loadFonts([
        DATASET.getFont(gameHeading.font),
        DATASET.getSelectorDisplayFont()
    ]).then(() => {
        setupTerms();

        DOMHelper.showPage(document.getElementById('game-filters'));

        DATASET.setupGameHeading(document.querySelector("#game-heading h1"));
        setupSettingsCollections(cachedSettings);
        setupSelector(cachedSettings);
    });
}

function updateDocumentTitle() {
    document.title = DATASET ? `${DATASET.name} - Kadmos` : "Kadmos";
}

function setupTerms() {
    for (const term of TERMS) {
        const string = DATASET.metadata.terms[term];
        document.querySelectorAll('.term-' + term).forEach(elem => {
            elem.textContent = string;
        });
    }
}

function setupSelector(settings = {}) {
    if (SELECTOR) {
        SELECTOR.removeListeners();
        SELECTOR.node.remove();
    }
    const node = DOMHelper.createElement("div.item-selector");
    document.getElementById('dataset-filter-settings').append(node);
    SELECTOR = DATASET.getItemSelector(node);

    if (settings.items) {
        SELECTOR.setActive(settings.items);
    }
    SELECTOR.setActiveForms(getActiveForms(), {scale: false});
    if (DATASET.hasVariantSetting()) {
        DATASET.applyVariant(SELECTOR_SETTINGS.getValue("variant"), SELECTOR);
    }

    SELECTOR.updateListeners.push(
        checkPagesNextButton,
        saveSettings
    );

    checkPagesNextButton();
}

function setupSettingsCollections(settings) {
    SELECTOR_SETTINGS.replaceSelf(DATASET.getFilterSettings(settings));
    DATASET_GAME_SETTINGS.replaceSelf(DATASET.getGameSettings(settings));

    SELECTOR_SETTINGS.addUpdateListener(saveSettings);
    DATASET_GAME_SETTINGS.addUpdateListener(saveSettings);

    if (DATASET.hasFormsSetting()) {
        SELECTOR_SETTINGS.addUpdateListener("forms", forms => DOMHelper.transition(() => {
            DATASET.applyFormsSetting(forms, SELECTOR);
        }, ["selector-forms"]));
    }

    if (DATASET.hasVariantSetting()) {
        SELECTOR_SETTINGS.addUpdateListener("variant", variant => DOMHelper.transition(() => {
            DATASET.applyVariant(variant, SELECTOR);
        }));
    }

    document.getElementById("dataset-filter-settings").replaceChildren(...SELECTOR_SETTINGS.nodeList());
    document.getElementById("dataset-game-settings").replaceChildren(...DATASET_GAME_SETTINGS.nodeList());
}

function getActiveForms() {
    if (!DATASET.hasFormsSetting()) {
        return DATASET.formsData.keys;
    }
    return DATASET.getFormsFromSettingsValue(SELECTOR_SETTINGS.getValue("forms"));
}

function getActiveProperties() {
    return DATASET_GAME_SETTINGS.getDefault("properties", Object.keys(DATASET.propsData));
}

function checkPagesNextButton() {
    document.querySelector('#game-settings-pages .pages-next-button').disabled = SELECTOR.activeQuizItemCount() === 0;
}


/***************************************** GAME *******************************/
function startGame() {
    if (GAME) {
        GAME.cleanup();
    }

    saveSettings();

    const properties = getActiveProperties();
    const language = DATASET_GAME_SETTINGS.getDefault("language", null);
    const items = DATASET.getQuizItems(
        SELECTOR.activeIndices(),
        getActiveForms(),
        properties,
        language
    );
    const referenceItems = DATASET.getReferenceItems(properties, language);

    GAME = new Game(DATASET, items, properties, language);

    const seed = GENERIC_GAME_SETTINGS.getValue("seed");
    if (seed) {
        GAME.seed(seed);
    }

    GAME.setReferenceItems(referenceItems);
    GAME.onFinish.push(() => {
        setPlaying(false);
    });

    GAME.setup().then(() => {
        setPlaying(true);
        GAME.newRound();
        GAME.focus();
    }).catch(err => console.error(err));
}



/************************** STORAGE ***************************/
function readFromSearchParams() {
    const searchParams = new URLSearchParams(location.search);
    let datasetKey = searchParams.get("dataset");
    if (!datasetKey || !(datasetKey in DATASETS_METADATA)) {
        datasetKey = DEFAULT_DATASET;
    }
    document.getElementById("datasetSelect").value = datasetKey;

    Dataset.fetch(datasetKey).then(
        dataset => selectDataset(dataset)
    ).then(() => {
        if (["1", "true"].includes(searchParams.get("play"))) {
            startGame();
        } else {
            setPlaying(false);
        }
    });
}

/**
 * @param {string?} datasetKey
 * @returns {string}
 */
function localStorageSettingsKey(datasetKey = null) {
    return "settings_" + (datasetKey || DATASET.key);
}

function saveSettings() {
    DOMHelper.setSearchParams({dataset: DATASET.key});

    const data = Object.assign(
        {items: Base64Helper.encodeBase64BoolArray(SELECTOR.itemsActive)},
        SELECTOR_SETTINGS.getValues(),
        DATASET_GAME_SETTINGS.getValues()
    );

    window.localStorage.setItem(localStorageSettingsKey(), JSON.stringify(data));
}

/**
 * @returns {Record<string,any>}
 */
function getCachedSettings() {
    const settingsJSON = window.localStorage.getItem(localStorageSettingsKey());
    if (!settingsJSON) return {};

    try {
        const settings = JSON.parse(settingsJSON);
        settings.items = Base64Helper.decodeBase64BoolArray(settings.items);
        return settings;
    } catch (e) {
        console.error(e);
        return {};
    }
}
