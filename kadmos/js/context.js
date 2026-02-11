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
         * @type {?SettingsCollection}
         */
        this.sc = null;

        this.genericSettings = this.constructor.generateGenericSettings();

        /**
         * @type {?ItemSelector}
         */
        this.itemSelector = null;
    }

    static generateGenericSettings() {
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

        this.itemSelector = this.dataset.getItemSelector();
        this.itemSelector.setup(cachedSettings.items, cachedSettings.forms, this.datasetKey);
        const checkPagesNextButton = () => {
            DOMHelper.setAttrs(
                document.querySelector('.pages-next-button'),
                {disabled: this.itemSelector.activeQuizItemCount() === 0}
            );
        }
        this.itemSelector.updateListeners.push(checkPagesNextButton);
        checkPagesNextButton();

        this.sc = this.dataset.getSettings(cachedSettings.properties, cachedSettings.language);
        this.sc.extend(this.genericSettings);

        for (const key of ["language"]) {
            const singleButton = this.sc.getValueElement(key).buttonCount() === 1;
            if (singleButton) {
                DOMHelper.hide(this.sc.getNode(key));
            }
            DOMHelper.classIfElse(singleButton, this.sc.getNode(key), "hidden");
        }

        this.sc.settings.properties.valueElement.disableIfSingleButton(true);
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

        for (const setting of Object.values(this.sc.settings)) {
            setting.valueElement.addUpdateListener(() => {
                this.saveSettings();
            });
        }
    }

    localStorageSettingsKey() {
        return "settings_" + this.datasetKey;
    }

    saveSettings() {
        window.localStorage.setItem("dataset", this.datasetKey);

        window.localStorage.setItem(this.localStorageSettingsKey(this.datasetKey), JSON.stringify({
            items: this.itemSelector.itemsActive.map(bool => Number(bool)),
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
    }
}