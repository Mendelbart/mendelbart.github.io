import {FontHelper, DOMHelper} from '../helpers';
import Observable from "../helpers/classes/Observable";
import {Game} from "../game";


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
        const dir = this.dataset.getDir();

        this.selector.setupButtonContents(item => {
            const content = DOMHelper.createElement("span.symbol-string");
            content.append(...Object.values(item.getFormNodes()));
            if (dir) content.dir = dir;
            return content;
        });

        if (this.dataset.selectorData.label) {
            this.selector.labelButtons(item => item.getSelectorLabel(this.dataset.selectorData.label));
        }
    }

    setupObservers() {
        this.selectorSettings.observers.push(({forms, variant}, changed) => DOMHelper.transition(
            () => { this.applySettings(forms, variant, changed); },
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
            FontHelper.setFont(content, font);
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
            this.selector.setChecked((_, index) => values.checked[index]);
        }

        this.selectorSettings.setValues(values);
        this.applySettings(values.forms, values.variant);
        this.gameSettings.setValues(values);
    }

    /**
     * @param {string[]} [forms]
     * @param {string} [variant]
     * @param {"forms" | "variant"} [changed]
     */
    applySettings(forms, variant, changed) {
        const formKeys = this.dataset.getFormKeysFromSetting(forms);
        const variantIndices = this.dataset.getVariantItemIndices(variant);

        if (!changed || changed === "forms") {
            this.selector.updateButtonContents(content => {
                content.querySelectorAll(".symbol-form").forEach(elem => {
                    const shown = formKeys.includes(elem.dataset.form);
                    DOMHelper.toggleShown(shown, elem);
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
            (item, index) => !variantIndices.has(index) || item.getForms(formKeys).length === 0
        );
    }

    getActiveForms() {
        if (!this.dataset.hasSetting("forms")) {
            return Object.keys(this.dataset.forms.data);
        }
        return this.dataset.getFormKeysFromSetting(this.selectorSettings.getValue("forms"));
    }

    getActiveProperties() {
        return this.gameSettings.getDefault("properties", Object.keys(this.dataset.properties));
    }


    getGame() {
        const properties = this.getActiveProperties();
        const language = this.getLanguage();
        const items = this.dataset.getQuizItems(
            this.getCheckedItems(),
            this.getActiveForms(),
            properties,
            language
        );
        const referenceItems = this.dataset.getReferenceItems(properties, language);
        const variant = this.getVariant();

        const game = new Game(this.dataset, items, properties, language, variant);
        game.setReferenceItems(referenceItems);
        return game
    }

    teardown() {
        this.selector.teardown();
        this.selectorSettings.teardown();
    }
}
