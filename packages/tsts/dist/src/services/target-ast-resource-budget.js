export const defaultTargetAstEncodingLimits = Object.freeze({
    maximumNodeRows: 1_048_576,
    maximumDepth: 1_024,
    maximumStringCount: 1_048_576,
    maximumStringBytes: 256 * 1024 * 1024,
    maximumSingleStringBytes: 64 * 1024 * 1024,
    maximumExtendedWords: 4_194_304,
    maximumStructuredBytes: 16 * 1024 * 1024,
    maximumEncodedBytes: 512 * 1024 * 1024,
});
export class TargetAstResourceLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = "TargetAstResourceLimitError";
    }
}
export class TargetAstResourceBudget {
    #limits;
    #nodeRows = 0;
    #stringCount = 0;
    #stringBytes = 0;
    #extendedWords = 0;
    #structuredBytes = 0;
    constructor(limits) {
        this.#limits = validateLimits(limits);
    }
    reserveNodeRows(count) {
        this.#nodeRows = reserve("target AST node rows", this.#nodeRows, count, this.#limits.maximumNodeRows);
    }
    requireDepth(depth) {
        requireNonNegativeSafeInteger(depth, "target AST depth");
        if (depth > this.#limits.maximumDepth) {
            throw new TargetAstResourceLimitError(`target AST depth ${depth} exceeds limit ${this.#limits.maximumDepth}`);
        }
    }
    reserveString(byteLength) {
        requireNonNegativeSafeInteger(byteLength, "target AST string byte length");
        if (byteLength > this.#limits.maximumSingleStringBytes) {
            throw new TargetAstResourceLimitError(`target AST string size ${byteLength} exceeds per-string limit ${this.#limits.maximumSingleStringBytes}`);
        }
        this.#stringCount = reserve("target AST strings", this.#stringCount, 1, this.#limits.maximumStringCount);
        this.#stringBytes = reserve("target AST string bytes", this.#stringBytes, byteLength, this.#limits.maximumStringBytes);
    }
    reserveExtendedWords(count) {
        this.#extendedWords = reserve("target AST extended-data words", this.#extendedWords, count, this.#limits.maximumExtendedWords);
    }
    reserveStructuredBytes(count) {
        this.#structuredBytes = reserve("target AST structured-data bytes", this.#structuredBytes, count, this.#limits.maximumStructuredBytes);
    }
    requireEncodedBytes(count) {
        requireNonNegativeSafeInteger(count, "target AST encoded byte length");
        if (count > this.#limits.maximumEncodedBytes) {
            throw new TargetAstResourceLimitError(`target AST encoded size ${count} exceeds limit ${this.#limits.maximumEncodedBytes}`);
        }
    }
}
function validateLimits(limits) {
    for (const [name, value] of Object.entries(limits)) {
        requireNonNegativeSafeInteger(value, name);
        if (value === 0) {
            throw new TargetAstResourceLimitError(`${name} must be greater than zero`);
        }
    }
    if (limits.maximumEncodedBytes > 0xffff_ffff) {
        throw new TargetAstResourceLimitError("maximumEncodedBytes exceeds the uint32 wire-offset range");
    }
    return Object.freeze({ ...limits });
}
function reserve(subject, current, count, limit) {
    requireNonNegativeSafeInteger(count, `${subject} reservation`);
    const next = current + count;
    if (!Number.isSafeInteger(next) || next > limit) {
        throw new TargetAstResourceLimitError(`${subject} ${Number.isSafeInteger(next) ? next : "overflow"} exceeds limit ${limit}`);
    }
    return next;
}
function requireNonNegativeSafeInteger(value, subject) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TargetAstResourceLimitError(`${subject} must be a non-negative safe integer`);
    }
}
//# sourceMappingURL=target-ast-resource-budget.js.map