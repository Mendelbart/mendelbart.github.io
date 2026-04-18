import {SettingCollection, Slider, ButtonGroup} from "./settings";
import Game from "./game/Game";
import {Dataset, DEFAULT_DATASET, TERMS} from "./dataset/Dataset.js";
import DATASETS_METADATA from '../json/datasets_meta.json';
import {DOMUtils, ObjectUtils, FontUtils} from "./utils";
import {encodeBase64BoolArray, decodeBase64BoolArray} from "./utils/base64";
import DatasetMediator from "./dataset/DatasetMediator";


/** @type {Game} */
let GAME;

/** @type {Dataset} */
let DATASET;
/** @type {DatasetMediator} */
let DSM;

const GENERIC_GAME_SETTINGS = Game.genericSettings();

/** @type {SettingCollection} */
let PAGE_SETTINGS;


/******************** SETUP ***********************/
export function setup() {
    setupPageSettings();
    setupButtonListeners();

    window.addEventListener("popstate", () => DOMUtils.transition(readFromSearchParams));

    DOMUtils.transition(() => {
        document.getElementById("generic-game-settings").append(...GENERIC_GAME_SETTINGS.nodeList());

        setupDatasetSelect();
        readFromSearchParams(false);
    });
}

function setupButtonListeners() {
    document.getElementById("start-game-button").addEventListener("click", () => DOMUtils.transition(startGame));
    document.getElementById("stop-game-button").addEventListener("click", () => GAME.finish());
    document.getElementById("item-submit-button").addEventListener("click", () => {
        GAME.transition(() => GAME.submitRound());
    });
    document.getElementById("item-next-button").addEventListener("click", () => {
        GAME.transition(() => GAME.newRound());
    });
}

function setupDatasetSelect() {
    const select = document.getElementById("datasetSelect");
    DOMUtils.setOptions(
        select, ObjectUtils.map(DATASETS_METADATA, data => data.name)
    );

    select.addEventListener("change", (e) => {
        Dataset.fetch(e.target.value).then(
            dataset => DOMUtils.transition(() => selectDataset(dataset))
        ).catch(err => console.error(err));
    });
}


/**
 * @param {boolean} playing
 */
function setPlaying(playing) {
    if (!playing) {
        DOMUtils.showPage(document.getElementById('game-filters'));
        GAME?.cleanup();
    }

    DOMUtils.toggleShown(playing,
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
const PageSettingCreators = {
    accentHue: getAccentHueSetting,
    colorMode: getPageLightDarkModeSetting,
    keepKeyboardOpen: getKeepKeyboardOpenSetting,
    useViewTransitions: getViewTransitionSetting
}

function setupPageSettings() {
    PAGE_SETTINGS = SettingCollection.createFrom(ObjectUtils.map(PageSettingCreators,
        (creator, key) => creator(window.localStorage.getItem(key))
    ));

    PAGE_SETTINGS.observers.push((values, changedKey) => {
        if (changedKey) window.localStorage.setItem(changedKey, values[changedKey]);
    });

    document.querySelector("#page-settings .settings").replaceChildren(...PAGE_SETTINGS.nodeList());

    document.getElementById("page-settings").addEventListener("cancel", (event) => {
        event.preventDefault();
        DOMUtils.transition(hidePageSettings, ["page-settings", "ease-out"]);
    });
    document.getElementById("open-settings-button").addEventListener("click", () => {
        DOMUtils.transition(showPageSettings, ["page-settings", "ease-in"]);
    });
    document.getElementById("close-settings-button").addEventListener("click", () => {
        document.getElementById("page-settings").requestClose();
    });
}

function showPageSettings() {
    document.getElementById("page-settings").showModal();
    document.documentElement.style.overflowY = "hidden";
}

function hidePageSettings() {
    document.getElementById("page-settings").close();
    document.documentElement.style.removeProperty("overflow-y");
}


/**
 * @param {string} [value]
 * @returns {Slider}
 */
function getAccentHueSetting(value) {
    let hue = parseInt(value);
    if (Number.isNaN(hue)) hue = 250;
    setAccentHue(hue);
    const slider = Slider.create(0, 360, hue);
    slider.label("Accent Hue");
    slider.observers.push(hue => setAccentHue(hue));
    slider.node.id = "accentHueSlider";
    return slider;
}

/**
 * @param {number} hue
 */
function setAccentHue(hue) {
    document.documentElement.style.setProperty("--accent-hue", hue);
}

/**
 * @param {"dark" | "light" | "default"} [mode]
 * @returns {ButtonGroup}
 */
function getPageLightDarkModeSetting(mode = "default") {
    setLightDarkMode(mode);

    const colorModeSetting = ButtonGroup.from(
        {
            dark: "Dark",
            light: "Light",
            default: "Default"
        },
        {
            label: "Color Theme",
            exclusive: true,
            checked: mode
        }
    );

    colorModeSetting.observers.push(mode => DOMUtils.transition(() => setLightDarkMode(mode)));
    return colorModeSetting;
}

/**
 * @param {"dark" | "light" | "default"} mode
 */
function setLightDarkMode(mode) {
    if (!["default", "dark", "light"].includes(mode)) {
        if (mode) console.error(`Invalid color mode ${mode}, use dark, light or default.`);
        mode = "default";
    }

    if (mode === "default") {
        document.documentElement.classList.remove("dark-mode", "light-mode");
        return;
    }

    DOMUtils.classIfElse(mode === "dark", document.documentElement, "dark-mode", "light-mode");
}

/**
 * @param {"true" | "false"} [checked]
 * @returns {ButtonGroup}
 */
function getKeepKeyboardOpenSetting(checked) {
    const bg = getOnOffSetting("Keep Keyboard Open", checked ?? window.isMobile.toString());
    bg.observers.push((value) => {
        if (GAME) GAME.keepKeyboardOpen = value === "true";
    });

    return bg;
}

/**
 * @param {"true" | "false"} checked
 */
function getViewTransitionSetting(checked) {
    checked ??= "true";
    const bg = getOnOffSetting("Use View Transitions");
    bg.observers.push((value) => {
        window.useViewTransitions = value === "true";
    });
    window.useViewTransitions = checked === "true";
    return bg;
}

/**
 * @param {string} label
 * @param {"true" | "false"} [checked]
 * @returns ButtonGroup
 */
function getOnOffSetting(label, checked) {
    return ButtonGroup.from(
        {true: "On", false: "Off"},
        {
            label: label,
            exclusive: true,
            checked: checked
        }
    );
}




/************************************ SELECTOR ********************************/
/**
 * @param {Dataset} dataset
 */
function selectDataset(dataset) {
    DATASET = dataset;
    DOMUtils.setSearchParams({dataset: dataset.key});
    updateDocumentTitle();

    const cachedSettings = getCachedSettings();
    const gameHeading = DATASET.metadata.gameHeading;

    return FontUtils.loadFonts([
        DATASET.getFont(gameHeading.font),
        DATASET.getSelectorDisplayFont()
    ]).then(() => {
        setupTerms();

        DOMUtils.showPage(document.getElementById('game-filters'));

        setupDSM();
        DSM.setSettings(cachedSettings);
        checkPagesNextButton();
        DATASET.setupGameHeading(document.querySelector("#game-heading h1"), DSM.selectorSettings.getDefault("variant"));
    }).catch(err => console.error(err));
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

function setupDSM() {
    DSM?.teardown();

    DSM = new DatasetMediator(DATASET);

    DSM.selector.observers.push(checkPagesNextButton);
    DSM.observers.push(saveSettings);

    document.getElementById('dataset-filter-settings').replaceChildren(...DSM.selectorSettings.nodeList(), DSM.selector.node);
    document.getElementById("dataset-game-settings").replaceChildren(...DSM.gameSettings.nodeList());

    if (DSM.selectorSettings.has("variant")) {
        DSM.selectorSettings.addObserverTo("variant", value => {
            DATASET.setupGameHeading(document.querySelector("#game-heading h1"), value);
        });
    }
}

function checkPagesNextButton() {
    document.querySelector('#game-settings-pages .pages-next-button').disabled = DSM.checkedCount() === 0;
}


/***************************************** GAME *******************************/
function startGame() {
    GAME?.cleanup();

    saveSettings(DSM.getSettingsValues());

    GAME = DSM.getGame();

    const seed = GENERIC_GAME_SETTINGS.getValue("seed");
    if (seed) GAME.seed(seed);

    GAME.keepKeyboardOpen = PAGE_SETTINGS.getValue("keepKeyboardOpen") === "true";

    GAME.onFinish.push(() => setPlaying(false));

    setPlaying(true);
    GAME.newRound();
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
 * @param {string?} [datasetKey]
 * @returns {string}
 */
function localStorageSettingsKey(datasetKey) {
    return "settings_" + (datasetKey || DATASET.key);
}

function saveSettings(values) {
    DOMUtils.setSearchParams({dataset: DATASET.key});

    if (values.checked) {
        values.checked = encodeBase64BoolArray(values.checked);
    }

    window.localStorage.setItem(localStorageSettingsKey(), JSON.stringify(values));
}

/**
 * @returns {Record<string,any>}
 */
function getCachedSettings() {
    const settingsJSON = window.localStorage.getItem(localStorageSettingsKey());
    if (!settingsJSON) return {};

    try {
        const settings = JSON.parse(settingsJSON);
        if (typeof settings.checked === "string") {
            settings.checked = decodeBase64BoolArray(settings.checked);
        }
        return settings;
    } catch (e) {
        console.error(e);
        return {};
    }
}
