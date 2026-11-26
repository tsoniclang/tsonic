export class DeclaredIndexReadSource {
    annotation;
    receiver;
    index;
    result;
    kind = "declared-index-read";
    #declaration;
    constructor(annotation, receiver, index, declaration, result) {
        this.annotation = annotation;
        this.receiver = receiver;
        this.index = index;
        this.result = result;
        this.#declaration = declaration;
        Object.freeze(this);
    }
    get declaration() {
        return this.#declaration;
    }
    static retain(annotation, receiver, index, declaration, result) {
        return new DeclaredIndexReadSource(annotation, receiver, index, declaration, result);
    }
    static owns(value) {
        return #declaration in value;
    }
}
export function hasDeclaredIndexReadEvidence(value) {
    return typeof value === "object" && value !== null && DeclaredIndexReadSource.owns(value);
}
//# sourceMappingURL=declared-index-evidence.js.map