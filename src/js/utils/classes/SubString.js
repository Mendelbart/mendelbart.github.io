export default class SubString {
    /**
     * @param {string|SubString} source
     * @param {number} start
     * @param {?number} [end]
     * */
    constructor(source, start = 0, end) {
        if (source instanceof SubString) {
            start += source.start;
            end = end != null ? end + source.start : source.end;
            source = source.source;
        }

        end ??= source.length;

        this.source = source;
        this.str = source.substring(start, end);
        this.start = start;
        this.end = end;
    }

    get length() {
        return this.end - this.start;
    }

    /**
     * @param splitter
     * @param {boolean} [includeEmpty]
     * @returns {SubString[]}
     */
    split(splitter, includeEmpty = false) {
        const result = [];
        const matches = this.str.matchAll(splitter);

        let i = 0;
        for (const match of matches) {
            if (!includeEmpty && i === match.index) continue;

            result.push(new this.constructor(this, i, match.index));
            i = match.index + match[0].length;
        }

        if (includeEmpty || i < this.length) {
            result.push(new this.constructor(this, i));
        }

        return result;
    }

    /** @returns {SubString} */
    trim() {
        const startTrim = this.str.match(/^\s*/)[0].length;
        const endTrim = this.str.match(/\s*$/)[0].length;

        if (startTrim === 0 && endTrim === 0) return this;

        return new this.constructor(this.source, this.start + startTrim, this.end - endTrim);
    }
}
