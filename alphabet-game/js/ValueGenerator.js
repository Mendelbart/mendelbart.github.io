export class ValueGenerator {
    /**
     * @param {Array} values 
     * @param {number} startIndex 
     */
    constructor(values, startIndex = 0) {
        this.values = values.slice();
        this.removedValues = [];
        this.currentIndex = startIndex;
    }

    removeValue(value) {
        const index = this.values.indexOf(value);
        if (index === -1)
            console.error("Value not found in ValueGenerator.");

        this.removedValues.push(value);
        this.values.splice(index, 1);
        if (this.currentIndex > index) {
            this.currentIndex--;
        }
        if (this.currentIndex === index) {
            console.warn("Removed current value.");
        }
    }

    currentValue() {
        return this.values[this.currentIndex];
    }

    stepIndex() {
        this.currentIndex += 1;
        if (this.currentIndex === this.values.length) {
            this.currentIndex = 0;
        }
    }

    /**
     * @param {function(): number} [rand] 
     */
    shuffle(rand = Math.random) {
        RandomHelper.shuffle(this.values, rand);
    }
}

export class RandomValueGenerator extends ValueGenerator {
    /**
     * @param {Array} values 
     * @param {function(): number} [rand] 
     * @param {?number} [startIndex]
     */
    constructor(values, rand = Math.random, startIndex = null) {
        startIndex ??= RandomHelper.randInt(0, values.length);
        super(values, startIndex);
        this.rand = rand;
    }

    stepIndex(weights = null) {
        if (weights) {
            const partition = RandomHelper.unitIntervalPartitionFromWeights(weights);
            this.currentIndex = RandomHelper.bisect(partition, this.rand());
        } else {
            this.currentIndex = RandomHelper.randInt(0, this.values.length, this.rand);
        }
    }
}
