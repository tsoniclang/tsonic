export const IgnoreCase = (options) => {
    options.sensitivity = "base";
};
export const Loose = (options) => {
    options.usage = "search";
};
export const Numeric = (options) => {
    options.numeric = true;
};
export class Collator {
    collator;
    constructor(tag, options) {
        this.collator = new Intl.Collator(tag === "" ? undefined : tag, options);
    }
    CompareString(left, right) {
        return this.collator.compare(left, right);
    }
}
export function New(tag, ...options) {
    const collatorOptions = {};
    for (const option of options) {
        option(collatorOptions);
    }
    return new Collator(tag, collatorOptions);
}
//# sourceMappingURL=collate.js.map