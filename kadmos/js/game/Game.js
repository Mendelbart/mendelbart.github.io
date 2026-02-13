import {DOMHelper, ObjectHelper, FontHelper, FunctionStack} from "../helpers/helpers.js";
import {ItemDealer} from "./dealer.js";
import {Slider, SettingsCollection} from "../settings/settings.js";
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
     * @param {string} language
     */

    constructor(dataset, items, properties, language) {
        this.dataset = dataset;
        this.properties = properties;
        this.language = language;
        this.dealer = new ItemDealer(items);
        this.onFinish = new FunctionStack();

        this.updateProgressBar();

        this.onInputKeydown = this.onInputKeydown.bind(this);
        this._show = this._show.bind(this);
        this.updateSymbolFontFamily = this.updateSymbolFontFamily.bind(this);
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
            if (this.language && this.language !== "default") {
                input.setAttribute("lang", this.language);
            }
            return input;
        });

        const gameInputs = document.getElementById("game-inputs");
        gameInputs.replaceChildren(...Object.values(this.inputs));
        gameInputs.addEventListener("keydown", this.onInputKeydown);
    }

    /**
     * @param {KeyboardEvent} event
     */
    onInputKeydown(event) {
        /** @type HTMLInputElement */
        const input = event.target.closest("INPUT");
        if (!input) return;

        if (event.key === "Enter") {
            if (input.nextElementSibling) {
                input.nextElementSibling.focus();
            } else {
                document.getElementById("item-submit-button").focus();
            }
        } else if (event.key === "Backspace" && event.target.value === "" && input.previousElementSibling) {
            input.previousElementSibling.focus();
            event.preventDefault();
        }
    }

    setupEvals() {
        this.evals = {};
        const evalsContainer = document.getElementById("game-evals");

        for (const property of this.properties) {
            const evalElement = DOMHelper.getTemplate("eval");
            this.evals[property] = evalElement;
            evalsContainer.append(evalElement);
        }
    }

    updateSymbolWeight(value) {
        document.querySelector("#game-symbols").style.setProperty("--symbol-weight", value.toString());
    }

    updateSymbolFontFamily(key) {
        document.querySelectorAll("#game-symbols .symbol-string").forEach(element => {
            this.setSymbolFont(element, key);
        });
    }

    setupFontSettings() {
        const weight = this.dataset.displayData.defaultWeight ?? 500
        const weightSlider = Slider.create(100, 900, weight);
        weightSlider.label("Weight");
        this.fontSettings = SettingsCollection.createFrom({
            family: this.dataset.fontSetting(),
            weight: weightSlider
        });

        document.querySelector("#font-settings").replaceChildren(...this.fontSettings.nodeList());

        this.fontSettings.addUpdateListener("weight", this.updateSymbolWeight);
        this.fontSettings.addUpdateListener("family", this.updateSymbolFontFamily);
        this.updateSymbolFontFamily(this.fontSettings.getValue("family"));
        this.updateSymbolWeight(weight);
    }

    setSymbolFont(element, key) {
        const fonts = this.dataset.displayData.fonts;
        if (!(key in fonts)) {
            console.warn(`Unknown symbol font key "${key}".`);
            key = Object.keys(fonts)[0];
        }

        FontHelper.setFont(element, ObjectHelper.withoutKeys(fonts[key], ["label"]));
        FontHelper.getFontData(fonts[key].family).then(data => {
            /** @type Slider */
            const weightRange = this.fontSettings.settings.weight;
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
        this.clearItemDisplay();
        this.updateProgressBar(0);

        document.getElementById("game-inputs").removeEventListener("keydown", this.onInputKeydown);
        document.getElementById("game-inputs").replaceChildren();
        document.getElementById("game-evals").replaceChildren();
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
                    this.updateSymbolFontFamily(this.fontSettings.getValue("family"));

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
        if (this.dealer.isEmpty()) {
            document.getElementById("item-next-button").textContent = "Finish";
        }
        this.show("evals");

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
        const grades = [];

        for (const item of this.referenceItems[form]) {
            const grade = item.properties[property].grade(guess)[0];
            if (ItemProperty.passes(grade)) {
                items.push(item);
                grades.push(grades);
            }
        }

        if (Math.max(...grades) === 1) {
            return items.filter((_, index) => grades[index] === 1);
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
        symbolNode.textContent = item.displayString;
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
        this.shown = which;
        requestAnimationFrame(this._show);
    }

    _show() {
        DOMHelper.toggleShown(
            this.shown === "inputs",
            [
                document.getElementById("game-inputs"),
                document.getElementById("item-submit-button")
            ],
            [
                document.getElementById("game-evals"),
                document.getElementById("item-next-button")
            ]
        );

        DOMHelper.toggleShown(
            this.shown === "inputs",
            null, document.querySelector('#symbol-current .symbol-label'),
            "visibility"
        );

        if (this.shown === "inputs") {
            document.querySelectorAll("#game-symbols .symbol-reference").forEach(el => {
                el.remove();
            });
            this.focus();
        } else {
            document.getElementById("item-next-button").focus();
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
    }

    focus() {
        this.inputs[this.properties[0]].focus({preventScroll: true});
    }

    /**
     * @param {QuizItem} item
     */
    displayItem(item) {
        document.querySelector("#symbol-current .symbol").textContent = item.displayString;
        document.querySelector('#symbol-current .symbol-label').textContent = item.properties[this.properties[0]].displayString;

        DOMHelper.scaleToFit(document.querySelector("#symbol-current .symbol"));
        DOMHelper.scaleToFit(document.querySelector("#symbol-current .symbol-label"));
    }

    clearItemDisplay() {
        document.querySelector("#symbol-current .symbol").textContent = "";
        document.querySelector('#symbol-current .symbol-label').textContent = "";
    }
}
