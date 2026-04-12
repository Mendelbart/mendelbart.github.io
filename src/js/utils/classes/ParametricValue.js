class ValueNode {
    /**
     * @param {number|ValueNode} value
     * @param {boolean} [isRoot]
     * @param {Record<string, ValueNode>} [children]
     */
    constructor(value, isRoot = false, children = {}) {
        this.default = value;
        this.isRoot = isRoot;
        this.children = children;
    }

    hasDefaultNode() {
        return typeof this.default !== 'number';
    }

    getDefault() {
        return this.hasDefaultNode() ? this.default.getDefault() : this.default;
    }

    setDefault(value) {
        if (!this.hasDefaultNode()) {
            this.default = value;
        } else {
            this.default.setDefault(value);
        }
    }

    setChild(key, value) {
        this.children[key] = value;
    }

    getChild(key) {
        return this.children[key];
    }

    hasChild(key) {
        return key in this.children;
    }

    /**
     * @param {string} [defaultKey="default"]
     * @param {function(number): any} [callback]
     * @returns {any | Record<string, any>}
     */
    serialize(defaultKey = "default", callback) {
        const defaultObject = this.hasDefaultNode()
            ? this.default.serialize(defaultKey, callback)
            : callback ? callback(this.default) : this.default;
        if (Object.keys(this.children).length === 0) return defaultObject;

        const obj = {};
        obj[defaultKey] = defaultObject;
        for (const [key, node] of Object.entries(this.children)) {
            obj[key] = node.serialize(defaultKey, callback);
        }
        return obj;
    }
}


export default class ParametricValue {
    /**
     * @param {string[]} paramKeys
     * @param {any} defaultValue
     */
    constructor(paramKeys, defaultValue = null) {
        this.paramKeys = paramKeys;
        this.root = new ValueNode(0, true);
        this.values = [defaultValue];
    }

    set(params, value) {
        const node = this._getNode(params, true);

        if (node.isRoot) {
            this.values[node.getDefault()] = value;
        } else {
            node.isRoot = true;
            node.setDefault(this.values.length);
            this.values.push(value);
        }
    }

    get(params) {
        return this.values[this._getNode(params).getDefault()];
    }

    _paramLevel(params) {
        for (let i = this.paramKeys.length - 1; i >= 0; i--) {
            if (this.paramKeys[i] in params) return i + 1;
        }

        return 0;
    }

    _getNode(params, createNodes = false) {
        let node = this.root;
        const level = this._paramLevel(params);
        let done;

        for (const [i, key] of this.paramKeys.entries()) {
            if (i >= level) return node;

            [node, done] = this._getParamNode(node, params, key, createNodes);
            if (done) return node;
        }

        return node;
    }

    /**
     * @param {ValueNode} node
     * @param {Record<string, string>} params
     * @param {string} key
     * @param {boolean} createNodes
     * @returns {[ValueNode, boolean]}
     * @private
     */
    _getParamNode(node, params, key, createNodes = false) {
        if (key in params) {
            const paramVal = params[key];
            if (createNodes && !node.hasChild(paramVal)) {
                node.setChild(paramVal, new ValueNode(node.getDefault()));
            }

            if (paramVal in node.children) {
                return [node.getChild(paramVal), false];
            }
        }

        if (createNodes && !node.hasDefaultNode()) {
            node.default = new ValueNode(node.default);
        }

        return node.hasDefaultNode() ? [node.default, false] : [node, true];
    }

    toObject(defaultKey = "default") {
        return this.root.serialize(defaultKey, i => this.values[i]);
    }
}
