import assert from "node:assert/strict";
import test from "node:test";
import { createHostSourceProgramFixture } from "../host-program-fixtures.js";
import { createSourceSemanticsVirtualModuleProvider } from "../extension/semantics-virtual-modules.js";
import { memorySession, memoryCalls } from "../memory-layout/testing/fixtures.js";

test("provider field addresses preserve scoped location dependencies after aggregate writes", () => {
  const moduleSpecifier = "test:records";
  const byte = { kind: "source-primitive", name: "uint8" } as const;
  const word = { kind: "source-primitive", name: "uint32" } as const;
  const provider = createSourceSemanticsVirtualModuleProvider({
    id: "test.native-record", version: "1", displayName: "Native records", virtualDirectory: "native-records",
    modules: [{ moduleSpecifier, exports: [] }], evidenceMessage: "Exact checked record fields",
    exportsForModule: () => [
      { id: "source.Header", name: "Header", kind: "interface", members: [
        { id: "source.Header.tag", name: "tag", kind: "property", type: byte },
        { id: "source.Header.count", name: "count", kind: "property", type: word },
      ] },
      { id: "source.Envelope", name: "Envelope", kind: "interface", members: [
        { id: "source.Envelope.prefix", name: "prefix", kind: "property", type: byte },
        { id: "source.Envelope.header", name: "header", kind: "property",
          type: { kind: "provider-ref", moduleSpecifier, exportName: "Header" } },
      ] },
      { id: "source.create", name: "create", kind: "function", signatures: [{ id: "source.create.signature",
        parameters: [{ name: "prefix", type: byte }, { name: "tag", type: byte }, { name: "count", type: word }],
        returnType: { kind: "provider-ref", moduleSpecifier, exportName: "Envelope" } }] },
    ],
  });
  const checked = memorySession(`
    import { create } from "test:records";
    import type { Envelope } from "test:records";
    import { addressof, loadptr, storeptr, equalptr, unsafecontext } from "@tsonic/core/lang.js";
    export function run(): boolean {
      unsafecontext();
      let value: Envelope = create(1, 2, 7);
      const pointer = addressof(value);
      const saved = loadptr(pointer);
      const alias = addressof(value);
      const count = addressof(value.header.count);
      if (alias === undefined || count === undefined) return false;
      storeptr(count, 9);
      if (loadptr(pointer).header.count !== 9) return false;
      storeptr(alias, create(3, 4, 11));
      return saved.header.count === 7 && loadptr(count) === 11 &&
        loadptr(pointer).prefix === 3 && equalptr(pointer, alias);
    }
  `, { extensions: [{ identity: { id: "test.native-record", version: "1" },
    initialize(context) { context.registerSourceDeclarationProvider(provider); } }] });
  assert.equal(checked.diagnostics.length === 0 && checked.extensionDiagnostics.length === 0, true,
    "The complete original provider program has checked source evidence.");
  const source = createHostSourceProgramFixture(checked);
  const storage = source.facts.analyses.storage({ sourceFiles: source.sourceFiles, premises: {} });
  const reads = memoryCalls(checked, "loadptr");
  assert.equal(reads.length, 4);
  for (const call of reads) {
    const subject = storage.subjectFor(call);
    assert.equal(subject.kind, "resolved");
    if (subject.kind !== "resolved") return;
    const selected = storage.storageProducersFor(subject.subject);
    assert.equal(selected.kind === "complete" || selected.kind === "open", true,
      selected.kind === "unresolved" ? selected.reason : "All exact scoped field location dependencies complete.");
    if (selected.kind === "unresolved") return;
    assert.equal(selected.kind !== "open" || selected.boundaries.every(boundary =>
      boundary.kind === "opaque-result" && storage.typeFor(boundary.subject).kind === "resolved"), true,
    "An opaque provider value stays an explicit checked boundary rather than an invented field producer.");
  }
  assert.equal(storage.failureReason() === undefined, true);
});
