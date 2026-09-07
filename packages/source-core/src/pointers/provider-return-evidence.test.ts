import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics, sourceMarkerFactKey, sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { ProviderTypeExpression } from "@tsonic/tsts";
import { createTargetSourceProgram, type SourceProviderTypeParameterSelection } from "@tsonic/target-api/source";
import { memorySession, memoryCalls } from "../memory-layout/testing/fixtures.js";
import { createSourceSemanticsVirtualModuleProvider } from "../extension/semantics-virtual-modules.js";
import { selectTsonicProviderPointerResult } from "./provider-return-evidence.js";

const word = { kind: "source-primitive", name: "uint32" } as const;
const pointer = (type: ProviderTypeExpression): ProviderTypeExpression => ({
  kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "Pointer", typeArguments: [type],
});
const raw: ProviderTypeExpression = { kind: "provider-ref", moduleSpecifier: "@tsonic/core/types.js", exportName: "RawPointer" };

for (const [name, returnType, expected, generic] of [
  ["raw", raw, "raw", false],
  ["word", pointer(word), "pointer(uint32)", false],
  ["nested", pointer(pointer(word)), "pointer(pointer(uint32))", false],
  ["array", pointer({ kind: "array", elementType: word }), "pointer(array(uint32))", false],
  ["tuple", pointer({ kind: "tuple", elementTypes: [word, { kind: "source-primitive", name: "uint64" }] }), "pointer(tuple(uint32,uint64))", false],
  ["optional", { kind: "union", types: [pointer(word), { kind: "undefined" }] }, "optional(pointer(uint32))", false],
  ["optional raw", { kind: "union", types: [raw, { kind: "undefined" }] }, "optional(raw)", false],
  ["generic", pointer({ kind: "type-parameter", name: "Value" }), "pointer(uint32)", true],
] satisfies readonly (readonly [string, ProviderTypeExpression, string, boolean])[]) {
  test(`provider pointer source evidence preserves ${name} independently of target carriers`, () => {
    const provider = createSourceSemanticsVirtualModuleProvider({
      id: "test.pointer-return", version: "1", displayName: "Pointer return proof", virtualDirectory: "pointer-return-proof",
      modules: [{ moduleSpecifier: "test:pointer-return", exports: [] }], evidenceMessage: "Exact pointer return declaration",
      importsForModule: () => [{ moduleSpecifier: "@tsonic/core/types.js", typeOnly: true,
        namedImports: [{ exportedName: "Pointer", kind: "type" }, { exportedName: "RawPointer", kind: "type" }] }],
      exportsForModule: () => [{ id: "export.get", name: "get", kind: "function", signatures: [{
        id: "signature.get", parameters: [], returnType,
        ...(generic ? { typeParameters: [{ name: "Value" }] } : {}),
      }] }],
    });
    const checked = memorySession(`
      import { get as selected } from "test:pointer-return";
      import type { uint32 } from "@tsonic/core/types.js";
      selected${generic ? "<uint32>" : ""}();
      function get(): number { return 1; }
      get();
    `, { extensions: [{ identity: { id: "test.pointer-return", version: "1" }, initialize(context) {
      context.registerSourceDeclarationProvider(provider);
    } }] });
    assert.deepEqual(checked.extensionDiagnostics, []);
    assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
    const source = createTargetSourceProgram(checked);
    const file = checked.getSourceFile("/src/index.ts");
    assert.ok(file);
    const semantics = source.semantics.forFile(file);
    const selectedCall = memoryCalls(checked, "selected")[0];
    assert.ok(selectedCall);
    const call = semantics.operations.call(selectedCall);
    assert.ok(call);
    const policy = {
      primitive: (kind: string) => kind, raw: () => "raw", pointer: (value: string) => `pointer(${value})`,
      optional: (value: string) => `optional(${value})`, array: (value: string) => `array(${value})`,
      tuple: (values: readonly string[]) => `tuple(${values.join(",")})`,
      typeParameter: (parameter: SourceProviderTypeParameterSelection) => {
        assert.equal(parameter.scope, "signature");
        assert.equal(parameter.ownerId, "signature.get");
        const selected = call.sourceSelectedMethodTypeArguments?.[parameter.index];
        assert.equal(selected?.typeParameterName, parameter.parameter.name);
        return checked.sourceFacts.getFact(selected?.explicitTypeNode, sourcePrimitiveFactKey)?.kind;
      },
      sourceType: (_type: unknown, syntax: Parameters<typeof checked.sourceFacts.getFacts>[0]) =>
        checked.sourceFacts.getFact(syntax, sourcePrimitiveFactKey)?.kind,
    };
    assert.deepEqual(selectTsonicProviderPointerResult(call, source.ast, semantics, source.sourceFacts, policy), {
      kind: "resolved", carrier: expected,
    });
    const local = semantics.operations.call(memoryCalls(checked, "get")[0]!);
    assert.ok(local);
    assert.equal(selectTsonicProviderPointerResult(local, source.ast, semantics, source.sourceFacts, policy), undefined);
    if (name === "word") {
      assert.equal(selectTsonicProviderPointerResult(call, source.ast, semantics, source.sourceFacts, {
        ...policy, primitive: () => undefined,
      })?.kind, "invalid");
      const conflicting = { ...source.sourceFacts,
        getFact: (<Value>(...args: Parameters<typeof source.sourceFacts.getFact<Value>>) =>
          args[1].id === sourceMarkerFactKey.id ? { kind: "type-marker", marker: "raw-pointer" } as Value :
            source.sourceFacts.getFact(...args)),
      };
      assert.equal(selectTsonicProviderPointerResult(call, source.ast, semantics, conflicting, policy)?.kind, "invalid");
    }
  });
}
