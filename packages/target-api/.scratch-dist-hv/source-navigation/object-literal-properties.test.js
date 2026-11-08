import assert from "node:assert/strict";
import test from "node:test";
import { ObjectLiteralProperty_SourceName } from "../source-model/ast.js";
test("object-literal property names preserve exact authored key semantics", () => {
    const identifier = node("identifier", "value");
    const stringLiteral = node("string", "quoted");
    const numericLiteral = node("numeric", "0x10");
    const separatedNumericLiteral = node("numeric", "1_000");
    const nonFiniteNumericLiteral = node("numeric", "1e999");
    const computed = node("computed", "ignored");
    const properties = [
        property(identifier),
        property(stringLiteral),
        property(numericLiteral),
        property(separatedNumericLiteral),
        property(nonFiniteNumericLiteral),
        property(computed),
        property(undefined),
    ];
    const reader = ast();
    assert.deepEqual(properties.map((value) => ObjectLiteralProperty_SourceName(reader, value)), [
        { kind: "resolved", name: "value" },
        { kind: "resolved", name: "quoted" },
        { kind: "resolved", name: "16" },
        { kind: "resolved", name: "1000" },
        { kind: "rejected", reason: "non-finite-numeric-literal" },
        { kind: "rejected", reason: "unsupported-name-kind" },
        { kind: "rejected", reason: "missing-name" },
    ]);
});
function ast() {
    return {
        name: (value) => value.propertyName,
        text: (value) => value.text,
        is: {
            IsIdentifier: (value) => value.kind === "identifier",
            IsStringLiteral: (value) => value.kind === "string",
            IsNumericLiteral: (value) => value.kind === "numeric",
        },
    };
}
function node(kind, text) {
    return { kind, text };
}
function property(propertyName) {
    return { propertyName };
}
//# sourceMappingURL=object-literal-properties.test.js.map