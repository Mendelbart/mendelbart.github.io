import {DOMHelper, ObjectHelper, ArrayHelper, FontHelper} from "../helpers/helpers.js";
import {ItemDealer} from "./dealer.js";
import {Setting, SettingsCollection, SettingsHelper} from "../settings/settings.js";
import {ListProperty} from "../dataset/symbol.js";


export class Game {
    /**
     * @param {Dataset} dataset
     * @param {Record<string,QuizItem>} items
     * @param {string[]} properties
     */

    constructor(dataset, items, properties) {
        this.dataset = dataset;
        this.properties = properties;
        this.items = items;
        this.dealer = new ItemDealer(Object.keys(items));
        this.onFinish = [];

        this.itemCount = Object.keys(items).length;
        this.updateProgressBar();
    }

    setup() {
        this.setupInputs();
        this.setupEvals();
        this.setupFontSettings();

        document.querySelectorAll(".game-heading").forEach(element => {
            this.dataset.setupGameHeading(element);
        });
    }

    /**
     * @param {function(Game): void} func
     */
    addOnFinish(func) {
        this.onFinish.push(func);
    }

    getInputMode(propType) {
        if (propType === "real" || propType === "integer") {
            return "numeric"
        }

        return "text";
    }

    setupInputs() {
        /**
         * @type {SettingsCollection}
         */
        this.inputsCollection = SettingsCollection.createFrom(
            ObjectHelper.mapKeyArrayToValues(this.properties, prop => Setting.create(
                this.dataset.propsData[prop].label,
                SettingsHelper.createInput({
                    type: "text",
                    inputmode: this.getInputMode(this.dataset.propsData[prop].type)
                }),
                {
                    id: "game-input-" + prop
                }
            )),
            this.properties
        );

        /**
         * @type {Object<string, HTMLInputElement>}
         */
        this.inputs = ObjectHelper.map(this.inputsCollection.settings, setting => setting.valueElement.node);

        document.getElementById("game-inputs").replaceChildren(...this.inputsCollection.nodeList());

        for (const [i, key] of this.properties.entries()) {
            const input = this.inputs[key];
            // Listeners to navigate between inputs with enter and backspace on an empty input
            if (i > 0) {
                const previousInput = this.inputs[this.properties[i-1]];
                previousInput.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        input.focus();
                    }
                });
                input.addEventListener("keydown", event => {
                    if (event.key === "Backspace" && event.target.getValue === "") {
                        previousInput.focus();
                        event.preventDefault();
                    }
                });
            }

            this.inputs[this.properties[this.properties.length - 1]].addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    this.submitRound();
                    event.preventDefault();
                }
            });
        }
    }

    setupEvals() {
        this.evals = {};
        for (const [key, input] of Object.entries(this.inputs)) {
            const evalElement = DOMHelper.getTemplate("eval");
            DOMHelper.hide(evalElement);
            input.insertAdjacentElement("afterend", evalElement);
            this.evals[key] = evalElement;
        }
    }

    setupFontSettings() {
        this.fontSettings = SettingsCollection.createFrom({
            family: this.dataset.fontSetting(),
            weight: Setting.create(
                "Weight",
                SettingsHelper.createSlider(100, 900, 400)
            )
        });

        this.fontSettings.settings.weight.valueElement.addUpdateListener(value => {
            document.querySelector("#game-symbols").style.setProperty("--symbol-weight", value.toString());
        });
        this.fontSettings.settings.weight.valueElement.runUpdateListeners();

        document.querySelector("#font-settings").replaceChildren(...this.fontSettings.nodeList());

        this.fontSettings.settings.family.valueElement.addUpdateListener(key => {
            document.querySelectorAll("#game-symbols .symbol").forEach(element => {
                this.setSymbolFont(element, key);
            });
        });
        this.fontSettings.settings.family.valueElement.runUpdateListeners();
    }

    setSymbolFont(element, key) {
        FontHelper.setFont(element, this.dataset.displayData.fonts[key]);
    }

    seed(seed) {
        this.dealer.seed(seed);
    }

    cleanup() {
        this.inputsCollection.removeAll();
        this.clearSymbol();
    }

    finish() {
        this.cleanup();
        this.displayStats();

        for (const func of this.onFinish) {
            func(this);
        }
    }

    currentSymbol() {
        return this.items[this.dealer.currentItem()];
    }

    submitRound() {
        let score = 0;
        const symbol = this.currentSymbol();

        for (const [key, input] of Object.entries(this.inputs)) {
            const evalElement = this.evals[key];
            const property = symbol.properties[key];
            const [grade, guessNodes, solutionNodes] = property.grade(input.value);

            score += grade;

            evalElement.querySelector(".submitted").replaceChildren(...guessNodes);
            evalElement.querySelector(".solution").replaceChildren(...solutionNodes);
            DOMHelper.classIfElse(
                property instanceof ListProperty && property.listMode === "best",
                evalElement,
                "best-mode"
            )
        }

        score /= this.properties.length;
        this.dealer.enterScore(score);

        this.updateProgressBar();
        this.show("evals");
        document.getElementById("item-next-button").focus();
    }

    clearInputs() {
        for (const input of Object.values(this.inputs)) {
            input.value = "";
        }
    }

    /**
     * @param {"inputs"|"evals"} which
     */
    show(which) {
        DOMHelper.toggleShown(
            which === "inputs",
            Object.values(this.inputs),
            Object.values(this.evals)
        )
        DOMHelper.toggleShown(
            which === "inputs",
            document.getElementById("item-submit-button"),
            document.getElementById("item-next-button")
        );
    }

    updateProgressBar() {
        const k = 6;
        const a = 0.9;

        const triesLeftSum = ArrayHelper.sum(this.dealer.triesLeft);
        const x = a * triesLeftSum / this.itemCount;
        const progress = 1 - x / (1 + x**k) ** (1/k);
        document.getElementById("progress-bar").style.setProperty("--progress", progress.toString());
    }

    newRound() {
        if (this.dealer.isEmpty()) {
            this.finish();
            return;
        }

        this.dealer.nextItem();
        this.displaySymbol(this.currentSymbol().display);

        this.clearInputs();
        this.show("inputs");
        this.focus();
    }

    focus() {
        this.inputs[this.properties[0]].focus({preventScroll: true});
    }

    displaySymbol(symbol) {
        document.querySelector("#symbol-current .symbol-string").textContent = symbol;
    }

    clearSymbol() {
        this.displaySymbol("");
    }

    pause() {
        this.displayStats();
    }

    displayStats() {
        document.getElementById("stat-score").textContent = this.dealer.scoreString("both");
    }
}
