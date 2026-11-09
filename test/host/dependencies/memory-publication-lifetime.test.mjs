import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../../../packages/source-core/dist/identity.js";
import { createMemoryPublicationOwner, readMemoryPublicationSources,
  tsonicMemorySourceFactKey } from "../../../packages/source-core/dist/host-input/memory-publications.js";

function originalPublication() {
  let original;
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": "declare function identity<Value>(value: Value): Value; export const result = identity<number>(1);",
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  extensionHostOptions: { extensions: [{ identity: { id: tsonicCoreSourceExtensionId, version: "1" },
    analyzeSource(context) {
      const file = context.source.getSourceFile("/src/index.ts");
      assert.equal(file !== undefined, true);
      const { ast, checker } = context.source.getSourceFileQueries(file);
      const calls = [];
      const pending = [file];
      while (pending.length !== 0) {
        const node = pending.pop();
        if (ast.is.IsCallExpression(node)) calls.push(node);
        ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
      }
      assert.equal(calls.length, 1, "the complete original call domain is required");
      const call = calls[0];
      const selected = checker.getResolvedCallInfo(call);
      assert.equal(selected.kind, "applicable");
      const application = selected.selection.application;
      assert.equal(application.signatureTypeArguments.length, 1, "the complete original binder domain is required");
      const argument = application.signatureTypeArguments[0];
      assert.equal(argument.declaration !== undefined && argument.checkedArgument !== undefined, true);
      const source = { kind: "binding", application, argument, declaration: argument.declaration, sourceType: argument.checkedArgument };
      const owner = createMemoryPublicationOwner(context.source);
      const value = owner.create(call, { source, owner: undefined });
      assert.equal(context.facts.set(call, tsonicMemorySourceFactKey, value), "inserted");
      original = { call, owner, source, value };
    },
  }] } }).checkSource();
  assert.equal(checked.diagnostics.filter(value => value !== undefined).length, 0);
  assert.equal(checked.extensionDiagnostics.length, 0);
  assert.equal(original !== undefined, true, "the actual program analysis creates its only publication owner");
  return { ...original, checked };
}

test("memory publication authority belongs to its genuine program and original application/binder", () => {
  const first = originalPublication();
  const second = originalPublication();
  const selected = readMemoryPublicationSources(first.checked, first.checked.sourceFacts, first.call);
  assert.equal(selected !== undefined, true);
  assert.equal(selected.source.application === first.source.application && selected.source.argument === first.source.argument &&
    selected.source.declaration === first.source.declaration && selected.source.sourceType === first.source.sourceType, true,
  "the finalized snapshot retains every original application/binder/observed-component identity");
  assert.equal(Object.isFrozen(selected) && Object.isFrozen(selected.source), true);
  assert.equal(readMemoryPublicationSources(second.checked, second.checked.sourceFacts, second.call) !== undefined, true);
  assert.throws(() => readMemoryPublicationSources(second.checked, first.checked.sourceFacts, first.call),
    /original program, publication or occurrence boundary/);
  assert.throws(() => first.owner.create(second.call, { source: second.source, owner: undefined }), /original checked program/);
  assert.throws(() => tsonicMemorySourceFactKey.snapshot({ ...first.value }), /original per-program factual publication/);
  assert.throws(() => tsonicMemorySourceFactKey.snapshot({ ...first.value, authority: second.owner }),
    /original per-program factual publication/);
  assert.throws(() => first.owner.create(first.call, { source: { ...first.source, declaration: first.call }, owner: undefined }),
    /identical original binder and observed argument/);
  assert.throws(() => first.owner.create(first.call, { source: first.source, owner: second.source }), /exact original application/);
});
