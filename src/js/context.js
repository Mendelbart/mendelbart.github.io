import {SettingsCollection, Slider, ButtonGroup} from "./settings/settings.js";
import {Game} from "./game/Game.js";
import {Dataset, DEFAULT_DATASET, TERMS} from "./dataset/Dataset.js";
import DATASETS_METADATA from '../json/datasets_meta.json';
import {DOMHelper, Base64Helper, ObjectHelper} from "./helpers/helpers.js";
import * as FontHelper from "./helpers/font";


/** @type {?Game} */
let GAME = null;

/** @type {?Dataset} */
let DATASET = null;

let FILTER_SC = new SettingsCollection();
let DATASET_GAME_SC = new SettingsCollection();
let GENERIC_GAME_SC = new SettingsCollection();

/** @type {?ItemSelector} */
let SELECTOR = null;

/** @type {?SettingsCollection} */
let PAGE_SC = null;



/******************** SETUP ***********************/

export function setup() {
    setupButtonListeners();
    setupPageSettings();

    GENERIC_GAME_SC.replaceSelf(Game.genericSettings());
    document.getElementById("generic-game-settings").append(...GENERIC_GAME_SC.nodeList());

    window.addEventListener("popstate", readFromSearchParams);

    return DOMHelper.updateDOM(() => {
        setupDatasetSelect();
        readFromSearchParams(false);
    }, {transition: true});
}

function setupButtonListeners() {
    document.getElementById("start-game-button").addEventListener("click", startGame);
    document.getElementById("stop-game-button").addEventListener("click", () => {
        GAME.finish();
    });
    document.getElementById("item-submit-button").addEventListener("click", () => {
        DOMHelper.updateDOM(() => {
            GAME.submitRound();
        }, {types: ["game"]});
    });
    document.getElementById("item-next-button").addEventListener("click", () => {
        DOMHelper.updateDOM(() => {
            GAME.newRound();
        }, {types: ["game"]});
    });
}

function setupDatasetSelect() {
    const select = document.getElementById("datasetSelect");
    DOMHelper.setOptions(
        select, ObjectHelper.map(DATASETS_METADATA, data => data.name)
    );

    select.addEventListener("change", (e) => {
        const key = e.target.value;
        Dataset.fetch(key).then(dataset => selectDataset(dataset)).catch(console.error);
    });
}


/**
 * @param {boolean} playing
 * @param {boolean} transition
 */
function setPlaying(playing, {transition = true} = {}) {
    return DOMHelper.updateDOM(() => {
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
    }, {transition: transition});
}


/***************************** PAGE SETTINGS ************************/

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




/************************************ SELECTOR ********************************/
/**
 * @param {Dataset} dataset
 * @param {boolean} [transition=true]
 */
function selectDataset(dataset, {transition = true} = {}) {
    DATASET = dataset;
    DOMHelper.setSearchParams({dataset: dataset.key});

    const cachedSettings = getCachedSettings();
    const gameHeading = DATASET.metadata.gameHeading;

    return FontHelper.loadFonts([
        DATASET.getFontFamily(gameHeading.font),
        DATASET.getSelectorDisplayFont()[0]
    ]).then(() => DOMHelper.updateDOM(() => {
        setupTerms();

        DOMHelper.showPage(document.getElementById('game-filters'), {transition: false});

        DATASET.setupGameHeading(document.querySelector("#game-heading h1"));
        setupSettingsCollections(cachedSettings);
        setupSelector(cachedSettings);
    }, {transition: transition}));
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
    void SELECTOR.setActiveForms(getActiveForms(), {transition: false, scale: false});
    if (DATASET.hasVariantSetting()) {
        void SELECTOR.setItemIndices(DATASET.getVariantItemIndices(FILTER_SC.getValue("variant")), {transition: false});
    }

    SELECTOR.updateListeners.push(
        checkPagesNextButton,
        saveSettings
    );

    checkPagesNextButton();
}

function setupSettingsCollections(settings) {
    FILTER_SC.replaceSelf(DATASET.getFilterSettings(settings));
    DATASET_GAME_SC.replaceSelf(DATASET.getGameSettings(settings));

    FILTER_SC.addUpdateListener(saveSettings);
    DATASET_GAME_SC.addUpdateListener(saveSettings);

    if (DATASET.hasFormsSetting()) {
        FILTER_SC.getSetting("forms").updateListeners.push(value => SELECTOR.setActiveForms(DATASET.getFormsFromSettingsValue(value)));
    }

    if (DATASET.hasVariantSetting()) {
        FILTER_SC.getSetting("variant").updateListeners.push(value => SELECTOR.setItemIndices(DATASET.getVariantItemIndices(value)));
    }

    document.getElementById("dataset-filter-settings").replaceChildren(...FILTER_SC.nodeList());
    document.getElementById("dataset-game-settings").replaceChildren(...DATASET_GAME_SC.nodeList());
}

function getActiveForms() {
    if (!DATASET.hasFormsSetting()) {
        return DATASET.formsData.keys;
    }
    return DATASET.getFormsFromSettingsValue(FILTER_SC.getValue("forms"));
}

function getActiveProperties() {
    return DATASET.hasPropsSetting() ? DATASET_GAME_SC.getValue("properties") : Object.keys(DATASET.propsData);
}

function checkPagesNextButton() {
    DOMHelper.setAttrs(
        document.querySelector('.pages-next-button'),
        {disabled: SELECTOR.activeQuizItemCount() === 0}
    );
}


/***************************************** GAME *******************************/
function startGame(transition) {
    if (GAME) {
        GAME.cleanup();
    }

    saveSettings();

    const properties = getActiveProperties();
    const language = DATASET.hasLanguageSetting() ? DATASET_GAME_SC.getValue("language") : null;
    const items = DATASET.getQuizItems(
        SELECTOR.activeIndices(),
        getActiveForms(),
        properties,
        language
    );
    const referenceItems = DATASET.getReferenceItems(properties, language);

    GAME = new Game(DATASET, items, properties, language);

    const seed = GENERIC_GAME_SC.getValue("seed");
    if (seed) {
        GAME.seed(seed);
    }

    GAME.setReferenceItems(referenceItems);
    GAME.onFinish.push(() => {
        setPlaying(false);
    });

    return GAME.setup().then(() => DOMHelper.updateDOM(
    () => setPlaying(true, {transition: false}),
        {transition: transition}
    )).then(() => {
        GAME.newRound();
        GAME.focus();
    }).catch(err => console.error(err));
}



/************************** STORAGE ***************************/
function readFromSearchParams(transition = true) {
    const searchParams = new URLSearchParams(location.search);
    let datasetKey = searchParams.get("dataset");
    if (!datasetKey || !(datasetKey in DATASETS_METADATA)) {
        datasetKey = DEFAULT_DATASET;
    }
    document.getElementById("datasetSelect").value = datasetKey;

    Dataset.fetch(datasetKey).then(
        dataset => selectDataset(dataset, {transition: false})
    ).then(() => {
        if (["1", "true"].includes(searchParams.get("play"))) {
            return startGame(transition);
        } else {
            return setPlaying(false, {transition: transition});
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

    const data = {
        items: Base64Helper.encodeBase64BoolArray(SELECTOR.itemsActive)
    };
    if (DATASET.hasPropsSetting()) {
        data.properties = getActiveProperties("properties");
    }
    if (DATASET.hasLanguageSetting()) {
        data.language = DATASET_GAME_SC.getValue("language");
    }
    if (DATASET.hasFormsSetting()) {
        data.forms = FILTER_SC.getValue("forms");
    }

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
        if (typeof settings.items === "string") {
            settings.items = Base64Helper.decodeBase64BoolArray(settings.items);
        }
        return settings;
    } catch (e) {
        console.error(e);
        return {};
    }
}
