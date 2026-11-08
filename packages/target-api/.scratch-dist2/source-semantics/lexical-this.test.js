import assert from "node:assert/strict";
import test from "node:test";
import { sourceCallableUsesLexicalThis, sourceExpressionUsesLexicalThis } from "./lexical-this.js";
test("lexical-this selection enters arrows and stops at independent callables", () => {
    const directThis = node("KindThisKeyword");
    const arrowThis = node("KindThisKeyword");
    const nestedFunctionThis = node("KindThisKeyword");
    const method = node("KindMethodDeclaration", [
        node("KindBlock", [
            directThis,
            node("KindArrowFunction", [node("KindBlock", [arrowThis])]),
            node("KindFunctionExpression", [
                node("KindBlock", [nestedFunctionThis]),
            ]),
        ]),
    ]);
    assert.equal(sourceCallableUsesLexicalThis(ast(), method), true);
});
test("lexical-this selection ignores this owned by nested functions and classes", () => {
    const method = node("KindMethodDeclaration", [
        node("KindBlock", [
            node("KindFunctionExpression", [
                node("KindBlock", [node("KindThisKeyword")]),
            ]),
            node("KindClassDeclaration", [
                node("KindMethodDeclaration", [
                    node("KindBlock", [node("KindThisKeyword")]),
                ]),
            ]),
        ]),
    ]);
    assert.equal(sourceCallableUsesLexicalThis(ast(), method), false);
});
test("expression receiver selection retains lexical arrows without mistaking independent roots", () => {
    assert.equal(sourceExpressionUsesLexicalThis(ast(), node("KindThisKeyword")), true);
    assert.equal(sourceExpressionUsesLexicalThis(ast(), node("KindArrowFunction", [node("KindThisKeyword")])), true);
    for (const kind of ["KindFunctionDeclaration", "KindFunctionExpression", "KindMethodDeclaration",
        "KindGetAccessor", "KindSetAccessor", "KindClassDeclaration", "KindClassExpression"]) {
        const independent = node(kind, [node("KindThisKeyword")]);
        assert.equal(sourceExpressionUsesLexicalThis(ast(), independent), false);
        assert.equal(sourceExpressionUsesLexicalThis(ast(), node("KindObjectLiteralExpression", [independent])), false);
    }
    assert.equal(sourceExpressionUsesLexicalThis(ast(), node("KindObjectLiteralExpression", [
        node("KindMethodDeclaration", [node("KindThisKeyword")]), node("KindArrowFunction", [node("KindThisKeyword")]),
    ])), true);
});
function node(kind, children = []) {
    return { kind, children };
}
function ast() {
    return {
        body(value) {
            if (value === undefined) {
                return undefined;
            }
            return value
                .children[0];
        },
        children(value) {
            if (value === undefined) {
                return [];
            }
            return value
                .children;
        },
        kindName(value) {
            if (value === undefined) {
                return "KindUnknown";
            }
            return value.kind;
        },
    };
}
//# sourceMappingURL=lexical-this.test.js.map