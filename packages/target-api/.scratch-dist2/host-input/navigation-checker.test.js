import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
// Moved from source-navigation/declaration-symbol.test.ts with the query (host-input owns checker symbols, I3).
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createSourceDeclarationSymbolQuery, sourceDeclarationSymbol } from "./navigation-checker.js";
import { createSourceNavigationInput } from "./navigation.js";
function fixture() {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": `export {}; declare const external: { readonly token: {} };
      declare const other: { readonly value: number }; const alias = external; const selected = alias.token; const unrelated = other.value;`,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length === 0, true, "valid exact indexed declarations");
    const source = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const declarations = new Map();
    const pending = [file];
    while (pending.length !== 0) {
        const node = pending.pop();
        if (source.ast.is.IsVariableDeclaration(node))
            declarations.set(source.ast.text(source.ast.name(node)), node);
        source.ast.forEachChild(node, child => { if (child !== undefined)
            pending.push(child); });
    }
    const external = declarations.get("external");
    const other = declarations.get("other");
    assert.ok(external && other);
    const checker = checked.getSourceFileQueries(file).checker;
    const expected = checker.getSymbolAtLocation(source.ast.name(external));
    assert.ok(expected);
    return { source, checked, checker, external, other, expected, file };
}
test("declaration symbols are the declaration's own name symbol in the consumer checker", () => {
    const current = fixture();
    const select = createSourceDeclarationSymbolQuery(current.checked);
    for (let repeat = 0; repeat < 32; repeat += 1)
        assert.equal(select(current.external, current.file) === current.expected, true);
    const type = current.checker.getTypeOfSymbol(select(current.external, current.file));
    assert.equal(type === current.checker.getTypeOfSymbol(current.expected), true, "same checked type identity");
    assert.equal(select(current.other, current.file) === current.checker.getSymbolAtLocation(current.source.ast.name(current.other)), true);
    assert.equal(sourceDeclarationSymbol(current.source.ast, current.checker, current.external) === current.expected, true, "the cached query and the navigation input share one selector");
});
test("an unnamed default-export declaration declares its module export symbol, never a reference lookup", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/thing.ts": "export default class { value: number = 1; }",
            "/src/index.ts": 'import Thing from "./thing.js"; export const made = new Thing().value;',
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const thing = checked.getSourceFile("/src/thing.ts");
    const consumer = checked.getSourceFile("/src/index.ts");
    const declaration = checked.ast.statements(thing).find(node => node !== undefined && checked.ast.is.IsClassDeclaration(node));
    assert.equal(checked.ast.name(declaration), undefined, "the class is anonymous");
    const checker = checked.getSourceFileQueries(consumer).checker;
    const moduleSymbol = checker.getSymbolAtLocation(thing);
    const exported = moduleSymbol === undefined ? undefined
        : checker.getExportsOfModule(moduleSymbol).find(symbol => symbol !== undefined && checker.getSymbolDeclarations(symbol).includes(declaration));
    assert.ok(exported, "the module export declares the anonymous class");
    const select = createSourceDeclarationSymbolQuery(checked);
    assert.equal(select(declaration, consumer) === exported, true);
    assert.equal(select(declaration, consumer) === exported, true, "stable per consumer");
});
test("missing name symbols are never invented", () => {
    const current = fixture();
    const select = createSourceDeclarationSymbolQuery({ ...current.checked, getSourceFileQueries(file) {
            return { ...current.checked.getSourceFileQueries(file), checker: { ...current.checker, getSymbolAtLocation: () => undefined } };
        } });
    assert.equal(select(current.external, current.file) === undefined, true, "exact declaration identity required");
    assert.equal(select(current.external, current.file) === undefined, true, "completed absence remains stable");
});
test("declaration symbols refuse an unchecked consumer context", () => {
    const current = fixture();
    const foreign = fixture();
    const select = createSourceDeclarationSymbolQuery(current.checked);
    assert.equal(current.checked.containsSourceFile(foreign.file), false, "the checked source owner distinguishes the two actual programs");
    assert.equal(select(current.external, current.file) === current.expected, true);
    assert.equal(select(foreign.external, current.file) === undefined, true, "a declaration from another checked program has no symbol");
    assert.throws(() => select(current.external, foreign.file), /actual checked consumer context/u);
});
// REVIEW-R2 #42: the two excluded-native-owner tests of the baseline source-navigation/declaration-symbol.test.ts.
function excludedNativeOwner(nativeSource) {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": 'import { Native } from "./native.js"; export function read(value: Native): number { return value.field; }',
            "/src/native.ts": nativeSource,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0, "the source checker admits the native declaration and its consumer");
    const consumer = checked.getSourceFile("/src/index.ts");
    const native = checked.getSourceFile("/src/native.ts");
    const declaration = checked.ast.statements(native).find(node => node !== undefined && checked.ast.is.IsClassDeclaration(node));
    const source = createHostSourceProgramFixture({ ...checked, sourceFiles: Object.freeze([consumer]) });
    return { checked, consumer, native, declaration, source };
}
test("a declaration in an excluded file keeps its value and instance type through the consumer's checker", () => {
    const { checked, consumer, declaration, source } = excludedNativeOwner("export class Native { field: number = 7; }");
    const checker = checked.getSourceFileQueries(consumer).checker;
    const expected = checker.getSymbolAtLocation(checked.ast.name(declaration));
    assert.equal(expected !== undefined, true, "the included consumer's checker knows the exact native declaration");
    const semantics = source.semantics.forFile(consumer);
    assert.equal(semantics.declarations.declaredValueType(declaration) === checker.getTypeOfSymbol(expected), true, "native value types retain exact checked identity rather than returning undefined");
    assert.equal(semantics.declarations.declaredType(declaration) === checker.getDeclaredTypeOfSymbol(expected), true, "native instance types retain exact checked identity");
});
test("a queried native owner is not a project declaration, file or document", () => {
    const { checked, native, declaration, source } = excludedNativeOwner("export declare class Native { field: number; }");
    const checker = checked.getSourceFileQueries(native).checker;
    const expected = checker.getSymbolAtLocation(checked.ast.name(declaration));
    assert.equal(expected !== undefined, true, "the native owner's checker owns its declaration symbol");
    assert.equal(source.semantics.forNode(declaration).declarations.declaredType(declaration) === checker.getDeclaredTypeOfSymbol(expected), true, "the owner-context view retains one exact checked type");
    assert.equal(source.semantics.includes(native), false, "semantic queries do not broaden exposed source membership");
    assert.equal(source.navigation.isProjectDeclaration(declaration), false, "a queried native declaration is not a project implementation");
    assert.equal(source.sourceFiles.includes(native), false, "semantic queries do not publish the native owner file");
    assert.throws(() => source.documents.forFile(native), /exact source file/u, "semantic queries do not create an authored source document");
});
test("navigation input merges declarations of one entity and keys them by declaration", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": `export function f(value: number): number;
      export function f(value: string): string;
      export function f(value: number | string): number | string { return value; }
      export const g = 1;`,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const input = createSourceNavigationInput(checked);
    const file = checked.getSourceFile("/src/index.ts");
    const functions = checked.ast.statements(file).filter((node) => node !== undefined && checked.ast.is.IsFunctionDeclaration(node));
    assert.equal(functions.length, 3);
    for (const declaration of functions)
        assert.deepEqual(input.mergedDeclarations(declaration), functions, "overloads and implementation");
    assert.equal(input.mergedDeclarations(functions[0]) === input.mergedDeclarations(functions[0]), true, "memoized per program");
    const implementation = functions[2];
    assert.deepEqual(input.declaredParameters(implementation), checked.ast.parameters(implementation), "declared signature parameters");
});
//# sourceMappingURL=navigation-checker.test.js.map