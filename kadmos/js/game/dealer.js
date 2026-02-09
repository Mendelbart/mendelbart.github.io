import {RandomNumberGenerator, ArrayHelper} from "../helpers/helpers.js";

export class ItemDealer {
    _punishFactor = 2
    _manualPunish = 1
    _previousDampFactor = 0.5

    /**
     *
     * @param {any[]} items
     */
    constructor(items) {
        this.items = items;
        this.rng = new RandomNumberGenerator();

        const n = this.itemCount = items.length;
        this.hitCount = 0;

        /** @type {number[]} */
        this.scores = new Array(n).fill(0);
        /** @type {number[]} */
        this.tries = new Array(n).fill(0);
        /** @type {number[]} */
        this.triesLeft = new Array(n).fill(1);

        this.totalTriesLeft = n;
        this.maxTriesLeft = n;

        this.currentIndex = this.rng.randInt(0, n);
        /** @type {?number} */
        this.previousIndex = null;
    }

    /**
     * @param {string} seed
     */
    seed(seed) {
        this.rng.seed(seed);
    }

    currentItem() {
        return this.items[this.currentIndex];
    }

    nextItem() {
        this.previousIndex = this.currentIndex;
        this.currentIndex = this.rng.randIndexFromWeights(this.getWeights());
        return this.currentItem();
    }

    /**
     * @returns {number[]}
     */
    getWeights() {
        const weights = this.triesLeft.slice();
        if (this.previousIndex !== null) {
            weights[this.previousIndex] *= this._previousDampFactor;
        }
        return weights;
    }

    updateTotalTriesLeft() {
        const val = ArrayHelper.sum(Object.values(this.triesLeft))
        if (val > this.totalTriesLeft) {
            this.maxTriesLeft += val - this.totalTriesLeft;
        }
        this.totalTriesLeft = val;
    }

    /**
     * @returns {number}
     */
    progress() {
        return 1 - this.totalTriesLeft / this.maxTriesLeft;
    }

    /**
     * Set the score of the current item.
     * @param score
     */
    enterScore(score) {
        const tryIndex = ++this.tries[this.currentIndex];

        if (tryIndex === 1) {
            this.hitCount++;
        }

        this.scores[this.currentIndex] = Math.max(
            this.scores[this.currentIndex],
            score * this.scoreAtTryFactor(tryIndex)
        );

        this.triesLeft[this.currentIndex] += this._triesBoost(score) - 1;
        if (this.triesLeft[this.currentIndex] <= 0) {
            this.triesLeft[this.currentIndex] = 0;
            this.itemCount--;
        }

        this.updateTotalTriesLeft();
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this.itemCount === 0;
    }

    /**
     * @private
     * @param {number} score
     * @returns {number}
     */
    _triesBoost(score) {
        return this._punishFactor * (1 - score);
    }

    /**
     * @param tryIndex
     * @returns {number}
     */
    scoreAtTryFactor(tryIndex) {
        return 1 / tryIndex;
    }

    /**
     * @param item
     * @returns {number}
     */
    getItemIndex(item) {
        return this.items.indexOf(item);
    }

    /**
     * @param {number} index
     * @param {number} [factor=1]
     */
    punish(index, factor = 1) {
        this.triesLeft[index] += this._manualPunish * factor;
    }

    /**
     * @returns {number}
     */
    absoluteScore() {
        return ArrayHelper.sum(this.scores);
    }

    /**
     * @param {"ratio"|"percent"|"both"} mode
     * @returns {string}
     */
    scoreString(mode = "ratio") {
        const score = this.absoluteScore();
        const ratioString = `${floor(score, 1, 2)}/${this.hitCount}`;
        const percentString = this.hitCount > 0 ? formatPercent(score / this.hitCount) : formatPercent(0);
        if (mode === "ratio") {
            return ratioString;
        } else if (mode === "percent") {
            return percentString;
        } else if (mode === "both") {
            return `${ratioString} (${percentString})`;
        } else {
            console.error(`Unknown mode: ${mode}`);
        }
    }
}

/**
 * @param {number} x
 * @param {number} digits
 * @returns {string}
 */
function formatPercent(x, digits = 0) {
    return String(floor(x * 100, digits)) + "%"
}

/**
 * @param {number} x
 * @param {number} digits
 * @param {number} factor
 * @returns {number}
 */
function floor(x, digits = 0, factor = 1) {
    const digits_multiplier = Math.pow(10, digits) * factor;
    return Math.floor(x * digits_multiplier) / digits_multiplier;
}
