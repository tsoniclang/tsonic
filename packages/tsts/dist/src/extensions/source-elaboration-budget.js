export class SourceElaborationBudget {
    #limits;
    #rows = 0;
    #codeUnits = 0;
    #failed = false;
    constructor(limits) {
        this.#limits = limits;
    }
    reserve(rows, codeUnits) {
        if (this.#failed || !Number.isSafeInteger(rows) || rows < 0 || !Number.isSafeInteger(codeUnits) || codeUnits < 0 ||
            rows > this.#limits.maximumDataRows - this.#rows ||
            codeUnits > this.#limits.maximumDataCodeUnits - this.#codeUnits) {
            this.#failed = true;
            throw new Error("Source elaboration exceeds its aggregate evidence budget.");
        }
        this.#rows += rows;
        this.#codeUnits += codeUnits;
    }
}
//# sourceMappingURL=source-elaboration-budget.js.map