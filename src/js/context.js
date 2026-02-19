import {SettingsCollection, ValueElement, Slider, ButtonGroup} from "./settings/settings.js";
import {Game} from "./game/Game.js";
import {Dataset, DEFAULT_DATASET, TERMS} from "./dataset/Dataset.js";
import DATASETS_METADATA from '../json/datasets_meta.json';
import {DOMHelper, Base64Helper, ObjectHelper} from "./helpers/helpers.js";
import * as FontHelper from "./helpers/font";


/** @type {?Game} */
let GAME = null;

/** @type {?string} */
let DATASET_KEY = null;

/** @type {?Dataset} */
let DATASET = null;
/** @type {?SettingsCollection} */
let SC = null;

/** @type {?ItemSelector} */
let SELECTOR = null;

/** @type {?SettingsCollection} */
let PAGE_SC = null;


function genericSettings() {
    return SettingsCollection.createFrom({
        seed: ValueElement.createInput("text", "Seed (optional)", {id: "game-seed"})
    });
}

/**
 * @returns {Record<string,any>}
 */
function getCachedSettings() {
    const settingsJSON = window.localStorage.getItem(localStorageSettingsKey());
    if (!settingsJSON) return {};

    try {
        const settings = JSON.parse(settingsJSON);
        if (typeof settings.items === "string") {
            settings.items = Base64Helper.decodeBase64BoolArray(settings.items);
        }
        return settings;
    } catch (e) {
        console.error(e);
        return {};
    }
}

export function setup() {
    DOMHelper.updateDOM(() => {
        setupDatasetSelect();
        readFromSearchParams(false);
    }, {transition: true});

    setupButtonListeners();
    setupPageSettings();

    window.addEventListener("popstate", readFromSearchParams);
    window.addEventListener("resize", () => {
        if (SELECTOR) {
            SELECTOR.scaleButtons();
        }
    });
}

function setupButtonListeners() {
    document.getElementById("start-game-button").addEventListener("click", startGame);
    document.getElementById("stop-game-button").addEventListener("click", () => {
        GAME.finish();
    });
    document.getElementById("item-submit-button").addEventListener("click", () => {
        GAME.submitRound();
    });
    document.getElementById("item-next-button").addEventListener("click", () => {
        GAME.newRound();
    });
}

function setupDatasetSelect() {
    const select = document.getElementById("datasetSelect");
    DOMHelper.setOptions(
        select, ObjectHelper.map(DATASETS_METADATA, data => data.name)
    );

    select.addEventListener("change", (e) => {
        const key = e.target.value;
        Dataset.fromKey(key).then(dataset => {
            selectDataset(key, dataset);
        }).catch(console.error);
    });
}

function setupPageSettings() {
    PAGE_SC = SettingsCollection.createFrom({
        accentColor: getAccentHueSetting(),
        colorMode: getPageLightDarkModeSetting()
    });

    document.querySelector("#page-settings .settings").replaceChildren(...PAGE_SC.nodeList());

    document.getElementById("open-settings-button").addEventListener("click", () => {
        DOMHelper.updateDOM(showPageSettings, {types: ["page-settings", "ease-in"]});
    });
    document.getElementById("close-settings-button").addEventListener("click", () => {
        DOMHelper.updateDOM(hidePageSettings, {types: ["page-settings", "ease-out"]});
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
    setLightDarkMode(mode, {transition: false});

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
        setLightDarkMode(mode, {transition: false});
    });

    colorModeSetting.updateListeners.push(mode => setLightDarkMode(mode, {updateLocalStorage: true}));

    return colorModeSetting;
}

/**
 * @param {"dark" | "light"} mode
 * @param {boolean} [updateLocalStorage=false]
 * @param {boolean} [transition=true]
 */
function setLightDarkMode(mode, {updateLocalStorage = false, transition = true} = {}) {
    if (mode !== "dark" && mode !== "light") {
        throw new Error(`Invalid color mode ${mode}, use dark or light.`);
    }

    DOMHelper.updateDOM(() => {
        DOMHelper.classIfElse(mode === "dark", document.documentElement, "dark-mode", "light-mode");
    }, {transition: transition});

    if (updateLocalStorage) {
        window.localStorage.setItem("colorMode", mode);
    }
}

/**
 * @param key
 * @param {Dataset} dataset
 */
function selectDataset(key, dataset) {
    DATASET = dataset;
    DATASET_KEY = key;
    DOMHelper.setSearchParams({dataset: key});

    const cachedSettings = getCachedSettings();
    const gameHeading = DATASET.metadata.gameHeading;

    setupSelector(cachedSettings);
    setupSettingsCollection(cachedSettings);

    return DOMHelper.updateDOM(() => {
        setupTerms();

        FontHelper.loadFonts([
            DATASET.getFontFamily(gameHeading.font),
            DATASET.getSelectorDisplayFont()[0]
        ]).then(() => {
            DATASET.setupGameHeading(document.querySelector("#game-heading h1"));
            document.getElementById("game-filters").replaceChildren(SELECTOR.node);
            SELECTOR.scaleButtons();
            document.getElementById("game-settings").replaceChildren(...SC.nodeList());
        });

        DOMHelper.showPage(document.getElementById('game-filters'), {transition: false});
    }, {transition: true});
}

function setupTerms() {
    for (const term of TERMS) {
        const string = DATASET.metadata.terms[term];
        document.querySelectorAll('.term-' + term).forEach(elem => {
            elem.textContent = string;
        });
    }
}

function setupSelector(settings) {
    if (SELECTOR) {
        SELECTOR.removeListeners();
    }
    SELECTOR = DATASET.getItemSelector();
    SELECTOR.setup(settings.items, settings.forms, DATASET_KEY);
    SELECTOR.updateListeners.push(
        checkPagesNextButton,
        saveSettings
    );
    checkPagesNextButton();
}

function checkPagesNextButton() {
    DOMHelper.setAttrs(
        document.querySelector('.pages-next-button'),
        {disabled: SELECTOR.activeQuizItemCount() === 0}
    );
}

function setupSettingsCollection(settings) {
    SC = DATASET.getSettings(settings.properties, settings.language);
    SC.extend(genericSettings());

    for (const key of ["language"]) {
        const singleButton = SC.getSetting(key).buttonCount() === 1;
        if (singleButton) {
            DOMHelper.hide(SC.getNode(key));
        }
        DOMHelper.classIfElse(singleButton, SC.getNode(key), "hidden");
    }

    SC.getSetting("properties").disableIfSingleButton(true);

    SC.addUpdateListener(() => {
        saveSettings();
    });
}

function localStorageSettingsKey(datasetKey = DATASET_KEY) {
    return "settings_" + datasetKey;
}

function saveSettings() {
    DOMHelper.setSearchParams({dataset: DATASET_KEY});

    window.localStorage.setItem(localStorageSettingsKey(), JSON.stringify({
        items: Base64Helper.encodeBase64BoolArray(SELECTOR.itemsActive),
        forms: SELECTOR.activeForms(),
        properties: SC.getValue("properties"),
        language: SC.getValue("language")
    }));
}

function startGame(transition) {
    if (GAME) {
        GAME.cleanup();
    }

    saveSettings();

    const properties = SC.getValue("properties");
    const language = SC.getValue("language");
    const items = DATASET.getQuizItems(
        SELECTOR.activeIndices(),
        SELECTOR.activeForms(),
        properties,
        language
    );
    const referenceItems = DATASET.getReferenceItems(properties, language);

    GAME = new Game(DATASET, items, properties, language);

    const seed = SC.getValue("seed");
    if (seed) {
        GAME.seed(seed);
    }

    GAME.setReferenceItems(referenceItems);
    GAME.onFinish.push(() => {
        setPlaying(false);
    });

    GAME.setup().then(() => {
        GAME.newRound();
        setPlaying(true, transition);
        GAME.focus();
    }, err => console.error(err));
}

/**
 * @param {boolean} playing
 * @param {boolean} transition
 */
function setPlaying(playing, transition = true) {
    DOMHelper.updateDOM(() => _setPlaying(playing), {transition: transition});
}

function _setPlaying(playing) {
    if (!playing) {
        DOMHelper.showPage(document.getElementById('game-filters'), {transition: false});
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

function readFromSearchParams(transition = true) {
    const searchParams = new URLSearchParams(location.search);
    const datasetKey = searchParams.get("dataset") ?? DEFAULT_DATASET;
    document.getElementById("datasetSelect").value = datasetKey;

    Dataset.fromKey(datasetKey).then(dataset => {
        selectDataset(datasetKey, dataset);

        if (["1", "true"].includes(searchParams.get("play"))) {
            startGame(transition);
        } else {
            setPlaying(false, transition);
        }
    });
}
