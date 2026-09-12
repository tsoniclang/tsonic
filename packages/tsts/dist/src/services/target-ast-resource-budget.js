import { HEADER_SIZE, NODE_EXTENDED_DATA_MASK, NODE_LEN, NODE_STRING_INDEX_MASK, } from "../internal/ast/generated/protocol.js";
export const defaultTargetAstEncodingLimits = Object.freeze({
    maximumNodeRows: 2_097_152,
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
    #encodedBytes = HEADER_SIZE;
    constructor(limits) {
        this.#limits = validateLimits(limits);
        this.requireEncodedBytes(this.#encodedBytes);
    }
    reserveNodeRows(count) {
        const next = reserve("target AST node rows", this.#nodeRows, count, this.#limits.maximumNodeRows);
        this.#reserveEncodedBytes(count * NODE_LEN);
        this.#nodeRows = next;
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
        const stringCount = reserve("target AST strings", this.#stringCount, 1, this.#limits.maximumStringCount);
        const stringBytes = reserve("target AST string bytes", this.#stringBytes, byteLength, this.#limits.maximumStringBytes);
        this.#reserveEncodedBytes(2 * Uint32Array.BYTES_PER_ELEMENT + byteLength);
        this.#stringCount = stringCount;
        this.#stringBytes = stringBytes;
    }
    reserveExtendedWords(count) {
        const next = reserve("target AST extended-data words", this.#extendedWords, count, this.#limits.maximumExtendedWords);
        this.#reserveEncodedBytes(count * Uint32Array.BYTES_PER_ELEMENT);
        this.#extendedWords = next;
    }
    reserveStructuredBytes(count) {
        const next = reserve("target AST structured-data bytes", this.#structuredBytes, count, this.#limits.maximumStructuredBytes);
        this.#reserveEncodedBytes(count);
        this.#structuredBytes = next;
    }
    requireEncodedBytes(count) {
        requireNonNegativeSafeInteger(count, "target AST encoded byte length");
        if (count > this.#limits.maximumEncodedBytes) {
            throw new TargetAstResourceLimitError(`target AST encoded size ${count} exceeds limit ${this.#limits.maximumEncodedBytes}`);
        }
    }
    #reserveEncodedBytes(count) {
        this.#encodedBytes = reserve("target AST encoded size", this.#encodedBytes, count, this.#limits.maximumEncodedBytes);
    }
}
function validateLimits(limits) {
    const names = Object.keys(defaultTargetAstEncodingLimits);
    if (typeof limits !== "object" || limits === null || Array.isArray(limits) ||
        Reflect.ownKeys(limits).length !== names.length) {
        throw new TargetAstResourceLimitError("target AST encoding limits require exactly the eight limit fields");
    }
    const result = { ...defaultTargetAstEncodingLimits };
    for (const name of names) {
        const descriptor = Object.getOwnPropertyDescriptor(limits, name);
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
            throw new TargetAstResourceLimitError(`${name} must be an own enumerable data field`);
        }
        const value = descriptor.value;
        requireNonNegativeSafeInteger(value, name);
        if (value === 0) {
            throw new TargetAstResourceLimitError(`${name} must be greater than zero`);
        }
        result[name] = value;
    }
    if (result.maximumEncodedBytes > 0xffff_ffff) {
        throw new TargetAstResourceLimitError("maximumEncodedBytes exceeds the uint32 wire-offset range");
    }
    const ranges = [
        ["maximumNodeRows", Math.floor(0xffff_ffff / NODE_LEN), "uint32 node-table byte range"],
        ["maximumDepth", defaultTargetAstEncodingLimits.maximumDepth, "supported recursive depth"],
        ["maximumStringCount", Math.floor((NODE_STRING_INDEX_MASK + 1) / 2), "wire string-index range"],
        ["maximumStringBytes", 0xffff_ffff, "uint32 string-table byte range"],
        ["maximumExtendedWords", Math.floor((NODE_EXTENDED_DATA_MASK + 1) / Uint32Array.BYTES_PER_ELEMENT), "wire extended-data offset range"],
        ["maximumStructuredBytes", 0xffff_ffff, "uint32 structured-data byte range"],
    ];
    for (const [name, maximum, subject] of ranges) {
        if (result[name] > maximum) {
            throw new TargetAstResourceLimitError(`${name} exceeds the ${subject} (${maximum})`);
        }
    }
    if (result.maximumSingleStringBytes > result.maximumStringBytes) {
        throw new TargetAstResourceLimitError("maximumSingleStringBytes exceeds maximumStringBytes");
    }
    return Object.freeze(result);
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