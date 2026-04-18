import {RandomNumberGenerator} from "../utils";
import {avg, range} from "../utils/array";

export default class QuizDealer {
    clearScore = 0.75

    /**
     * @param {QuizItem[]} items
     * @param {number} [poolSize]
     * @param {number} [maxRounds]
     * @param {number} [patience]
     */
    constructor(items, {
        poolSize = 5,
        maxRounds = 3,
        maxTriesPerRound = 4
    } = {}) {
        this.items = items;
        this.poolSize = poolSize;
        this.maxRounds = maxRounds;
        this.maxTriesPerRound = maxTriesPerRound;

        /** @type {{index: number, score: number, tries: number}[]} */
        this.pool = [];
        this.cue = range(this.items.length);
        this.rng = new RandomNumberGenerator();

        /** @type {{totalScore: number, rounds: number, finished: boolean}[]} */
        this.itemData = this.items.map(() => {return {totalScore: 0, rounds: 0, finished: false}});

        this._refillPool();
    }

    /**
     * @param {number} poolIndex
     * @private
     */
    _replacePoolElement(poolIndex) {
        if (this._cueEmpty()) {
            this.pool.splice(poolIndex, 1);
            return;
        }

        const cueIndex = this.rng.randIndexWeighted(this.cue.map(index => this._cueItemWeight(index)));
        this.pool[poolIndex] = this._poolElement(this.cue[cueIndex]);
        this.cue.splice(cueIndex, 1);
    }

    /**
     * @param index
     * @returns {{index: number, score: number, tries: number}}
     * @private
     */
    _poolElement(index) {
        return {index: index, score: 0, tries: 0};
    }

    /**
     * @returns {boolean}
     * @private
     */
    _cueEmpty() {
        return this.cue.length === 0;
    }

    /** @private */
    _updatePool() {
        const elem = this._currentPoolElement;
        if (elem.score >= 0.75 + 0.25 * elem.tries || elem.tries >= this.maxTriesPerRound) {
            const index = this._currentIndex;
            this.itemData[index].totalScore += elem.score / elem.tries;
            this.itemData[index].rounds += 1;
            if (this._isFinished(index)) {
                this.itemData[index].finished = true;
            } else {
                this.cue.push(index);
            }

            this._replacePoolElement(this._currentPoolIndex);
        }
    }

    /**
     * @param {number} index
     * @returns {boolean}
     * @private
     */
    _isFinished(index) {
        const {totalScore, rounds} = this.itemData[index];
        return totalScore >= this.clearScore * rounds || rounds >= this.maxRounds;
    }

    /**
     * @param {number} itemIndex
     * @returns {number}
     * @private
     */
    _cueItemWeight(itemIndex) {
        const {totalScore, rounds} = this.itemData[itemIndex];
        return rounds === 0 ? 1 : (2 - totalScore / rounds);
    }

    /**
     * @param {number} poolScore
     * @returns {number}
     * @private
     */
    _poolElementWeight(poolScore) {
        return (2 - poolScore);
    }

    isEmpty() {
        return this.pool.length === 0 || this.pool.length === 1 && this.pool[0].index === this._currentIndex;
    }

    /**
     * @returns {QuizItem}
     */
    nextItem() {
        if (this.isEmpty()) throw new Error("Dealer is empty.");

        this._lastIndex = this._currentIndex;
        const weights = this.pool.map(
            ({index, score}) => index === this._lastIndex ? 0 : this._poolElementWeight(score)
        );
        this._currentPoolIndex = this.rng.randIndexWeighted(weights);
        this._currentIndex = this.pool[this._currentPoolIndex].index;
        return this.currentItem;
    }

    /**
     * @returns {QuizItem}
     */
    get currentItem() {
        return this.items[this._currentIndex];
    }

    /**
     * @returns {{index: number, score: number, tries: number}}
     * @private
     */
    get _currentPoolElement() {
        return this.pool[this._currentPoolIndex];
    }

    /**
     * @param {number} score - A number in [0,1]
     */
    submitScore(score) {
        const elem = this._currentPoolElement;
        elem.score += score;
        elem.tries += 1;
        this._updatePool();
    }

    /**
     * @param {QuizItem} item
     */
    punish(item) {
        const index = this.items.indexOf(item);
        if (index === -1) throw new Error("Item not found.");

        const data = this.itemData[index];
        data.totalScore -= 1 / this.maxTriesPerRound;
        if (data.finished && !this._isFinished(index)) {
            data.finished = false;
            this.cue.push(index);
            this._refillPool();
        }
    }

    _refillPool() {
        while (this.pool.length < this.poolSize && !this._cueEmpty()) {
            this.pool.push(undefined);
            this._replacePoolElement(this.pool.length - 1);
        }
    }

    getScores() {
        return this.itemData.map(({totalScore, rounds}) => rounds === 0 ? 0 : totalScore / rounds);
    }

    totalScore() {
        return avg(this.getScores());
    }

    /**
     * @returns {number}
     */
    progress() {
        return avg(this.itemData.map(({totalScore, rounds, finished}) => {
            if (finished) return 1;
            if (rounds === 0) return 0;
            return Math.max(totalScore / rounds, rounds / this.maxRounds);
        }));
    }
}
