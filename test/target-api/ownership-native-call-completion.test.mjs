import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension, tsonicCoreSourceSemanticsModules } from "../../packages/source-core/dist/public/index.js";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, createSourceSuspensionQuery, createSourceStorageBudget, defaultSourceStorageLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    import { loadptr } from "@tsonic/core/lang.js";
    import type { Pointer } from "@tsonic/core/types.js";
    export function read(pointer: Pointer<object>): object { return loadptr(pointer); }
    const unrelated = 0;
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension()] },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "the native pointer read has exact checked evidence");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const call = requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node));
  const storage = createSourceStorageQuery(source, [file]);
  const subject = storage.subjectFor(call);
  assert.equal(subject.kind === "resolved", true, "the native invocation has its original canonical subject");
  const selected = source.semantics.forNode(call).operations.call(call);
  assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "the native invocation has a checked selected signature");
  const contractDeclaration = source.semantics.forNode(call).declarations.signatureDeclaration(selected.selectedSignature);
  const type = storage.typeFor(subject.subject);
  assert.equal(type.kind === "resolved" && contractDeclaration !== undefined, true, "exact contract type and native declaration");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const evidence = { kind: "never", value: subject.subject, checkedType: type.type, contractDeclaration };
  return { source, file, call, storage, subject: subject.subject, budget, evidence };
}

for (const resultFirst of [false, true]) {
  test(`native invocation completion does not require an invented external pointee (${resultFirst})`, () => {
    const current = fixture();
    const query = createSourceSuspensionQuery({ ...current,
      premises: { suspensionFor: value => value === current.subject ? current.evidence : undefined } });
    const inspectValue = () => {
      const selected = query.forResult(current.call, current.storage.emptyBindings);
      assert.equal(selected.kind, "unresolved", "result adoption still requires the actual unknown pointee's producer proof");
    };
    const inspectInvocation = () => {
      const selected = query.forCall(current.call, current.storage.emptyBindings);
      assert.equal(selected.kind, "never", "the original native operation's declared completion contract is independent of its unknown payload");
      assert.equal(query.forCall(current.call, current.storage.emptyBindings) === selected, true, "one exact invocation/context decision");
    };
    for (const inspect of resultFirst ? [inspectValue, inspectInvocation] : [inspectInvocation, inspectValue]) inspect();
    assert.equal(current.storage.storageProducersFor(current.subject).kind, "unresolved", "no pointee, allocation or stored value was fabricated");
    assert.equal(current.storage.failureReason(), undefined, "an unknown input is not global budget exhaustion");
    assert.equal(current.budget.failure(), undefined, "both legitimate questions retain finite shared ownership evidence");
  });
}

test("native invocation completion still requires the exact declared operation contract", () => {
  const current = fixture();
  const unrelated = sourceType(current, current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast,
    current.file, "unrelated")).Initializer);
  for (const replacement of [undefined, { value: { ...current.subject } }, { checkedType: unrelated },
    { contractDeclaration: namedVariable(current.source.ast, current.file, "unrelated") }]) {
    const query = createSourceSuspensionQuery({ ...current, premises: { suspensionFor: () => replacement === undefined
      ? undefined : { ...current.evidence, ...replacement } } });
    assert.equal(query.forCall(current.call, current.storage.emptyBindings).kind, "unresolved",
      "missing, foreign, mistyped and unrelated declarations never authorize an empty native continuation");
  }
  const query = createSourceSuspensionQuery({ ...current, premises: { suspensionFor: () => current.evidence } });
  const foreign = fixture();
  assert.equal(query.forCall(foreign.call, current.storage.emptyBindings).kind, "unresolved", "foreign calls stay outside the checked source");
  assert.equal(query.forCall(current.call, { ...current.storage.emptyBindings }).kind, "unresolved", "copied activation bindings remain foreign");
});

function sourceType(current, node) {
  const selected = current.source.semantics.forNode(node).types.expressionType(node);
  assert.equal(selected !== undefined, true, "exact negative-control source type");
  return selected;
}
