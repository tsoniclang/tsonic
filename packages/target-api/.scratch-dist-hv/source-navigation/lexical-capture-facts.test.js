// Host fact test: `facts.analyses.lexicalCaptures(owner)` publishes the full lexical capture selection of an owner
// (roots [owner]): captured bindings with every reference, self references and captured receivers, keyed by
// declaration Nodes. `navigation.scopes.captures` is a projection of the same selection (binding and written flag).
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
const sourceText = `
const outer = 1;
export class Owner {
  base = 2;
  run(seed: number): number {
    let total = seed;
    const named = function again(n: number): number { return n <= 0 ? total : again(n - 1) + outer; };
    const arrow = (step: number) => { total += step; return this.base + seed + total; };
    class Local { read(): number { return total + seed; } }
    const literal = { add(step: number) { total += step; return step; } };
    return named(1) + arrow(1) + new Local().read() + literal.add(1);
  }
}
`;
function fixture(text = sourceText) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": text },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined)));
    const host = createHostSourceProgramFixture(checked);
    const { ast } = host;
    const nodes = [];
    const visit = (node) => {
        nodes.push(node);
        ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(checked.getSourceFile("/src/index.ts"));
    const select = (predicate, label) => {
        const found = nodes.find(predicate);
        assert.equal(found !== undefined, true, label);
        return found;
    };
    const named = (kind, name) => select(node => ast.kindName(node) === kind &&
        ast.name(node) !== undefined && ast.text(ast.name(node)) === name, `${kind} ${name}`);
    const identifiers = (text, within) => nodes.filter(node => ast.is.IsIdentifier(node) &&
        ast.text(node) === text && ast.name(ast.parent(node)) !== node && isWithin(node, within));
    const isWithin = (node, ancestor) => {
        for (let current = node; current !== undefined; current = ast.parent(current)) {
            if (current === ancestor)
                return true;
        }
        return false;
    };
    return { host, facts: host.facts, ast, nodes, select, named, identifiers };
}
test("a named function expression captures outer locals, not module bindings, and lists its self references", () => {
    const { facts, named, identifiers } = fixture();
    const again = named("KindFunctionExpression", "again");
    const total = named("KindVariableDeclaration", "total");
    const selection = facts.analyses.lexicalCaptures(again);
    assert.deepEqual(selection.captures.map(capture => capture.declaration), [total]);
    assert.deepEqual(selection.captures[0].references, identifiers("total", again));
    assert.deepEqual(selection.selfReferences, identifiers("again", again));
    assert.equal(selection.selfReferences.length, 1);
    assert.deepEqual(selection.receivers, []);
});
test("an arrow lists every reference per captured binding and its captured receiver; scopes.captures omits both", () => {
    const { facts, ast, named, nodes, identifiers } = fixture();
    const arrow = named("KindVariableDeclaration", "arrow");
    const owner = ast.as.AsVariableDeclaration(arrow)?.Initializer;
    assert.equal(owner !== undefined && ast.is.IsArrowFunction(owner), true);
    const total = named("KindVariableDeclaration", "total");
    const seed = named("KindParameter", "seed");
    const run = named("KindMethodDeclaration", "run");
    const selection = facts.analyses.lexicalCaptures(owner);
    assert.deepEqual(selection.captures.map(capture => capture.declaration), [total, seed], "authored first-reference order");
    assert.deepEqual(selection.captures[0].references, identifiers("total", owner));
    assert.equal(selection.captures[0].references.length, 2);
    assert.deepEqual(selection.captures[1].references, identifiers("seed", owner));
    const thisKeyword = nodes.filter(node => ast.kindName(node) === "KindThisKeyword");
    assert.equal(thisKeyword.length, 1);
    assert.deepEqual(selection.receivers, [{ owner: run, references: thisKeyword }]);
    assert.deepEqual(facts.navigation.scopes.captures(owner).map(capture => capture.declaration), [total, seed]);
});
test("a local class and an object-literal method publish their captures over the whole owner", () => {
    const { facts, named } = fixture();
    const total = named("KindVariableDeclaration", "total");
    const seed = named("KindParameter", "seed");
    const local = facts.analyses.lexicalCaptures(named("KindClassDeclaration", "Local"));
    assert.deepEqual(local.captures.map(capture => capture.declaration), [total, seed]);
    assert.deepEqual(local.selfReferences, []);
    assert.deepEqual(local.receivers, []);
    const method = facts.analyses.lexicalCaptures(named("KindMethodDeclaration", "add"));
    assert.deepEqual(method.captures.map(capture => capture.declaration), [total]);
    assert.deepEqual(method.receivers, []);
});
test("the selection is frozen and computed once per owner; a node outside the owner domain is an invariant", () => {
    const { facts, named } = fixture();
    const again = named("KindFunctionExpression", "again");
    const selection = facts.analyses.lexicalCaptures(again);
    assert.equal(facts.analyses.lexicalCaptures(again), selection);
    assert.equal(Object.isFrozen(selection), true);
    assert.equal(Object.isFrozen(selection.captures), true);
    assert.equal(Object.isFrozen(selection.captures[0]), true);
    assert.equal(Object.isFrozen(selection.captures[0].references), true);
    assert.throws(() => facts.analyses.lexicalCaptures(named("KindVariableDeclaration", "total")), /Lexical captures are published for a project callable with a body or a project class/u);
});
// R2 #13: one capture selection. scopes.captures projects facts.analyses.lexicalCaptures (roots [owner]), so a capture
// in a parameter initializer is listed by both, and an owner outside callable-body ∪ class-scope throws in both.
const parameterDefaultText = `
export function run(seed: number): number {
  let total = seed;
  const read = (x: number = total) => x;
  const literal = { m(y: number = total) { return y; } };
  return read() + literal.m();
}
export declare function bodyless(n: number): number;
`;
test("scopes.captures is the projection of lexicalCaptures: parameter-initializer captures are listed by both", () => {
    const { facts, ast, named, nodes } = fixture(parameterDefaultText);
    const total = named("KindVariableDeclaration", "total");
    const read = ast.as.AsVariableDeclaration(named("KindVariableDeclaration", "read"))?.Initializer;
    assert.equal(read !== undefined && ast.is.IsArrowFunction(read), true);
    const method = named("KindMethodDeclaration", "m");
    for (const owner of [read, method]) {
        assert.deepEqual(facts.analyses.lexicalCaptures(owner).captures.map(capture => capture.declaration), [total]);
        assert.deepEqual(facts.navigation.scopes.captures(owner), [{ declaration: total, written: false }]);
    }
    const bodyless = nodes.find(node => ast.is.IsFunctionDeclaration(node) && ast.body(node) === undefined);
    assert.equal(bodyless !== undefined, true);
    assert.throws(() => facts.analyses.lexicalCaptures(bodyless), /Lexical captures are published for a project callable with a body/u);
    assert.throws(() => facts.navigation.scopes.captures(bodyless), /Lexical captures are published for a project callable with a body/u);
});
//# sourceMappingURL=lexical-capture-facts.test.js.map