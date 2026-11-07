import { createJsSourceApiFacts } from "../../../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
// host-input checker-query tests: the program and its own checker views (buildHostSourceProgram), never a second adapter.
import { buildHostSourceProgram } from "../../../../packages/target-api/dist/source-semantics/target-source-program.js";
function inspect(text, files = {}) {
    const checked = createCompilerSessionFromFiles({
        currentDirectory: "/src",
        files: { ...files, "/src/index.ts": text },
        compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    }).checkSource();
    assert.deepEqual(checked.extensionDiagnostics, []);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
    const built = buildHostSourceProgram(checked, { profile: createJsSourceApiFacts });
    const source = built.program;
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const semantics = built.semantics.forFile(file);
    const results = [];
    const argumentTypes = [];
    for (const node of walk(file)) {
        if (!source.ast.is.IsCallExpression(node))
            continue;
        const call = semantics.operations.call(node);
        if (call?.sourceArguments.length !== 1)
            continue;
        const actual = call.sourceArguments[0]?.type;
        const selected = call.sourceSelectedSignatureParameters[0]?.selectedType;
        assert.ok(actual && selected);
        argumentTypes.push(actual);
        const result = semantics.types.structuralMembers(actual, selected, "read");
        assert.equal(semantics.types.structuralMembers(actual, selected, "read"), result);
        assert.ok(Object.isFrozen(result));
        results.push(result);
    }
    return { results, source, semantics, argumentTypes, checked, file };
    function* walk(node) {
        yield node;
        for (const child of source.ast.children(node))
            if (child !== undefined)
                yield* walk(child);
    }
}
function check(text, files) {
    return inspect(text, files).results;
}
function memberDeclaration(current, type, name) {
    const property = current.semantics.types.propertyInfos(type).find(property => property.name === name);
    assert.ok(property, name);
    const declarations = current.semantics.declarations.symbolDeclarations(property.symbol);
    assert.equal(declarations.length, 1, `${name}: one checked member declaration`);
    return declarations[0];
}
export { inspect, check, memberDeclaration };
