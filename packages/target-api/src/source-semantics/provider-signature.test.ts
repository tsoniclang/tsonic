import assert from "node:assert/strict";
import { test } from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, TstsSourceProviderContractVersion } from "@tsonic/tsts";
import type { Node, ProviderDeclarationModel, ProviderVirtualDeclarationDocument, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceProviderSignature } from "./provider-signature.js";

const word = { kind: "source-primitive", name: "uint32" } as const;
const text = { kind: "string" } as const;
const model: ProviderDeclarationModel = {
  moduleSpecifier: "test:exact-model", providerModuleId: "source.model",
  exports: [{ id: "export.choose", name: "choose", kind: "function", signatures: [
    { id: "signature.number", parameters: [{ name: "input", type: word }], returnType: word },
    { id: "signature.string", parameters: [{ name: "input", type: text }], returnType: text },
  ] }, {
    id: "export.api", name: "api", kind: "class", members: [{
      id: "member.read", name: "read", kind: "method", static: true,
      signatures: [{ id: "signature.read", parameters: [], returnType: word }],
    }],
  }, {
    id: "export.callback", name: "callback", kind: "value", type: {
      kind: "function", id: "signature.outer", parameters: [], returnType: {
        kind: "function", id: "signature.inner", parameters: [{ name: "value", type: word }], returnType: word,
      },
    },
  }, {
    id: "export.holder", name: "Holder", kind: "class", typeParameters: [{ name: "Value" }], members: [{
      id: "member.get", name: "get", kind: "method", signatures: [{ id: "signature.get", parameters: [],
        returnType: { kind: "type-parameter", name: "Value" } }],
    }, {
      id: "member.map", name: "map", kind: "method", signatures: [{ id: "signature.map",
        typeParameters: [{ name: "Mapped" }], parameters: [{ name: "value", type: { kind: "type-parameter", name: "Mapped" } }],
        returnType: { kind: "type-parameter", name: "Mapped" } }],
    }],
  }],
};

function fixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": `
      import { choose as alias, api, callback } from "test:exact-model";
      import type { Holder } from "test:exact-model";
      declare const holder: Holder<number>;
      holder.get(); holder.map<string>("value");
      alias(1); alias("text"); api.read(); callback()(1);
      function local(): number { return 1; }
      local();
    ` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    extensionHostOptions: { extensions: [{ identity: { id: "test.model", version: "1" }, initialize(context) {
      context.registerSourceDeclarationProvider({
        identity: { id: "test.model.provider", version: "1", extensionContractVersion: TstsSourceProviderContractVersion },
        declarationMaterialization: "complete",
        ownsModule: specifier => ({ kind: specifier === model.moduleSpecifier ? "owned" : "unowned" }),
        resolveModule: specifier => ({ kind: "virtual", moduleSpecifier: specifier,
          providerModuleId: model.providerModuleId, virtualFileName: "/virtual/model.d.ts" }),
        getDeclarationModel: () => model,
      });
    } }] },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const declarations = new Map<string, Node>();
  const ids: string[] = [];
  let ordinary = 0;
  const visit = (node: Node): void => {
    if (source.ast.is.IsCallExpression(node)) {
      const call = semantics.operations.call(node);
      assert.ok(call);
      const result = semantics.operations.callResult(call);
      assert.ok(result);
      const selected = result.providerSignature;
      if (selected === undefined) ordinary++;
      else {
        assert.equal(selected.kind, "available");
        if (selected.kind === "available") {
          ids.push(selected.signature.id);
          assert.equal(semantics.operations.callResult(call)?.providerSignature, selected);
          const declaration = semantics.declarations.signatureDeclaration(call.selectedSignature);
          assert.ok(declaration);
          declarations.set(selected.signature.id, declaration);
        }
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  return { facts: checked.sourceFacts, declarations, ids, ordinary };
}

test("provider call results retain exact overload, member and nested callable source models", () => {
  const selected = fixture();
  assert.deepEqual(selected.ids.sort(), ["signature.get", "signature.inner", "signature.map", "signature.number", "signature.outer", "signature.read", "signature.string"]);
  assert.equal(selected.ordinary, 1);
  const result = selectSourceProviderSignature(selected.facts, selected.declarations.get("signature.number"));
  assert.equal(result?.kind, "available");
  if (result?.kind === "available") assert.deepEqual(result.signature.returnType, word);
  for (const id of ["signature.get", "signature.map"]) {
    const selection = selectSourceProviderSignature(selected.facts, selected.declarations.get(id));
    assert.equal(selection?.kind, "available");
    if (selection?.kind === "available") {
      assert.deepEqual(selection.typeParameters.map(value => [value.scope, value.ownerId, value.index, value.parameter.name]),
        id === "signature.get" ? [["export", "export.holder", 0, "Value"]] :
          [["export", "export.holder", 0, "Value"], ["signature", "signature.map", 0, "Mapped"]]);
      assert.ok(Object.isFrozen(selection.typeParameters));
      assert.ok(selection.typeParameters.every(Object.isFrozen));
    }
  }
});

for (const mutation of ["missing-document", "stale-version", "missing-export", "duplicate-signature", "conflicting-staticness"] as const) {
  test(`provider source signature rejects ${mutation} without reconstructing names`, () => {
    const selected = fixture();
    const documentFor = (name: string): ProviderVirtualDeclarationDocument | undefined => {
      const document = selected.facts.getVirtualDeclarationDocument(name);
      if (document === undefined || mutation === "missing-document") return undefined;
      if (mutation === "stale-version") return { ...document, provider: { ...document.provider, version: "stale" } };
      const exports = mutation === "missing-export" ? [] : document.declarationModel.exports.map(exported => ({
        ...exported,
        ...(mutation === "duplicate-signature" && exported.signatures !== undefined
          ? { signatures: [...exported.signatures, ...exported.signatures] } : {}),
        ...(mutation === "conflicting-staticness" && exported.members !== undefined
          ? { members: exported.members.map(member => ({ ...member, static: !member.static })) } : {}),
      }));
      return { ...document, declarationModel: { ...document.declarationModel, exports } };
    };
    const facts: ReadonlySourceFactResolver = {
      getFact: (subject, key) => selected.facts.getFact(subject, key),
      getFacts: subject => selected.facts.getFacts(subject),
      getVirtualDeclarationDocument: documentFor,
    };
    const declaration = selected.declarations.get(mutation === "conflicting-staticness" ? "signature.read" : "signature.number");
    assert.equal(selectSourceProviderSignature(facts, declaration)?.kind, "invalid");
  });
}
