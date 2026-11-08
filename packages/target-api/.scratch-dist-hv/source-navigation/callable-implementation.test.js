import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { selectCallableImplementationDeclaration } from "./callable-implementation.js";
function fixture(sourceText) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(issue => issue !== undefined)));
    const source = createHostSourceProgramFixture(checked);
    const declarations = [];
    const pending = [...source.navigation.sourceFiles];
    while (pending.length > 0) {
        const node = pending.pop();
        if (source.ast.is.IsFunctionDeclaration(node) || source.ast.is.IsMethodDeclaration(node) ||
            source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node) || source.ast.is.IsConstructorDeclaration(node)) {
            declarations.push(node);
        }
        source.ast.forEachChild(node, child => { if (child !== undefined)
            pending.push(child); });
    }
    return { source, checked, declarations };
}
test("exact project callable bodies resolve by declaration identity for every native name form", () => {
    const { source, declarations } = fixture(`
const key = "computed";
class Holder {
  constructor() {}
  ordinary(): number { return 1; }
  [key](): number { return 2; }
  get value(): number { return 3; }
  set value(value: number) {}
}
const Anonymous = class { constructor() {} };
export function make(): Holder { new Anonymous(); return new Holder(); }
`);
    assert.equal(declarations.length, 7, "constructor, getter and setter bodies keep distinct categories");
    for (const [index, declaration] of declarations.entries()) {
        const selected = source.navigation.callableImplementation(declaration);
        assert.equal(selected.kind === "resolved" && selected.contractDeclaration === declaration &&
            selected.implementation.declaration === declaration && selected.implementation.project, true, `body ${index}: exact project implementation`);
        assert.equal(source.navigation.callableImplementation(declaration) === selected, true, `body ${index}: stable cached identity`);
    }
});
test("ordinary and computed overload signatures select their one checked implementation", () => {
    const { source, declarations } = fixture(`
const key = "computed";
class Holder {
  ordinary(value: number): number;
  ordinary(value: number): number { return value; }
  [key](value: number): number;
  [key](value: number): number { return value; }
}
export function invoke(holder: Holder): number { return holder.ordinary(1) + holder[key](2); }
`);
    const signatures = declarations.filter(node => source.ast.body(node) === undefined);
    assert.equal(signatures.length, 2, "both ordinary and computed overload contracts are present");
    for (const [index, declaration] of signatures.entries()) {
        const entity = source.navigation.mergedDeclarations(declaration);
        assert.equal(entity.includes(declaration) && entity.length > 1, true, `overload ${index}: merged entity declarations`);
        assert.equal(source.navigation.mergedDeclarations(declaration) === entity, true, `overload ${index}: one memoized entity`);
        const selected = source.navigation.callableImplementation(declaration);
        assert.equal(selected.kind === "resolved" && source.ast.body(selected.implementation.declaration) !== undefined &&
            source.ast.parent(selected.implementation.declaration) === source.ast.parent(declaration) &&
            entity.includes(selected.implementation.declaration), true, `overload ${index}: exact implementation within its entity`);
    }
});
test("anonymous constructor overloads keep their exact owner while absent bodies stay unresolved", () => {
    const { source, declarations } = fixture(`
const Holder = class { constructor(value: number); constructor(value: number) {} };
declare function external(value: number): number;
export function make(): object { return new Holder(1); }
`);
    const constructor = declarations.find(node => source.ast.is.IsConstructorDeclaration(node) && source.ast.body(node) === undefined);
    const selected = source.navigation.callableImplementation(constructor);
    assert.equal(selected.kind === "resolved" && source.ast.is.IsConstructorDeclaration(selected.implementation.declaration) &&
        source.ast.parent(selected.implementation.declaration) === source.ast.parent(constructor), true, "anonymous constructor resolves only inside its exact checked class");
    const external = declarations.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.body(node) === undefined);
    assert.equal(source.navigation.callableImplementation(external).kind, "unresolved", "an absent native body is never invented");
});
test("ambiguous checked implementation sets are refused rather than chosen by name", () => {
    const { source, declarations } = fixture(`
class Holder { first(): number { return 1; } second(): number { return 2; } }
`);
    const methods = declarations.filter(node => source.ast.is.IsMethodDeclaration(node));
    const declaration = methods[0];
    const selected = selectCallableImplementationDeclaration(source.ast, declaration, methods);
    assert.equal(selected === undefined, true, "two same-category bodies do not select an arbitrary implementation");
});
//# sourceMappingURL=callable-implementation.test.js.map