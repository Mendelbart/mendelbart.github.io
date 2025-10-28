import {ObjectHelper as OH, ArrayHelper as AH} from "../helpers/helpers.js";

export class Filterer {

    /**
     * @param {string[]} items
     * @param {Record<string, Record<string, string[]>>} filters
     * @param {"additive"|"subtractive"} mode
     */
    constructor(items, filters, mode = "subtractive") {
        this.items = items;
        this.filters = filters;
        this.initialValue = mode === "subtractive";

        this.filterStates = this.initialStates();
        this.active = this.initialActive();
    }

    /**
     * @returns {Object<string, Record<string, boolean>>}
     */
    initialStates() {
        return OH.map(this.filters,
        filter => OH.map(filter, () => this.initialValue)
        );
    }

    /**
     * @returns {Record<string,boolean>}
     */
    initialActive() {
        return Object.fromEntries(this.items.map(item => [item, this.initialValue]));
    }

    reset() {
        this.resetFilterStates()
        this.resetActiveItems()
    }

    resetFilterStates() {
        for (const state of Object.values(this.filterStates)) {
            for (const item in state) {
                state[item] = this.initialValue;
            }
        }
    }

    resetActiveItems() {
        for (const item of this.items) {
            this.active[item] = this.initialValue;
        }
    }

    updateActiveItems() {
        this.resetActiveItems();
        for (const [filterKey, state] of Object.entries(this.filterStates)) {
            for (const [key, isActive] of Object.entries(state)) {
                if (this.initialValue !== isActive) {
                    for (const item of this.filters[filterKey][key]) {
                        this.active[item] = isActive;
                    }
                }
            }
        }
    }

    updateFilterState(filterKey, data) {
        this.filterStates[filterKey] = data;
        this.updateActiveItems();
    }

    activeCount() {
        return AH.sum(Object.values(this.active).map(b => +b));
    }

    activeItemsList() {
        return OH.filterKeys(this.active, x => x);
    }
}