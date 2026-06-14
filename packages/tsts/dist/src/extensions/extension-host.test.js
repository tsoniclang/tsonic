import { test } from "node:test";
import assert from "node:assert/strict";
import { createExtensionHost, createExtensionImportIndex, defineExtensionFactKey, parseTstsSourceFile, } from "./index.js";
test("extension host orders hard dependencies before dependents", () => {
    const calls = [];
    const host = createExtensionHost([
        {
            id: "dependent",
            dependsOn: ["base"],
            configure: () => calls.push("dependent"),
        },
        {
            id: "base",
            configure: () => calls.push("base"),
        },
    ]);
    host.configure();
    assert.deepEqual(calls, ["base", "dependent"]);
});
test("extension host records hook failures as diagnostics", () => {
    const host = createExtensionHost([
        {
            id: "throws",
            configure: () => {
                throw new Error("boom");
            },
        },
    ]);
    host.configure();
    const diagnostics = host.diagnostics.all();
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, "TSTS_EXTENSION_FAILURE");
    assert.equal(diagnostics[0].extensionId, "throws");
});
test("extension facts are sidecar data keyed by node identity", () => {
    const sourceFile = parseTstsSourceFile("type A = number; type B = number;");
    const firstStatement = sourceFile.Statements.Nodes[0];
    const secondStatement = sourceFile.Statements.Nodes[1];
    const key = defineExtensionFactKey("test.fact");
    const host = createExtensionHost([]);
    host.facts.set(key, firstStatement, { name: "A" });
    assert.deepEqual(host.facts.get(key, firstStatement), { name: "A" });
    assert.equal(host.facts.get(key, secondStatement), undefined);
});
test("parseTstsSourceFile normalizes synthetic relative file names", () => {
    const sourceFile = parseTstsSourceFile("export const value = 1;", {
        fileName: "fixtures/source.ts",
    });
    assert.equal(sourceFile.FileName(), "/fixtures/source.ts");
});
test("extension import index captures named and aliased type imports", () => {
    const sourceFile = parseTstsSourceFile(`
    import type { int, long as i64 } from "@tsonic/core/types.js";
    export type A = int;
    export type B = i64;
  `);
    const index = createExtensionImportIndex(sourceFile);
    assert.deepEqual(index.getBindingsFrom("@tsonic/core/types.js").map((binding) => ({
        localName: binding.localName,
        importedName: binding.importedName,
        isTypeOnly: binding.isTypeOnly,
    })), [
        { localName: "int", importedName: "int", isTypeOnly: true },
        { localName: "i64", importedName: "long", isTypeOnly: true },
    ]);
    assert.equal(index.resolveLocalName("i64")?.importedName, "long");
});
//# sourceMappingURL=extension-host.test.js.map