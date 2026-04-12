import FunctionSet from "./FunctionSet";

export default class Observable {
    constructor() {
        this.observers = new FunctionSet();
        this.callObservers = this.callObservers.bind(this);
    }

    callObservers() {
        this.observers.call(...this.observerArgs());
    }

    /**
     * @returns {any[]}
     */
    observerArgs() {
        return [];
    }

    teardown() {
        this.observers.clear();
    }
}
