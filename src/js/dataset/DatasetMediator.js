import {DOMUtils, Observable} from '../utils';
import Game from "../game/Game";
import QuizDealer from "../quiz/QuizDealer";
import {CardFactory} from "../quiz/card";
import {SettingCollection, Slider} from "../settings";


export default class DatasetMediator extends Observable {
    /**
     * @param {Dataset} dataset
     */
    constructor(dataset) {
        super();
        this.dataset = dataset;
        /** @type {Selector} */
        this.selector = dataset.createSelector();

        /** @type {SettingCollection} */
        this.selectorSettings = dataset.getSelectorSettings();
        /** @type {SettingCollection} */
        this.gameSettings = dataset.getGameSettings();

        this.setup();
    }

    setup() {
        this.setupObservers();

        this.setupSelectorButtons();
        this.selector.finishSetup();

        this.applyStyles();
        const {forms, variant} = this.selectorSettings.getValues();
        this.applySettings(forms, variant);
    }

    setupSelectorButtons() {
        const forms = Object.keys(this.dataset.forms.data);
        this.selector.setupButtonContents(item => item.combineForms(forms).getNode());

        if (this.dataset.selectorData.label) {
            const property = this.dataset.selectorData.label.property;
            this.selector.labelButtons(item => item.getProperty({
                property: property,
                splitter: this.dataset.getPropertySplitter(property)
            }));
        }
    }

    setupObservers() {
        this.selectorSettings.observers.push(({forms, variant}, changed) => DOMUtils.transition(
            () => this.applySettings(forms, variant, changed),
            ["selector-forms"]
        ));

        for (const x of [this.selector, this.selectorSettings, this.gameSettings]) {
            x.observers.push(this.callObservers);
        }
    }

    getSettingsValues() {
        return Object.assign(
            {checked: this.selector.getChecked({includeDisabled: true})},
            this.selectorSettings.getValues(),
            this.gameSettings.getValues()
        );
    }

    observerArgs() {
        return [this.getSettingsValues()];
    }

    updateSelectorFont(variant) {
        const font = this.dataset.getSelectorDisplayFont(variant);
        this.selector.updateButtonContents(content => {
            font.applyTo(content);
        });
    }

    applyStyles() {
        this.selector.node.dir = this.dataset.getDir();

        const blockStyles = this.dataset.getSelectorBlockStyles();
        this.selector.blocks.forEach((block, index) => {
            block.applyStyle(blockStyles[index]);
        });
    }

    getCheckedItems() {
        return this.selector.getCheckedItems();
    }

    getVariant() {
        return this.selectorSettings.getDefault("variant", null);
    }

    getLanguage() {
        return this.gameSettings.getDefault("language", null)
    }

    /**
     * @param {boolean} [includeDisabled]
     * @returns {number}
     */
    checkedCount(includeDisabled) {
        return this.selector.checkedCount(includeDisabled);
    }

    setSettings(values) {
        if (values.checked) {
            tryMessage(
                () => this.selector.setChecked((_, index) => values.checked[index]),
                "Error setting selected selector items:"
            );
        }

        tryMessage(() => this.selectorSettings.setValues(values), "Error setting selector settings values:");
        tryMessage(() => this.applySettings(values.forms, values.variant), "Error setting form/variant values:");
        tryMessage(() => this.gameSettings.setValues(values), "Error setting game setting values:");
    }

    /**
     * @param {string[]} [forms]
     * @param {string} [variant]
     * @param {"forms" | "variant"} [changed]
     */
    applySettings(forms, variant, changed) {
        const formKeys = this.dataset.getFormKeysFromGrouped(forms);

        if (!changed || changed === "forms") {
            this.selector.updateButtonContents(content => {
                content.querySelectorAll(".letter").forEach(elem => {
                    const shown = formKeys.includes(elem.dataset.form);
                    DOMUtils.toggleShown(shown, elem);
                });
            });
        }

        if (!changed || changed === "variant") {
            this.updateSelectorFont(variant);
            const lang = this.dataset.getLang(variant);
            if (lang) {
                this.selector.updateButtonContents(content => {
                    content.lang = lang;
                });
            }
        }

        this.selector.setDisabled(
            (item, index) => !this.dataset.isItemIncluded(index, variant) || item.countQuizItems(formKeys) === 0
        );
    }

    /**
     * @returns {string[]}
     */
    getActiveForms() {
        if (!this.dataset.hasSetting("forms")) return Object.keys(this.dataset.forms.data);

        return this.dataset.getFormKeysFromGrouped(this.selectorSettings.getValue("forms"));
    }

    getActiveProperties() {
        return this.gameSettings.getDefault("properties", Object.keys(this.dataset.properties));
    }

    /**
     * @returns {Record<string, string>}
     */
    getGameParams() {
        const params = {};
        if (this.dataset.hasVariants()) params.variant = this.getVariant();
        if (this.dataset.hasSetting("language")) params.language = this.getLanguage();
        return params;
    }

    /**
     * @returns {CardFactory}
     */
    getCardFactory() {
        const attrs = this.dataset.getLetterNodeAttrs(this.getVariant());
        const property = Object.keys(this.dataset.properties)[0];

        const factory = new CardFactory(
            (card, item, ...args) => {
                card.display(item.content.getNode(...args));
                card.setLabel("bottom", item.answers[property].display)
            },
            card => DOMUtils.setAttrs(card.displayNode, attrs)
        );
        factory.setDisplayArgs();
        return factory;
    }

    /**
     * @returns {Game}
     */
    getGame() {
        const forms = this.getActiveForms();
        const properties = this.getActiveProperties();
        const params = this.getGameParams();
        const items = this.dataset.getQuizItems(this.getCheckedItems(), properties, forms, params);
        const referenceItems = this.dataset.getReferenceItems(properties, forms, params);

        const dealer = new QuizDealer(items);
        const cardFactory = this.getCardFactory();

        const game = new Game(dealer, cardFactory);
        game.setReferenceItems(referenceItems, (card, item, property) => {
            card.display(item.content.getNode());
            card.setLabel("bottom", item.answers[property].display);
        });

        game.setupCardSettings(this.getCardSettings(), this.cardSettingsCallback(params.variant));

        game.setupAnswerInputs(
            properties.map(key => {return {key: key, label: this.dataset.properties[key].label}}),
            {lang: params.language}
        );

        return game
    }

    /**
     * @param {string} key
     * @param {Slider} weightSlider
     */
    updateSymbolWeightRange(key, weightSlider) {
        const [min, max] = this.dataset.getFont(key, this.variant).getWeightLimits();
        weightSlider.setMin(min);
        weightSlider.setMax(max);
    }

    /**
     * @returns {SettingCollection}
     */
    getCardSettings() {
        const sc = new SettingCollection();

        const weightSlider = Slider.create(100, 900, this.dataset.gameConfig.defaultWeight ?? 500);
        weightSlider.label("Weight");

        if (this.dataset.hasSetting("font-family")) {
            sc.add("family", this.dataset.fontFamilySetting());
            sc.addObserverTo("family", key => this.updateSymbolWeightRange(key, weightSlider));
            this.updateSymbolWeightRange(sc.getValue("family"), weightSlider);
        } else {
            this.updateSymbolWeightRange(this.dataset.fonts.defaultKey, weightSlider);
        }

        sc.add("weight", weightSlider);

        return sc;
    }

    /**
     * @param {string} [variant]
     * @returns {function(Card, {family, weight}, string?): void}
     */
    cardSettingsCallback(variant) {
        return (card, {family, weight}, changed) => {
            if (!changed || changed === "family") {
                const font = this.dataset.getFont(family, variant);
                font.load().then(() => {
                    font.applyTo(card.displayNode);
                    if (weight) card.displayNode.style.fontWeight = weight;
                });
            } else if (weight) {
                card.displayNode.style.fontWeight = weight;
            }
        }
    }

    teardown() {
        this.selector.teardown();
        this.selectorSettings.teardown();
    }
}

/**
 * @param {function} callback
 * @param {string} message
 */
function tryMessage(callback, message) {
    try {
        callback();
    } catch (e) {
        console.error(message, e);
    }
}
