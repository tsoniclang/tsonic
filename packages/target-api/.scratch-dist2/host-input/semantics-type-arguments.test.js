import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { getEffectiveSourceTypeArguments } from "./navigation-checker.js";
import { getSourceCallTypeParameterDeclaration, getSourceTypeArgumentBindings } from "./semantics-type-arguments.js";
test("an instantiated method binder retains only the selected signature's authored declaration", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": `export {};
      interface View<Value> { map<Result>(read: (value: Value) => Result): Result[]; }
      interface Foreign<Value> { map<Result>(read: (value: Value) => Result): Result[]; }
      declare const values: View<string>;
      function run<Value>(value: Value): Value[] { return values.map(() => value); }
      class Box<Value> { constructor(readonly value: Value) {} }
      class Empty<Value> { value?: Value; }
      class Closed extends Empty<string> {}
      const box = new Box<string>("text"); const empty = new Empty<string>(); const closed = new Closed();`,
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const source = createHostSourceProgramFixture(checked);
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The exact checked file is required.");
    const query = source.semantics.forFile(file);
    const nodes = [];
    const visit = (node) => { nodes.push(node); source.ast.forEachChild(node, child => { if (child !== undefined)
        visit(child); }); };
    visit(file);
    const foreign = nodes.find(node => source.ast.is.IsInterfaceDeclaration(node) && source.ast.text(source.ast.name(node)) === "Foreign");
    const foreignMethod = foreign === undefined ? undefined : source.ast.members(foreign).find(member => member !== undefined && source.ast.is.IsMethodSignatureDeclaration(member));
    const foreignParameter = foreignMethod === undefined ? undefined : source.ast.typeParameters(foreignMethod)[0];
    const foreignType = foreignParameter === undefined ? undefined : query.declarations.declaredType(foreignParameter);
    let observed = 0;
    for (const node of nodes) {
        if (!(source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)))
            continue;
        const call = query.operations.call(node);
        if (call === undefined)
            throw new Error("The selected checked invocation is required.");
        for (const argument of call.sourceSelectedMethodTypeArguments ?? []) {
            const declaration = getSourceCallTypeParameterDeclaration(source.ast, query, node, call, argument);
            const owner = query.declarations.signatureDeclaration(call.selectedSignature);
            const scope = owner === undefined ? undefined : source.ast.is.IsConstructorDeclaration(owner) ? source.ast.parent(owner) : owner;
            const parent = declaration === undefined ? undefined : source.ast.parent(declaration);
            const classOwned = source.ast.is.IsNewExpression(node) && parent !== undefined && source.ast.is.IsClassDeclaration(parent);
            const declared = declaration === undefined ? undefined : query.declarations.declaredType(declaration);
            assert.equal(declaration !== undefined && (classOwned ? declared !== undefined && query.types.isIdentical(declared, argument.typeParameter)
                : scope !== undefined && source.ast.typeParameters(scope).includes(declaration)), true, "class constructors retain canonical declared-Type identity; methods retain their authored signature parameter");
            assert.equal(foreignType !== undefined && getSourceCallTypeParameterDeclaration(source.ast, query, node, call, { ...argument, typeParameter: foreignType }) === undefined, true, "a same-named foreign binder has no selected-signature evidence");
            if (foreignType === undefined)
                throw new Error("The exact checked foreign binder is required.");
            const foreignArgument = { ...argument, typeParameter: foreignType };
            const foreignCall = { ...call, sourceSelectedMethodTypeArguments: [foreignArgument] };
            assert.equal(getSourceCallTypeParameterDeclaration(source.ast, query, node, foreignCall, foreignArgument) === undefined, true, "even a retained vector entry cannot substitute another signature's original binder");
            assert.equal(getSourceCallTypeParameterDeclaration(source.ast, { ...query,
                declarations: { ...query.declarations, typeSymbol: () => undefined } }, node, call, argument) === undefined, true, "missing exact symbol evidence never guesses a parameter");
            observed += 1;
        }
    }
    assert.equal(observed, 4);
});
test("merged generic declarations retain their actual canonical checked binder", () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
            "/src/index.ts": "interface Pair<T> { first: T; } interface Pair<T> { second: T; } declare const pair: Pair<number>;",
        }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const file = checked.getSourceFile("/src/index.ts");
    if (file === undefined)
        throw new Error("The exact checked file is required.");
    const queries = checked.getSourceFileQueries(file);
    let declaration;
    const visit = (node) => {
        if (checked.ast.is.IsVariableDeclaration(node))
            declaration = node;
        checked.ast.forEachChild(node, child => { if (child !== undefined)
            visit(child); });
    };
    visit(file);
    if (declaration === undefined)
        throw new Error("The real generic application is required.");
    const selectedType = queries.checker.getTypeAtLocation(checked.ast.name(declaration));
    if (selectedType === undefined)
        throw new Error("The checked type is required.");
    const bindings = getSourceTypeArgumentBindings(checked.ast, queries, selectedType);
    assert.equal(bindings?.length, 1);
    const binding = bindings?.[0];
    if (binding === undefined)
        throw new Error("The exact binder is required.");
    const symbol = queries.checker.getTypeSymbol(binding.parameterType);
    if (symbol === undefined)
        throw new Error("The checked binder symbol is required.");
    const declarations = queries.checker.getSymbolDeclarations(symbol);
    assert.equal(declarations.filter(node => checked.ast.is.IsTypeParameterDeclaration(node)).length, 2);
    assert.equal(binding.declaration === queries.checker.getPrimarySymbolDeclaration(symbol) && declarations.includes(binding.declaration), true, "declaration multiplicity never substitutes a fabricated or name-matched binder");
    assert.equal(queries.typeShape.isNumberLike(binding.argumentType), true);
    assert.equal(Object.isFrozen(binding) && Object.isFrozen(bindings), true);
});
test("effective arguments never replace missing class bindings with authored arity", () => {
    const checked = createCompilerSessionFromFiles({
        currentDirectory: "/src",
        files: { "/src/index.ts": `
      function make<T>(input: T) {
        class Pair<U> {
          left: T;
          right: U;
          constructor(left: T, right: U) { this.left = left; this.right = right; }
        }
        return new Pair<number>(input, 1);
      }
      const result = make("text");
      const tuple: [number, string] = [1, "text"];
    ` },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    }).checkSource();
    assert.equal(checked.diagnostics.length, 0);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const queries = checked.getSourceFileQueries(file);
    const variables = new Map();
    const visit = (node) => {
        if (checked.ast.is.IsVariableDeclaration(node)) {
            variables.set(checked.ast.text(checked.ast.name(node)), node);
        }
        for (const child of checked.ast.children(node)) {
            if (child !== undefined)
                visit(child);
        }
    };
    visit(file);
    const typeOf = (name) => {
        const declaration = variables.get(name);
        assert.ok(declaration);
        const type = queries.checker.getTypeAtLocation(checked.ast.name(declaration));
        assert.ok(type);
        return type;
    };
    const type = typeOf("result");
    const selected = getEffectiveSourceTypeArguments(checked.ast, queries, type);
    assert.equal(selected?.length, 1);
    assert.equal(queries.typeShape.isNumberLike(selected?.[0]), true);
    const missingBindings = {
        ...queries,
        typeShape: { ...queries.typeShape, getTypeReferenceArgumentInfos: () => undefined },
    };
    assert.equal(getEffectiveSourceTypeArguments(checked.ast, missingBindings, type), undefined);
    const tuple = getEffectiveSourceTypeArguments(checked.ast, queries, typeOf("tuple"));
    assert.equal(tuple?.length, 2);
    assert.equal(queries.typeShape.isNumberLike(tuple?.[0]), true);
    assert.equal(queries.typeShape.isStringLike(tuple?.[1]), true);
    assert.equal(Object.isFrozen(tuple), true);
});
//# sourceMappingURL=semantics-type-arguments.test.js.map