import {SettingsCollection, ValueElement} from "./settings/settings.js";
import {Game} from "./game/Game.js";
import {Dataset} from "./dataset/Dataset.js";
import {DOMHelper, Base64Helper} from "./helpers/helpers.js";


export class GameContext {
    constructor() {
        /** @type {?Game} */
        this.game = null;

        /** @type {?string} */
        this.datasetKey = null;

        /** @type {?Dataset} */
        this.dataset = null;
        /**
         * @type {?SettingsCollection}
         */
        this.sc = null;

        this.genericSettings = this.constructor.generateGenericSettings();

        /**
         * @type {?ItemSelector}
         */
        this.itemSelector = null;

        this.checkPagesNextButton = this.checkPagesNextButton.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
    }

    static generateGenericSettings() {
        return SettingsCollection.createFrom({
            seed: ValueElement.createInput("text", "Seed (optional)", {id: "game-seed"})
        });
    }

    /**
     * @returns {Record<string,any>}
     */
    getCachedSettings() {
        const settingsJSON = window.localStorage.getItem(this.localStorageSettingsKey());
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

    /**
     * @param key
     * @param {Dataset} dataset
     */
    selectDataset(key, dataset) {
        this.dataset = dataset;
        this.datasetKey = key;
        DOMHelper.setSearchParams({dataset: key});

        const cachedSettings = this.getCachedSettings();

        this.setupSelector(cachedSettings);
        this.setupSettingsCollection(cachedSettings);

        const gameHeading = this.dataset.metadata.gameHeading;
        const fonts = "font" in gameHeading && "family" in gameHeading.font ? [gameHeading.font.family] : [];
        DOMHelper.batchUpdate([
            [
                this.dataset.setupGameHeading.bind(this.dataset),
                document.querySelector("#game-heading h1")
            ],
            [
                (e, selector) => {
                    e.replaceChildren(selector.node);
                    selector.scaleButtons();
                },
                document.getElementById("game-filters"),
                this.itemSelector
            ],
            [
                (e, ...args) => e.replaceChildren(...args),
                document.getElementById("game-settings"),
                ...this.sc.nodeList()
            ]
        ], fonts);

        DOMHelper.showPage(document.getElementById('game-filters'));
    }

    setupSelector(settings) {
        if (this.itemSelector) {
            this.itemSelector.destroy();
        }
        this.itemSelector = this.dataset.getItemSelector();
        this.itemSelector.setup(settings.items, settings.forms, this.datasetKey);
        this.itemSelector.updateListeners.push(
            this.checkPagesNextButton,
            this.saveSettings
        );
        this.checkPagesNextButton();
    }

    checkPagesNextButton() {
        DOMHelper.setAttrs(
            document.querySelector('.pages-next-button'),
            {disabled: this.itemSelector.activeQuizItemCount() === 0}
        );
    }

    setupSettingsCollection(settings) {
        this.sc = this.dataset.getSettings(settings.properties, settings.language);
        this.sc.extend(this.genericSettings);

        for (const key of ["language"]) {
            const singleButton = this.sc.getSetting(key).buttonCount() === 1;
            if (singleButton) {
                DOMHelper.hide(this.sc.getNode(key));
            }
            DOMHelper.classIfElse(singleButton, this.sc.getNode(key), "hidden");
        }

        this.sc.getSetting("properties").disableIfSingleButton(true);

        this.sc.addUpdateListener(() => {
            this.saveSettings();
        });
    }

    localStorageSettingsKey(datasetKey = this.datasetKey) {
        return "settings_" + datasetKey;
    }

    saveSettings() {
        DOMHelper.setSearchParams({dataset: this.datasetKey});

        window.localStorage.setItem(this.localStorageSettingsKey(), JSON.stringify({
            items: Base64Helper.encodeBase64BoolArray(this.itemSelector.itemsActive),
            forms: this.itemSelector.activeForms(),
            properties: this.sc.getValue("properties"),
            language: this.sc.getValue("language")
        }));
    }

    startGame() {
        if (this.game) {
            this.game.cleanup();
        }

        this.saveSettings();

        const properties = this.sc.getValue("properties");
        const language = this.sc.getValue("language");
        const items = this.dataset.getQuizItems(
            this.itemSelector.activeIndices(),
            this.itemSelector.activeForms(),
            properties,
            language
        );
        const referenceItems = this.dataset.getReferenceItems(properties, language);

        this.game = new Game(this.dataset, items, properties);

        const seed = this.sc.getValue("seed");
        if (seed) {
            this.game.seed(seed);
        }

        this.game.setReferenceItems(referenceItems);
        this.game.setup();
        this.game.newRound();
        this.setPlaying(true);
        this.game.focus();
        this.game.onFinish.push(() => {
            DOMHelper.showPage(document.getElementById('game-filters'));
            this.setPlaying(false);
        });
    }

    /**
     * @param {boolean} playing
     */
    setPlaying(playing) {
        DOMHelper.classIfElse(playing, document.body, "playing");
        DOMHelper.setSearchParams({play: playing});
    }
}
