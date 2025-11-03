import {RandomHelper, ArrayHelper} from "../helpers/helpers.js";

export class ItemDealer {
    punishFactor = 2
    manualPunish = 1
    previousDampFactor = 0.5

    /**
     *
     * @param {any[]} items
     */
    constructor(items) {
        this.items = items;
        this.rand = Math.random;

        const n = this.itemCount = items.length;
        this.hitCount = 0;

        this.scores = new Array(n).fill(0);
        this.tries = new Array(n).fill(0);
        this.triesLeft = new Array(n).fill(1);

        this.totalTriesLeft = n;
        this.maxTriesLeft = n;

        this.currentIndex = RandomHelper.randInt(0, n, this.rand);
        this.previousIndex = null;
    }

    /**
     * @param {string} seed
     */
    seed(seed) {
        this.rand = RandomHelper.seededPRNG(seed);
    }

    currentItem() {
        return this.items[this.currentIndex];
    }

    nextItem() {
        this.previousIndex = this.currentIndex;
        this.currentIndex = RandomHelper.randIndexFromWeights(this.getWeights(), this.rand);
        return this.currentItem();
    }

    getWeights() {
        const weights = this.triesLeft.slice();
        if (this.previousIndex !== null) {
            weights[this.previousIndex] *= this.previousDampFactor;
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

        this.triesLeft[this.currentIndex] += this.triesBoost(score) - 1;
        if (this.triesLeft[this.currentIndex] <= 0) {
            this.triesLeft[this.currentIndex] = 0;
            this.itemCount--;
        }

        this.updateTotalTriesLeft();
    }

    isEmpty() {
        return this.itemCount === 0;
    }

    triesBoost(score) {
        return this.punishFactor * (1 - score);
    }

    scoreAtTryFactor(tryIndex) {
        return 1 / tryIndex;
    }

    punish(item) {
        this.triesLeft[this.items.indexOf(item)] += this.manualPunish;
    }

    absoluteScore() {
        return ArrayHelper.sum(this.scores);
    }

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

function formatPercent(x, digits = 0) {
    return String(floor(x * 100, digits)) + "%"
}

function floor(x, digits = 0, factor = 1) {
    const digits_multiplier = Math.pow(10, digits) * factor;
    return Math.floor(x * digits_multiplier) / digits_multiplier;
}
