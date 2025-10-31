import {DOMHelper, ObjectHelper, FontHelper} from "../helpers/helpers.js";
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

        this.updateProgressBar();
    }

    setup() {
        this.setupInputs();
        this.setupEvals();
        this.setupFontSettings();

        document.getElementById("item-next-button").textContent = "Next";
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
         * @type {Object<string, HTMLInputElement>}
         */
        this.inputs = ObjectHelper.mapKeyArrayToValues(this.properties, prop => {
            const input = document.createElement("INPUT");
            DOMHelper.setAttrs(input, {
                type: "text",
                inputmode: this.getInputMode(this.dataset.propsData[prop].type),
                placeholder: this.dataset.propsData[prop].label
            });
            return input;
        });

        document.getElementById("game-inputs").replaceChildren(...Object.values(this.inputs));

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
                    document.getElementById("item-submit-button").focus();
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
                SettingsHelper.createSlider(100, 900, this.dataset.displayData.defaultWeight ?? 400)
            )
        });

        this.fontSettings.settings.weight.valueElement.addUpdateListener(value => {
            document.querySelector("#game-symbols").style.setProperty("--symbol-weight", value.toString());
        });
        this.fontSettings.settings.weight.valueElement.runUpdateListeners();

        document.querySelector("#font-settings").replaceChildren(...this.fontSettings.nodeList());

        this.fontSettings.settings.family.valueElement.addUpdateListener(key => {
            document.querySelectorAll("#game-symbols .symbol > .symbol-string").forEach(element => {
                this.setSymbolFont(element, key);
            });
        });
        this.fontSettings.settings.family.valueElement.runUpdateListeners();
    }

    setSymbolFont(element, key) {
        FontHelper.setFont(element, this.dataset.displayData.fonts[key]);
        FontHelper.getFontData(this.dataset.displayData.fonts[key].family).then(data => {
            const weightRange = this.fontSettings.settings.weight.valueElement;
            const [min, max] =
                "variationSettings" in data
                    ? data.variationSettings.wght.split(" ").map(x => parseInt(x, 10))
                    : [100, 900];
            weightRange.setMin(min);
            weightRange.setMax(max);
        });
    }

    seed(seed) {
        this.dealer.seed(seed);
    }

    cleanup() {
        for (const input of Object.values(this.inputs)) {
            input.remove();
        }
        this.clearSymbol();
        this.updateProgressBar(0);
    }

    finish() {
        setTimeout(() => this.cleanup(), 100);

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
        if (this.dealer.isEmpty()) {
            document.getElementById("item-next-button").textContent = "Finish";
        }
        document.getElementById("item-next-button").focus();

        if (window.scrollY > 0) {
            window.scrollTo({top: 0, behavior: "smooth"});
        }
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

    updateProgressBar(value = null) {
        value ??= this.dealer.progress();
        document.getElementById("progress-bar").style.setProperty("--progress", value);
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
        document.querySelector("#symbol-current .symbol-string").replaceChildren(document.createTextNode(symbol));
    }

    clearSymbol() {
        this.displaySymbol("");
    }
}
