import {FunctionStack} from "./FunctionStack";


export class SizeWatcher {
    constructor() {
        /**
         * @type {WeakMap<HTMLElement, ResizeObserverSize>}
         */
        this.sizes = new WeakMap();

        this.updateSize = this.updateSize.bind(this);
        this.updateListeners = new FunctionStack();

        this.observer = new ResizeObserver(entries => {
            entries.forEach(this.updateSize);
            this.updateListeners.call(this, entries.map(entry => entry.target));
        });
    }

    /**
     * @param {Iterable<HTMLElement>} elements
     */
    watch(elements) {
        for (const element of elements) {
            this.observer.observe(element);
        }
    }

    /**
     * @param {Iterable<HTMLElement>} elements
     */
    unwatch(elements) {
        for (const element of elements) {
            this.observer.unobserve(element);
            if (this.sizes.has(element)) {
                this.sizes.delete(element);
            }
        }
    }

    /**
     * @param {ResizeObserverEntry} entry
     */
    updateSize(entry) {
        this.sizes.set(entry.target, entry.contentBoxSize[0]);
    }

    /**
     * @param {HTMLElement} element
     */
    getSize(element) {
        return this.sizes.get(element);
    }

    teardown() {
        this.observer.disconnect();
        this.updateListeners.clear();
    }
}


export class ElementFitter {
    /**
     * @param {?SizeWatcher} watcher
     * @param {number} [uniformFactor=Infinity]
     * @param {"width" | "height" | "both"} dimension
     */
    constructor({
        watcher = null,
        uniformFactor = Infinity,
        dimension = "width"
    } = {}) {
        this.watcher = watcher ?? new SizeWatcher();
        this.updateParents = this.updateParents.bind(this);
        this.watcher.updateListeners.push(this.updateParents.bind(this));

        this.dimension = dimension;
        this.uniformFactor = uniformFactor;

        /**
         * @type {Map<HTMLElement, number>}
         */
        this.scales = new Map();
        this.minScale = Infinity;
        this.maxScale = -Infinity;

        /**
         * @type {WeakMap<HTMLElement, Set<HTMLElement>>}
         */
        this.childrenFromParent = new WeakMap();
    }

    /**
     * @param {HTMLElement[]} children
     */
    fit(children) {
        this._add(children);
        this.updateChildren(children);
    }

    /**
     * @param {HTMLElement[]} children
     * @private
     */
    _add(children) {
        for (const child of children) {
            const parent = child.parentElement;
            if (!this.childrenFromParent.has(parent)) {
                this.childrenFromParent.set(parent, new Set());
            }
            this.childrenFromParent.get(parent).add(child);
        }

        this.watcher.watch(children.map(child => child.parentElement));
    }

    /**
     * @param {HTMLElement[]} parents
     */
    updateParents(parents) {
        this.updateChildren(parents.map(parent => Array.from(this.childrenFromParent.get(parent))).flat())
    }

    /**
     * @param {?(HTMLElement[])} [children = null]
     */
    updateChildren(children = null) {
        const prevMin = this.minScale;
        const prevMax = this.maxScale;

        if (children) {
            for (const child of children) {
                this._updateScale(child);
            }
        } else {
            this.scales.forEach((_, child) => {
                this._updateScale(child);
            });
        }

        if (!children || (
                (this.minScale !== prevMin || this.maxScale !== prevMax)
                && (this.uniformityActive() || this.uniformityActive(prevMin, prevMax))
            )) {
            this._applyAllScales();
        } else {
            this._applyScales(children);
        }
    }

    /**
     * @param min
     * @param max
     * @returns {boolean}
     */
    uniformityActive(min = this.minScale, max = this.maxScale) {
        return max / min > this.uniformFactor;
    }

    /**
     * @param {HTMLElement} child
     * @private
     */
    _updateScale(child) {
        const parentSize = this.watcher.getSize(child.parentElement);
        if (!parentSize) {
            return;
        }

        const scale = computeScale(child, parentSize, this.dimension);

        if (scale === null) {
            return;
        }

        this.scales.set(child, scale);

        if (scale > 0 && scale < this.minScale) {
            this.minScale = scale;
        } else if (scale > this.maxScale) {
            this.maxScale = scale;
        }
    }

    /**
     * @param {HTMLElement} child
     * @param {?number} [scale=null]
     * @private
     */
    _applyScale(child, scale = null) {
        scale ??= this.scales.get(child);
        child.style.scale = Math.min(scale, this.minScale * this.uniformFactor);
    }

    /**
     * @param {HTMLElement[]} children
     * @private
     */
    _applyScales(children) {
        for (const child of children) {
            this._applyScale(child);
        }
    }

    /**
     * @private
     */
    _applyAllScales() {
        for (const [child, scale] of this.scales) {
            this._applyScale(child, scale);
        }
    }

    teardown() {
        this.scales.clear();
        this.watcher.updateListeners.remove(this.updateParents);
    }
}


/**
 * @param {HTMLElement} child
 * @param {ResizeObserverSize} parentSize
 * @param {"width" | "height" | "both"} dimension
 */
function computeScale(child, parentSize, dimension) {
    if (!["width", "height", "both"].includes(dimension)) {
        throw new Error(`Invalid scale dimension ${dimension}.`);
    }

    let scale = 1;

    if (dimension === "both" || dimension === "width") {
        const widthScale = getScale(child.offsetWidth, parentSize.inlineSize);
        if (widthScale === null) return null;
        scale = Math.min(scale, widthScale);
    }

    if (dimension === "both" || dimension === "height") {
        const heightScale = getScale(child.offsetHeight, parentSize.blockSize);
        if (heightScale === null) return null;
        scale = Math.min(scale, heightScale);
    }

    return scale;
}


/**
 * @param {number} elementSize
 * @param {number} containerSize
 * @param {boolean} [grow=false]
 * @returns {number|number|null}
 */
function getScale(elementSize, containerSize, grow = false) {
    if (elementSize === 0 || isNaN(elementSize) || isNaN(containerSize)) {
        return null;
    }

    const scale = containerSize / elementSize;

    return grow ? scale : Math.min(scale, 1);
}
