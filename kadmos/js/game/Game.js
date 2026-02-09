import {DOMHelper, ObjectHelper, FontHelper, FunctionStack} from "../helpers/helpers.js";
import {ItemDealer} from "./dealer.js";
import {Setting, SettingsCollection, SettingsHelper} from "../settings/settings.js";
import {ItemProperty, ListProperty} from "../dataset/symbol.js";


DOMHelper.registerTemplates({
    eval: `<div class="item-eval">
    <span class="submitted"></span><span class="solution"></span>
</div>`,
    symbolContainer: `<div class="symbol-container">
    <div class="symbol-display-container"><span class="symbol"></span></div>
    <div class="symbol-label-container"><span class="symbol-label"></span></div>
</div>`
});

export class Game {
    /**
     * @param {Dataset} dataset
     * @param {QuizItem[]} items
     * @param {string[]} properties
     */

    constructor(dataset, items, properties) {
        this.dataset = dataset;
        this.properties = properties;
        this.dealer = new ItemDealer(items);
        this.onFinish = new FunctionStack();

        this.updateProgressBar();
    }

    setup() {
        this.setupSymbolContainer();
        this.setupInputs();
        this.setupEvals();
        this.setupFontSettings();

        document.getElementById("item-next-button").textContent = "Next";
    }

    getInputMode(propType) {
        if (propType === "real" || propType === "integer") {
            return "numeric"
        }

        return "text";
    }

    setupSymbolContainer() {
        const symbol = document.querySelector("#symbol-current .symbol");
        symbol.classList.add("symbol-" + this.dataset.displayData.type);
        symbol.setAttribute("lang", this.dataset.metadata.lang);
        symbol.setAttribute("dir", this.dataset.metadata.dir);
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
                SettingsHelper.createSlider(100, 900, this.dataset.displayData.defaultWeight ?? 500)
            )
        });

        this.fontSettings.settings.weight.valueElement.addUpdateListener(value => {
            document.querySelector("#game-symbols").style.setProperty("--symbol-weight", value.toString());
        });
        this.fontSettings.settings.weight.valueElement.runUpdateListeners();

        document.querySelector("#font-settings").replaceChildren(...this.fontSettings.nodeList());

        this.fontSettings.settings.family.valueElement.addUpdateListener(key => {
            document.querySelectorAll("#game-symbols .symbol-string").forEach(element => {
                this.setSymbolFont(element, key);
            });
        });
        this.fontSettings.settings.family.valueElement.runUpdateListeners();
    }

    setSymbolFont(element, key) {
        const fonts = this.dataset.displayData.fonts;
        if (!(key in fonts)) {
            console.warn(`Unknown symbol font key "${key}".`);
            key = Object.keys(fonts)[0];
        }

        FontHelper.setFont(element, ObjectHelper.withoutKeys(fonts[key], ["label"]));
        FontHelper.getFontData(fonts[key].family).then(data => {
            const weightRange = this.fontSettings.settings.weight.valueElement;
            const [min, max] =
                "variationSettings" in data
                    ? data.variationSettings.wght.split(" ").map(x => parseInt(x, 10))
                    : [100, 900];
            weightRange.setMin(min);
            weightRange.setMax(max);
        }).catch(DOMHelper.printError);
    }

    /**
     * @param {Record<string,QuizItem[]>} referenceItems
     */
    setReferenceItems(referenceItems) {
        this.referenceItems = referenceItems;
    }

    seed(seed) {
        this.dealer.seed(seed);
    }

    cleanup() {
        for (const input of Object.values(this.inputs)) {
            input.remove();
        }
        this.clearItemDisplay();
        this.updateProgressBar(0);
    }

    finish() {
        setTimeout(() => this.cleanup(), 100);
        this.onFinish.call(this);
    }

    /**
     * @returns {QuizItem}
     */
    currentItem() {
        return this.dealer.currentItem();
    }

    submitRound() {
        let score = 0;
        const item = this.currentItem();

        for (const [propertyKey, input] of Object.entries(this.inputs)) {
            const evalElement = this.evals[propertyKey];
            const property = item.properties[propertyKey];
            const [grade, guessNodes, solutionNodes] = property.grade(input.value);

            score += grade;

            if (!ItemProperty.passes(grade)) {
                const referenceItems = this.getReferenceItems(item.form, propertyKey, input.value);
                if (referenceItems.length > 0) {
                    const referenceNodes = this.referenceItemsNodes(referenceItems, propertyKey);
                    document.getElementById("game-symbols").append(...referenceNodes);
                    this.fontSettings.settings.family.valueElement.runUpdateListeners();

                    for (const item of referenceItems) {
                        this.dealer.punish(this.dealer.getItemIndex(item), 1 / referenceItems.length);
                    }
                }
            }

            evalElement.querySelector(".submitted").replaceChildren(...guessNodes);
            evalElement.querySelector(".solution").replaceChildren(...solutionNodes);
            DOMHelper.classIfElse(
                property instanceof ListProperty && property.listMode === "best",
                evalElement,
                "best-mode"
            );
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

    /**
     * @param {string} form
     * @param {string} property
     * @param {string} guess
     */
    getReferenceItems(form, property, guess) {
        if (!this.referenceItems) {
            return [];
        }

        const items = [];
        for (const item of this.referenceItems[form]) {
            const grade = item.properties[property].grade(guess)[0];
            if (grade === 1) {
                return [item];
            } else if (ItemProperty.passes(grade)) {
                items.push(item);
            }
        }
        return items;
    }

    /**
     * @param {QuizItem[]} items
     * @param {string} property
     * @returns {HTMLElement[]}
     */
    referenceItemsNodes(items, property) {
        return items.map(item => this.referenceItemNode(item, property));
    }

    /**
     * @param {QuizItem} item
     * @param {string} property
     * @returns {HTMLElement}
     */
    referenceItemNode(item, property) {
        const container = DOMHelper.getTemplate("symbolContainer");
        container.classList.add("symbol-reference");
        const symbolNode = container.querySelector('.symbol');
        symbolNode.replaceChildren(item.display);
        symbolNode.classList.add("symbol-" + this.dataset.displayData.type);

        container.querySelector('.symbol-label').textContent = item.properties[property].displayString;
        return container;
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
            [
                ...Object.values(this.inputs),
                document.getElementById("item-submit-button")
            ],
            [
                ...Object.values(this.evals),
                document.getElementById("item-next-button")
            ]
        );

        DOMHelper.toggleShown(
            which === "inputs",
            null, document.querySelector('#symbol-current .symbol-label'),
            "visibility"
        );

        if (which === "inputs") {
            document.querySelectorAll("#game-symbols .symbol-reference").forEach(el => {
                el.remove();
            });
        }
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
        this.displayItem(this.currentItem());

        this.clearInputs();
        this.show("inputs");
        this.focus();
    }

    focus() {
        this.inputs[this.properties[0]].focus({preventScroll: true});
    }

    /**
     * @param {QuizItem} item
     */
    displayItem(item) {
        document.querySelector("#symbol-current .symbol").replaceChildren(item.display.cloneNode());
        document.querySelector('#symbol-current .symbol-label').replaceChildren(item.properties[this.properties[0]].displayString);
    }

    clearItemDisplay() {
        document.querySelector("#symbol-current .symbol").replaceChildren();
    }
}
