import { createJsSourceApiFacts } from "../../packages/js-source-profile/dist/index.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension, tsonicCoreSourceSemanticsModules } from "../../packages/source-core/dist/public/index.js";
import { createHostSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/host.js";
import { typescriptNoLibUtilityDeclarations } from "../../packages/target-api/dist/public/provider.js";
import { createSourceProfileStorageEffects, createSourceStorageQuery } from "../../packages/target-api/dist/target-analysis/index.js";
import { jsSurfaceSourceProfileDeclarations } from "../../packages/js-source-profile/dist/index.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

// The JS source profile declares Generator / AsyncGenerator / Error, so the Host composes the resume and
// callback effects from facts.profile (facts.analyses.storage) instead of a test-local selector.
const jsProfileFiles = Object.freeze({
  "/src/.tsonic/source-profiles/js/typescript-utilities.d.ts": typescriptNoLibUtilityDeclarations,
  "/src/.tsonic/source-profiles/js/js-globals.d.ts": jsSurfaceSourceProfileDeclarations,
});

function fixture(body, override) {
  const files = { ...jsProfileFiles, "/src/index.ts": `export {}; ${body}` };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files, rootFiles: Object.keys(files),
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler", noLib: true },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension()] },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createHostSourceProgram(checked, { profile: createJsSourceApiFacts, platform: { kind: "known", nativeIntegerBits: 64, basis: "test" } });
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const visit = node => { nodes.push(node); source.ast.forEachChild(node, visit); };
  visit(file);
  // override: a malformed call effect over the Host composition (internal query), to prove admission rejects it.
  const storage = override === undefined
    ? source.facts.analyses.storage({ sourceFiles: [file], premises: {} })
    : createSourceStorageQuery(source, [file], undefined, { ...createSourceProfileStorageEffects(source, {}), call: override });
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
      assert.equal(domain.kind === "complete", true,
        `${name}: checked result allocation; ${domain.kind}; ${domain.kind === "unresolved" ? domain.reason : domain.kind === "open"
          ? domain.boundaries.slice(0, 8).map(boundary => boundary.kind).join(",") : "closed"}`);
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

for (const stored of [false, true]) {
  test(`an asynchronous resume retains its own native value producer, stored=${stored}`, () => {
    const current = fixture(`
      async function* g(): AsyncGenerator<number> { yield 1; }
      const iterator = g();
      ${stored ? "const pending = iterator.next();" : ""}
      const result = ${stored ? "pending" : "iterator.next()"};
    `);
    const invocation = current.initializer(stored ? "pending" : "result");
    const selected = current.storage.storageProducersFor(current.subject(current.initializer("result")));
    assert.equal(selected.kind === "open", true,
      `the actual native resume result retains its opaque result boundary (${selected.kind}${selected.kind === "unresolved" ? ": " + selected.reason : ""})`);
    assert.equal(selected.producers.length, 1, "one original native resume supplies the result");
    assert.equal(selected.producers[0].subject.node === invocation, true, "the original resume is not its generator creation");
    assert.equal(selected.producers[0].subject.projection.length, 0, "the producer is the complete native result");
    assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-result" && boundary.exposure === invocation),
      true, "publishing the native result never manufactures body purity or original allocation");
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
