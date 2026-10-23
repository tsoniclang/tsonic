import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { selectJsSourceCallStorageEffect, jsSourceCallableParameterEffects } from "../../packages/js-source-profile/dist/index.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, override) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, visit); };
  visit(file);
  const identity = (node, call) => {
    const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature);
    const owner = declaration === undefined ? undefined : source.ast.parent(declaration);
    return owner === undefined ? undefined : { declaration,
      ownerName: source.ast.text(source.ast.name(owner)), memberName: source.ast.text(source.ast.name(declaration)) };
  };
  const storage = createSourceStorageQuery(source, [file], undefined, {
    call: (node, call) => override === undefined ? selectJsSourceCallStorageEffect(identity(node, call), call)?.effect : override(node, call),
    callbackEntries: (node, call) => jsSourceCallableParameterEffects(identity(node, call)),
  });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const subject = node => {
    const selected = storage.subjectFor(node);
    assert.equal(selected.kind === "resolved", true, "checked source subject");
    return selected.subject;
  };
  return { source, storage, nodes, initializer, subject };
}

test("generator body writes are deferred while parameter defaults remain creation effects", () => {
  const current = fixture(`
    const initial = {}, parameter = {}, body = {};
    let state = initial;
    function* g(value = (state = parameter)) { state = body; yield value; }
    const pending = g();
    const observed = state;
  `);
  const selected = current.storage.closedOriginsFor(current.subject(current.initializer("observed")));
  assert.equal(selected.kind === "complete", true, "creation effects have complete checked origins");
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("parameter")), true, "the default runs at creation");
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("body")), false, "creation never runs the deferred body");
});

for (const member of ["next", "throw", "return"]) {
  test(`checked ${member} retains the original generator creation frame as a may-resume`, () => {
    const current = fixture(`
      const firstValue = {}, secondValue = {};
      function make(value: object) {
        function* g(): Generator<void> { const observed = value; yield; }
        return g();
      }
      const first = make(firstValue), second = make(secondValue);
      first.${member}(${member === "throw" ? "new Error()" : "undefined"});
      second.${member}(${member === "throw" ? "new Error()" : "undefined"});
    `);
    const owner = current.nodes.find(node => current.source.ast.is.IsFunctionDeclaration(node) && current.source.ast.text(current.source.ast.name(node)) === "g");
    const demand = current.subject(current.initializer("observed"));
    const contexts = [];
    for (const [name, expected, excluded] of [["first", "firstValue", "secondValue"], ["second", "secondValue", "firstValue"]]) {
      const domain = current.storage.storageProducersFor(current.subject(current.initializer(name)));
      assert.equal(domain.kind === "complete", true, `${name}: checked result allocation`);
      assert.equal(domain.producers.length, 1, `${name}: one original creation`);
      const entry = domain.producers[0];
      const selected = current.storage.contributingExecutionsFor(demand, owner, entry);
      assert.equal(selected.kind === "complete", true,
        `${name}: may-resume has the retained original frame; ${selected.reason ?? selected.kind}`);
      const origins = selected.producers.flatMap(producer => {
        const values = current.storage.storageProducersFor(demand, producer.bindings);
        assert.equal(values.kind === "complete", true, `${name}: same-frame demanded payload`);
        return values.producers;
      });
      assert.equal(origins.some(origin => origin.subject.node === current.initializer(expected)), true, `${name}: the actual input reaches the body`);
      assert.equal(origins.some(origin => origin.subject.node === current.initializer(excluded)), false, `${name}: another creation's input never crosses the frame`);
      const activations = current.storage.boundActivationsFor(owner, entry.bindings);
      assert.equal(activations.kind === "resolved", true, `${name}: original creation activation`);
      const activation = activations.activations[0];
      assert.equal(activation.kind, "invocation", `${name}: actual generator creation, not declaration entry`);
      const key = current.storage.invocationContextKeyFor(activation.invocation, activation.callerBindings);
      assert.equal(key.kind, "resolved", `${name}: exact original creation identity`);
      contexts.push(key.key);
    }
    assert.notEqual(contexts[0], contexts[1], "one inner call site under two factory calls makes different generator objects");
  });
}

test("an unchecked generator result cannot invent an original body activation", () => {
  const current = fixture(`
    declare const pending: Generator<void>;
    function* g() { const observed = pending; yield; }
    pending.next();
  `);
  const domain = current.storage.storageProducersFor(current.subject(current.initializer("observed")));
  assert.notEqual(domain.kind, "complete", "an external receiver never supplies a fabricated generator creation");
});

test("a malformed resume contract without a checked receiver fails admission", () => {
  const current = fixture("declare function run(): void; run();", () => ({ resumeReceiver: true }));
  assert.equal(current.storage.failureReason() !== undefined, true, "resumeReceiver is valid only for a checked receiver operation");
});
