import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { isSourceCallableBodyBoundary, sourceNodeRoles } from "./callable-boundaries.js";
import { sourceReceiverBoundary } from "../source-navigation/receiver-owner.js";
const sourceText = `
function declared(): number { return 1; }
const expression = function (): number { return 2; };
const arrow = (): number => 3;
const literal = { method(): number { return 4; }, get value(): number { return 5; }, set value(next: number) {} };
class Owner {
  field = 9;
  static { const inside = 6; }
  constructor() {}
  method(): number { return 7; }
  get current(): number { return 8; }
  set current(next: number) {}
}
const Local = class {};
interface Shape { method(): number; }
export { declared, expression, arrow, literal, Owner, Local };
export type { Shape };
`;
function fixture() {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
    const { ast } = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.equal(file !== undefined, true);
    const byKind = new Map();
    const visit = (node) => {
        const kind = ast.kindName(node);
        byKind.set(kind, [...(byKind.get(kind) ?? []), node]);
        ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(file);
    return { ast, byKind, file: file };
}
test("callable body boundaries are exactly the seven callable declaration and expression kinds", () => {
    const { ast, byKind } = fixture();
    const boundaries = [...byKind].filter(([, nodes]) => nodes.every(node => isSourceCallableBodyBoundary(ast, node)))
        .map(([kind]) => kind).sort();
    assert.deepEqual(boundaries, [
        "KindArrowFunction", "KindConstructor", "KindFunctionDeclaration", "KindFunctionExpression",
        "KindGetAccessor", "KindMethodDeclaration", "KindSetAccessor",
    ]);
    for (const [kind, nodes] of byKind) {
        assert.equal(nodes.every(node => isSourceCallableBodyBoundary(ast, node)) ||
            nodes.every(node => !isSourceCallableBodyBoundary(ast, node)), true, kind);
    }
    assert.equal(byKind.get("KindMethodDeclaration")?.length, 2, "object-literal and class methods are both boundaries");
    assert.equal(byKind.get("KindGetAccessor")?.length, 2);
    for (const kind of ["KindClassStaticBlockDeclaration", "KindClassDeclaration", "KindClassExpression", "KindMethodSignature", "KindBlock"]) {
        assert.equal((byKind.get(kind)?.length ?? 0) > 0, true, `${kind} occurs in the fixture`);
        assert.equal(byKind.get(kind).some(node => isSourceCallableBodyBoundary(ast, node)), false, kind);
    }
});
// G11 role grid (CASE-MAPS RM-1..RM-7, E13): the callable purposes per syntax form, computed additively, and the
// receiver boundary as a separate question. Row = syntax form; columns = the purposes it holds.
test("callable purposes are additive per syntax form and the receiver boundary is a separate question", () => {
    const { ast, byKind, file } = fixture();
    const purposes = new Set([
        "callable-body", "callable-signature", "execution-barrier", "deferred-execution", "type-parameter-owner",
    ]);
    const callableRoles = (node) => sourceNodeRoles(ast, node).filter(role => purposes.has(role));
    const owned = ["callable-body", "callable-signature", "execution-barrier"];
    const closure = [...owned, "deferred-execution"];
    const only = (kind, index = 0) => {
        const node = byKind.get(kind)?.[index];
        assert.equal(node !== undefined, true, kind);
        return node;
    };
    const objectLiteralMember = (kind) => byKind.get(kind).find(node => ast.kindName(ast.parent(node)) === "KindObjectLiteralExpression");
    const classMember = (kind) => byKind.get(kind).find(node => ast.kindName(ast.parent(node)) === "KindClassDeclaration");
    const grid = [
        ["function declaration", only("KindFunctionDeclaration"), owned, "callable"],
        ["function expression", only("KindFunctionExpression"), closure, "callable"],
        ["arrow", only("KindArrowFunction"), closure, undefined],
        ["object-literal method", objectLiteralMember("KindMethodDeclaration"), closure, "callable"],
        ["object-literal getter", objectLiteralMember("KindGetAccessor"), closure, "callable"],
        ["object-literal setter", objectLiteralMember("KindSetAccessor"), closure, "callable"],
        ["class method", classMember("KindMethodDeclaration"), owned, "callable"],
        ["constructor", only("KindConstructor"), owned, "callable"],
        ["class getter", classMember("KindGetAccessor"), owned, "callable"],
        ["class setter", classMember("KindSetAccessor"), owned, "callable"],
        ["class static block", only("KindClassStaticBlockDeclaration"), ["execution-barrier"], "static-block"],
        ["class field initializer", only("KindPropertyDeclaration"), [], "field"],
        ["method signature", only("KindMethodSignature"), ["callable-signature"], undefined],
        ["module", file, [], "module"],
    ];
    for (const [form, node, expected, receiver] of grid) {
        assert.deepEqual(callableRoles(node), expected, form);
        assert.equal(sourceReceiverBoundary(node, ast), receiver, `${form}: receiver boundary`);
    }
    assert.deepEqual(sourceNodeRoles(ast, file), ["module-scope"], "the source file is the module scope");
    assert.deepEqual(sourceNodeRoles(ast, only("KindClassDeclaration")), ["class-scope"]);
    assert.deepEqual(sourceNodeRoles(ast, only("KindInterfaceDeclaration")), ["type-only"]);
    assert.equal(Object.isFrozen(sourceNodeRoles(ast, file)), true);
});
//# sourceMappingURL=callable-boundaries.test.js.map