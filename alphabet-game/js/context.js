import {Setting, SettingsCollection, SettingsHelper as SH} from "./settings/settings.js";
import {Game} from "./game/Game.js";
import {Dataset} from "./dataset/Dataset.js";
import {DOMHelper} from "./helpers/helpers.js";


export class GameContext {
    constructor() {
        /** @type {?Game} */
        this.game = null;

        /** @type {?string} */
        this.datasetKey = null;

        /** @type {?Dataset} */
        this.dataset = null;
        /**
         * @type {{generic: SettingsCollection, filters?: SettingsCollection, properties?: Setting, forms?: Setting, language?: Setting}}
         */
        this.settings = {generic: this.constructor.genericSettings()};
    }

    static genericSettings() {
        return SettingsCollection.createFrom({
            seed: Setting.create("Seed (optional)", SH.createInput({type: "text"}), {id: "game-seed"})
        });
    }

    log(...stuff) {
        document.getElementById("console").innerHTML += stuff.join(", ") + "<br>";
    }

    async selectDataset(key) {
        this.dataset = await Dataset.fromKey(key);
        this.datasetKey = key;
        window.localStorage.setItem("dataset", key);

        let cachedSettings = window.localStorage.getItem(this.localStorageSettingsKey());
        cachedSettings = cachedSettings ? JSON.parse(cachedSettings) : {};

        const [filterer, filterSettings] = this.dataset.getFilterSettings(cachedSettings.filters);
        this.symbolFilterer = filterer;
        this.settings.filters = filterSettings;
        this.settings.properties = this.dataset.propertySetting(cachedSettings.properties);
        this.settings.forms = this.dataset.formsSetting(cachedSettings.forms);
        this.settings.language = this.dataset.languageSetting(cachedSettings.language);

        for (const key of ["forms", "language"]) {
            const singleButton = this.settings[key].valueElement.buttonCount() === 1;
            if (singleButton) {
                DOMHelper.hide(this.settings[key].node);
            }
            DOMHelper.classIfElse(singleButton, this.settings[key].node, "hidden");
        }

        this.settings.properties.valueElement.disableIfSingleButton();

        document.getElementById("dataset-settings").replaceChildren(
            this.settings.forms.node,
            ...this.settings.filters.nodeList(),
        );

        document.getElementById("game-settings").replaceChildren(
            this.settings.properties.node,
            this.settings.language.node,
            ...this.settings.generic.nodeList(),
        );

        // this.setupSymbolCount();

        for (const setting of this.settingsList()) {
            setting.valueElement.addUpdateListener(() => {
                this.saveSettings();
            });
        }
    }

    /**
     * @returns {Setting[]}
     */
    settingsList() {
        return [...Object.values(this.settings.filters.settings), this.settings.properties, this.settings.forms, this.settings.language];
    }

    setupSymbolCount() {
        this.updateSymbolCount();

        const func = this.updateSymbolCount.bind(this);
        for (const setting of Object.values(this.settings.filters.settings)) {
            setting.valueElement.addUpdateListener(func);
        }
        this.settings.forms.valueElement.addUpdateListener(func);
    }

    updateSymbolCount() {
        document.getElementById("totalSymbolCount").textContent =
            this.dataset.quizItemsCountString(this.symbolFilterer.active, this.settings.forms.getValue());
    }

    localStorageSettingsKey() {
        return "settings_" + this.datasetKey;
    }

    saveSettings() {
        window.localStorage.setItem("dataset", this.datasetKey);

        window.localStorage.setItem(this.localStorageSettingsKey(this.datasetKey), JSON.stringify({
            filters: this.settings.filters.getValues(),
            properties: this.settings.properties.getValue(),
            forms: this.settings.forms.getValue(),
            language: this.settings.language.getValue()
        }));
    }

    startGame() {
        if (this.game) {
            this.game.cleanup();
        }

        this.saveSettings();

        const properties = this.settings.properties.getValue();
        const items = this.dataset.getQuizItems(
            this.symbolFilterer.activeItemsList(),
            this.settings.forms.getValue(),
            properties,
            this.settings.language.getValue()
        );

        this.game = new Game(this.dataset, items, properties);
        const seed = this.settings.generic.getValue("seed");

        if (seed) {
            this.game.seed(seed);
        }

        this.game.setup();
        this.game.newRound();
        this.showScreen("game");
        this.game.focus();
        this.setPlaying(true);
        this.game.addOnFinish(() => {
            this.setPlaying(false);
            this.showScreen("dialogue");
        });
    }

    /**
     * @param {boolean} playing
     */
    setPlaying(playing) {
        const url = new URL(location);
        url.searchParams.set("play", playing ? "1" : "0");
        history.pushState({}, "", url);
    }

    /**
     * @param {"game"|"dialogue"} which
     */
    showScreen(which) {
        DOMHelper.toggleShown(
            which === "dialogue",
            document.getElementById("game-dialogue"),
            document.getElementById("game-container")
        );
    }
}