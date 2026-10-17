import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { analyzeSourceGenericAdoption } from "./generic-adoption.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import type { SourceStorageEffects } from "../source-storage/model/types.js";

function nativeEntryFixture(text: string, timing?: "synchronous" | "deferred") {
  return fixture(text, "/src", (source, nodes) => {
    const declaration = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "nativeInvoke");
    assert.equal(declaration !== undefined && source.ast.body(declaration) === undefined, true,
      "one exact checked ambient declaration owns this unit fixture's native contract");
    return Object.freeze({ callbackEntries(node, selected) {
      return timing !== undefined && source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === declaration
        ? Object.freeze([{ parameterIndex: 0, timing }]) : undefined;
    } } satisfies SourceStorageEffects);
  });
}

for (const timing of ["synchronous", "deferred", undefined] as const) {
  for (const ordinary of [false, true]) {
    test("native callback resolver sensitivity preserves " + timing + "/" + (ordinary ? "ordinary" : "adopting") + " actual", () => {
      const current = nativeEntryFixture(`
        declare function nativeInvoke(callback: () => void): void;
        function wrap<Value>(value: Value): Promise<Value> {
          return new Promise<Value>(resolve => { nativeInvoke(() => { resolve(value); }); });
        }
        ${ordinary
          ? "export function use(value: number): void { void wrap(value); }"
          : "export function use(value: Promise<number>): void { void wrap(value); }"}
      `, timing);
      const selected = current.query();
      if (ordinary) {
        assert.equal(selected.kind, "resolved", "canonical Awaited ordinary proof precedes local unresolved sensitivity");
        if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "no blanket native callback refusal");
      } else if (timing === undefined) {
        assert.equal(selected.kind, "unresolved", "an opaque callback is not certified by zero source edges");
        if (selected.kind === "unresolved") assert.equal(current.textFor(selected.at), "resolve(value)",
          "the actual unresolved resolving operation owns the reason");
      } else {
        assert.equal(selected.kind, "resolved", "known native execution has complete shared admission");
        if (selected.kind === "resolved") {
          assert.equal(selected.issues.length, 1, "one unsupported actual generic adoption");
          assert.equal(current.textFor(selected.issues[0]!.site), "wrap(value)", "the actual instantiation owns C15");
          assert.equal(current.textFor(selected.issues[0]!.operation), "resolve(value)", "the captured real resolver is sensitive");
        }
      }
    });
  }
}

for (const reversed of [false, true]) {
  test("native helper callback/value rows stay correlated in source admission, order=" + reversed, () => {
    const current = nativeEntryFixture(`
      declare function nativeInvoke(callback: () => void): void;
      function deliver<Part>(callback: (value: Part) => void, value: Part): void {
        nativeInvoke(() => { callback(value); });
      }
      function wrap<Value>(value: Value): Promise<number> {
        return new Promise<number>(resolve => {
          const observer = (actual: Value): void => { void actual; };
          ${reversed ? "deliver(resolve, 7); deliver(observer, value);" : "deliver(observer, value); deliver(resolve, 7);"}
        });
      }
      export function use(value: Promise<number>): void { void wrap(value); }
    `, "synchronous");
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "actual source entries and existing equations are complete");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
      "only resolver/number is sensitive; observer/Promise must not taint the helper binder globally");
  });
}

test("an uncalled nested callback does not create native resolver adoption", () => {
  const current = nativeEntryFixture(`
    declare function nativeInvoke(callback: () => void): void;
    function wrap<Value>(value: Value): Promise<Value> {
      return new Promise<Value>((resolve, reject) => {
        function unused(): void { nativeInvoke(() => { resolve(value); }); }
        reject(new Error("expected"));
      });
    }
    export function use(value: Promise<number>): void { void wrap(value); }
  `, "synchronous");
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "canonical unused-body evidence remains authoritative");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "no AST-nesting sensitivity");
});

test("a foreign same-spelled source body does not acquire a native callback contract", () => {
  const current = fixture(`
    function nativeInvoke(callback: () => void): void { void callback; }
    function wrap<Value>(value: Value): Promise<Value> {
      return new Promise<Value>((resolve, reject) => {
        nativeInvoke(() => { resolve(value); });
        reject(new Error("expected"));
      });
    }
    export function use(value: Promise<number>): void { void wrap(value); }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "the source implementation, not spelling, owns execution");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "the foreign body never invokes its callback");
});

test("a foreign Promise constructor is not a native executor or resolver by spelling", () => {
  const current = fixture(`
    export function use<Value>(value: Value): void {
      class Promise<Part> { constructor(executor: (resolve: (value: Part) => void) => void) { void executor; } }
      void new Promise<Value>(resolve => { resolve(value); });
    }
    export function run(promised: Promise<number>): void { use(promised); }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "actual checked foreign constructor is distinct");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "no native resolver is invented for a source constructor");
});

test("a native default initializer does not taint a proven present ordinary callback input", () => {
  const current = fixture(`
    declare function nativeInvoke(values: number[], callback: (value: number) => void): void;
    function wrap<Value>(value: Value): Promise<number | Value> {
      return new Promise<number | Value>(resolve => {
        nativeInvoke([7], (actual: number | Value = value) => { resolve(actual); });
      });
    }
    export function run(promised: Promise<number>): void { void wrap(promised); }
  `, "/src", (source, nodes) => {
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === "nativeInvoke");
    return { callbackEntries(node, selected) {
      return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
        ? [{ parameterIndex: 1, timing: "synchronous", inputs: [{ parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 }] }]
        : undefined;
    } };
  });
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "checked required number input excludes its authored default");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "the unused default does not create generic adoption");
});

for (const ordinary of [false, true]) {
  test("native contextual input bounds qualify the same generic source callback: ordinary=" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          function deliver<Actual extends Value>(actual: Actual): void { resolve(actual); }
          nativeInvoke([value], deliver);
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
        source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "the selected native signature is a checked input bound, not a value witness");
    if (selected.kind === "resolved") {
      assert.equal(selected.issues.length, ordinary ? 0 : 1, "only the actual outer adopting binder is refused");
      if (!ordinary) assert.equal(current.textFor(selected.issues[0]!.site), "wrap(value)", "original checked instantiation site");
    }
  });
}

for (const ordinary of [false, true]) {
  test("an actual native resolver with an opaque input bound stays demand-local: ordinary=" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke(callback: (actual: any) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => { nativeInvoke(resolve); });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 0, timing: "synchronous" }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, ordinary ? "resolved" : "unresolved", "opaque input is not an invented native value or a global budget rejection");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "canonical ordinary Awaited identity remains sufficient");
    else assert.equal(current.textFor(selected.at), "nativeInvoke(resolve)", "the actual opaque resolver entry owns the missing proof");
  });
}

for (const withDefault of [false, true]) {
  test("zero-input native callback preserves actual absence and its real default: default=" + withDefault, () => {
    const current = nativeEntryFixture(`
      declare function nativeInvoke(callback: () => void): void;
      function wrap<Value>(value: Value): Promise<Value | undefined> {
        return new Promise<Value | undefined>(resolve => {
          nativeInvoke((${withDefault ? "actual: Value = value" : "actual?: Value"}) => { resolve(actual); });
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `, "synchronous");
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "zero-input is an exact checked native signature, not opaque provenance");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, withDefault ? 1 : 0,
      "a missing argument does not adopt; its actually executed captured default does");
  });
}

for (const mapped of [false, true]) for (const ordinary of [false, true]) for (const forwarded of [false, true]) {
  test("native input callable payload retains captured resolver uncertainty: " + mapped + "/" + ordinary + "/" + forwarded, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function deliver(callback: () => void): void { callback(); }
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          const callback = (): void => { resolve(value); };
          nativeInvoke([callback], actual => { ${forwarded ? "deliver(actual);" : "actual();"} });
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous", ...(mapped ? { inputs: [
            { parameterIndex: 0, from: "argument-element", sourceParameterIndex: 0 },
          ] } : {}) }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, mapped || ordinary ? "resolved" : "unresolved",
      "a callable input type cannot prove the absence of a captured generic resolver");
    if (selected.kind === "resolved") {
      assert.equal(selected.issues.length, ordinary ? 0 : 1, "ordinary Awaited identity remains independently sufficient");
      if (!ordinary) assert.equal(current.textFor(selected.issues[0]!.site), "wrap(value)", "only the actual adopting instantiation is refused");
    } else assert.equal(current.textFor(selected.at), "resolve(value)", "the actually demanded captured resolver owns the missing proof");
  });
}

for (const [name, payload] of [
  ["map", "new Map<number, () => void>([[0, callback]])"],
  ["set", "new Set<() => void>([callback])"],
  ["object", "{ callback }"],
  ["class-field", "new Holder()"],
  ["returned-closure", "returned()"],
] as const) for (const ordinary of [false, true]) {
  test("native container payload callable is not silently absent: " + name + "/" + ordinary, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(payload: Part, callback: (actual: () => void) => void): void;
      function wrap<Value>(value: Value): Promise<Value> {
        return new Promise<Value>(resolve => {
          const callback = (): void => { resolve(value); };
          class Holder { callback = (): void => { resolve(value); }; }
          function returned(): () => void { return callback; }
          nativeInvoke(${payload}, actual => { actual(); });
        });
      }
      export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, ordinary ? "resolved" : "unresolved",
      "a real source callable in an opaque native input is potential execution, not proven absence");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "a canonical ordinary native payload stays admitted");
    else assert.equal(current.textFor(selected.at), "resolve(value)", "only the relevant original resolving operation is unresolved");
  });
}

for (const adopting of [false, true]) for (const reversed of [false, true]) {
  test("opaque native payloads keep actual returned-closure factory rows: " + adopting + "/" + reversed, () => {
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { done(value); }; }
      function wrap<Value>(value: Value): Promise<Value | number> {
        return new Promise<Value | number>(resolve => {
          const observer = make((actual: Value): void => { void actual; }, value);
          const completion = make(resolve, ${adopting ? "value" : "7"});
          ${reversed ? `${adopting ? "observer" : "completion"}(); nativeInvoke([${adopting ? "completion" : "observer"}], next => { next(); });`
            : `nativeInvoke([${adopting ? "completion" : "observer"}], next => { next(); }); ${adopting ? "observer" : "completion"}();`}
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, adopting ? "unresolved" : "resolved", "actual factory bindings, not the shared arrow body, select resolver sensitivity");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
      "the unused Value union arm cannot be tainted by an observer or the separately resolved number");
    else assert.equal(current.textFor(selected.at), "done(value)", "only the genuinely possible captured resolver input remains unresolved");
  });
}

test("a factory callee is not a returned native callback payload", () => {
  const current = fixture(`
    declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
    function make<Value>(value: Value, done: (actual: number) => void): () => void { done(7); return () => { void value; }; }
    function wrap<Value>(value: Value): Promise<Value | number> {
      return new Promise<Value | number>(resolve => { const observer = make(value, resolve); nativeInvoke([observer], next => { next(); }); });
    }
    export function run(value: Promise<number>): void { void wrap(value); }
  `, "/src", (source, nodes) => {
    const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
    return { callbackEntries(node, selected) {
      return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
        ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
    } };
  });
  const selected = current.query();
  assert.equal(selected.kind, "resolved", "the canonical value relation excludes the already executed source factory");
  if (selected.kind === "resolved") assert.equal(selected.issues.length, 0, "the returned closure observes Value but never resolves it");
});

const nativePayloadContinuationCases = [
  {
    "name": "source-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "source-helper-chain",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function forward<Part>(done: (value: Part) => void, value: Part): void { send(done, value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { forward(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "native-forwarded-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part): void { done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(value)"
  },
  {
    "name": "default-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part, actual: Part = value): void { done(actual); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value); }; }",
    "ordinary": "send(resolve, 7);",
    "adopter": "send((actual: number): void => { void actual; }, 7);",
    "expression": "done(actual)"
  },
  {
    "name": "component-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, input: { payload: Part }): void { done(input.payload); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, { payload: value }); }; }",
    "ordinary": "send(resolve, { payload: 7 });",
    "adopter": "send((actual: number): void => { void actual; }, { payload: 7 });",
    "expression": "done(input.payload)"
  },
  {
    "name": "recursive-helper",
    "declarations": "function send<Part>(done: (value: Part) => void, value: Part, depth: number): void { if (depth > 0) send(done, value, depth - 1); else done(value); } function make<Part>(done: (value: Part) => void, value: Part): () => void { return () => { send(done, value, 1); }; }",
    "ordinary": "send(resolve, 7, 1);",
    "adopter": "send((actual: number): void => { void actual; }, 7, 1);",
    "expression": "done(value)"
  },
  {
    "name": "receiver-helper",
    "declarations": "class Relay<Part> { constructor(readonly done: (value: Part) => void, readonly value: Part) {} run(): void { this.done(this.value); } } function make<Part>(done: (value: Part) => void, value: Part): () => void { const relay = new Relay(done, value); return () => { relay.run(); }; }",
    "ordinary": "new Relay(resolve, 7).run();",
    "adopter": "new Relay((actual: number): void => { void actual; }, 7).run();",
    "expression": "this.done(this.value)"
  }
] as const;

for (const form of nativePayloadContinuationCases) for (const adopting of [false, true]) {
  for (const ordinary of [false, true]) for (const reversed of [false, true]) {
    test("native payload demand-owner continuation keeps exact " + form.name + "/" + adopting + "/" + ordinary + "/" + reversed, () => {
      const expose = form.name === "native-forwarded-helper"
        ? "nativeInvoke([payload], next => { nativeAgain(next); });"
        : "nativeInvoke([payload], next => { next(); });";
      const separate = adopting ? form.adopter : form.ordinary;
      const creation = adopting ? "make(resolve, value)" : "make((actual: Value): void => { void actual; }, value)";
      const current = fixture(`
        declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
        declare function nativeAgain(callback: () => void): void;
        ${form.declarations}
        function wrap<Value>(value: Value): Promise<Value | number> {
          return new Promise<Value | number>(resolve => {
            const payload = ${creation};
            ${reversed ? separate + expose : expose + separate}
          });
        }
        export function run(value: ${ordinary ? "number" : "Promise<number>"}): void { void wrap(value); }
      `, "/src", (source, nodes) => {
        const invoke = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
        const again = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeAgain");
        return { callbackEntries(node, selected) {
          const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
          return declaration === invoke ? [{ parameterIndex: 1, timing: "synchronous" }]
            : declaration === again ? [{ parameterIndex: 0, timing: "synchronous" }] : undefined;
        } };
      });
      const selected = current.query();
      assert.equal(selected.kind, adopting && !ordinary ? "unresolved" : "resolved",
        selected.kind === "unresolved"
          ? `possible helper invocations retain their demanded owner, not a source-global argument union: ${selected.reason}`
          : "possible helper invocations retain their demanded owner, not a source-global argument union");
      if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
        "ordinary identity or the actual observer/number inverse stays admitted");
      else assert.equal(current.textFor(selected.at), form.expression, "the relevant resolving helper demand owns uncertainty");
    });
  }
}

for (const form of ["uncalled", "nonresolver", "ignored-source-argument", "unused-native-input"] as const) {
  test("opaque native inputs do not taint unrelated resolving paths: " + form, () => {
    const payload = form === "nonresolver" ? "() => { void value; }" : "() => { resolve(value); }";
    const run = form === "uncalled" ? "void actual;"
      : form === "unused-native-input" ? "(() => {})();" : "actual();";
    const current = fixture(`
      declare function nativeInvoke<Part>(values: Part[], callback: (actual: Part) => void): void;
      function ignore(callback: () => void): () => void { void callback; return () => {}; }
      function wrap<Value>(value: Value): Promise<Value | number> {
        return new Promise<Value | number>(resolve => {
          const payload = ${payload};
          nativeInvoke([${form === "ignored-source-argument" ? "ignore(payload)" : "payload"}], actual => { ${run} });
          resolve(7);
        });
      }
      export function run(value: Promise<number>): void { void wrap(value); }
    `, "/src", (source, nodes) => {
      const native = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) && source.ast.text(source.ast.name(node)) === "nativeInvoke");
      return { callbackEntries(node, selected) {
        return source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature) === native
          ? [{ parameterIndex: 1, timing: "synchronous" }] : undefined;
      } };
    });
    const selected = current.query();
    assert.equal(selected.kind, "resolved", "only relevant callable payloads may open resolver execution");
    if (selected.kind === "resolved") assert.equal(selected.issues.length, 0,
      "unused or proven nonresolving payloads do not create a generic adoption refusal");
  });
}

function fixture(text: string, projectRoot = "/src", effectsFor?: (source: TargetSourceProgram, nodes: readonly Node[]) => SourceStorageEffects) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: projectRoot, files: { [`${projectRoot}/index.ts`]: text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics
    .filter((diagnostic): diagnostic is NonNullable<typeof diagnostic> => diagnostic !== undefined).slice(0, 3)).slice(0, 2048));
  const source = createTargetSourceProgram(checked);
  const nodes: Node[] = [];
  const visit = (node: Node): void => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const file of source.sourceFiles) if (!source.ast.isDeclarationFile(file)) visit(file);
  const storage = createSourceStorageQuery(source, source.sourceFiles, undefined, effectsFor?.(source, nodes));
  const query = (maximumSteps = defaultSourceStorageLimits.maximumSteps, exemptTypeParameter?: (node: Node) => boolean) =>
    analyzeSourceGenericAdoption({ source, projectRoot, nodes, storage, budget: createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps }),
      ...(exemptTypeParameter === undefined ? {} : { exemptTypeParameter }) });
  const textFor = (node: Node): string => Buffer.from(source.ast.getSourceText(source.ast.getSourceFile(node)!))
    .subarray(source.ast.pos(node), source.ast.end(node)).toString("utf8").trim();
  return { source, nodes, query, textFor };
}

function sourcePosition(source: TargetSourceProgram, node: Node, finish = false) {
  const bytes = Buffer.from(source.ast.getSourceText(source.ast.getSourceFile(node)!));
  const leading = /^[\t\n\v\f\r ]*/u.exec(bytes.subarray(source.ast.pos(node), source.ast.end(node)).toString("utf8"))![0];
  const position = finish ? source.ast.end(node) : source.ast.pos(node) + Buffer.byteLength(leading);
  const lines = bytes.subarray(0, position).toString("utf8").split(/\r\n|\r|\n/u);
  return { line: lines.length, column: [...lines[lines.length - 1]!].length + 1 };
}

function sourceSpan(source: TargetSourceProgram, node: Node) {
  const start = sourcePosition(source, node);
  const finish = sourcePosition(source, node, true);
  return { fileName: "index.ts", ...start, endLine: finish.line, endColumn: finish.column };
}

const identity = "async function identity<T>(value: T) { return value; }";
const declarations = [
  ["direct return", identity, "identity"],
  ["await forwarding", `${identity}\nasync function outer<V>(value: V) { await identity(value); }`, "outer"],
  ["local await forwarding", `${identity}\nasync function outer2<V>(value: V) { const result = await identity(value); return 0; }`, "outer2"],
  ["synchronous forwarding", `${identity}\nfunction sync<V>(value: V): void { void identity(value); }`, "sync"],
  ["pending forwarding", `async function later<T>(value: T, pending: Promise<void>) { await pending; return value; }
    async function outer3<V>(value: V) { await later(value, Promise.resolve(undefined)); }`, "outer3"],
  ["generic resolving call", "function wrap<T>(value: T): void { void Promise.resolve(value); }", "wrap"],
  ["nested async arrow", "function nested<T>(value: T) { return async () => value; }", "nested"],
  ["reaction return", "function reaction<T>(value: T) { void Promise.resolve(0).then(() => value); }", "reaction"],
  ["reaction catch", "function caught<T>(value: T) { void Promise.resolve(0).catch(() => value); }", "caught"],
  ["reaction finally", "function final<T>(value: T) { void Promise.resolve(0).finally(() => value); }", "final"],
  ["PromiseLike reaction", `function likeReaction<T>(value: T): void {
    const pending: PromiseLike<number> = Promise.resolve(0); void pending.then(() => value);
  }`, "likeReaction"],
  ["named reaction", "function named<T>(value: T) { function read(): T { return value; } void Promise.resolve(0).then(read); }", "named"],
  ["resolve callback", "function resolving<T>(value: T) { return new Promise<T>(resolve => { resolve(value); }); }", "resolving"],
  ["aliased resolver", "function aliased<T>(value: T) { return new Promise<T>(resolve => { const done = resolve; done(value); }); }", "aliased"],
  ["named executor", `function namedExecutor<T>(value: T) {
    function execute(resolve: (value: T | PromiseLike<T>) => void): void { resolve(value); }
    return new Promise<T>(execute);
  }`, "namedExecutor"],
  ["resolver helper", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    function deliver(callback: (value: T) => void): void { callback(value); } deliver(resolve);
  }); }`, "helper"],
  ["generic resolver helper", `function deliver<V>(callback: (value: V) => void, value: V): void { callback(value); }
    function helper<T>(value: T) { return new Promise<T>(resolve => deliver(resolve, value)); }`, "helper"],
  ["member resolver", `function helper<T>(value: T) { return new Promise<T>(resolve => {
    const cell = { done: resolve }; const alias = cell.done; alias(value);
  }); }`, "helper"],
  ["typed returned executor", `type Executor<T> = (resolve: (value: T | PromiseLike<T>) => void) => void;
    function make<T>(value: T): Executor<T> { return resolve => resolve(value); }
    function helper<T>(value: T) { return new Promise<T>(make(value)); }`, "helper"],
  ["generic callable body unknown", `function unknown<Value>(callback: <T>(value: T) => Promise<T>, value: Value): void {
    void callback(value);
  }\nfunction unknownRoot<Value>(value: Value): void { unknown(identity, value); }\n${identity}`, "unknownRoot"],
] as const;

for (const [name, declaration, invoked] of declarations) {
  test(`generic adoption closes ${name} without refusing its ordinary actual`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(7); void ${invoked}(7); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.equal(selected.issues.length, 1, `${name}: exactly one concrete adopting instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), `${invoked}(promised)`, `${name}: refusal is on the actual call, not the generic body`);
    assert.equal(current.source.ast.is.IsTypeParameterDeclaration(issue.parameter), true, `${name}: actual parameter identity`);
    assert.equal(current.nodes.includes(issue.declaration) && current.nodes.includes(issue.operation), true,
      `${name}: declaration and first operation are real checked related nodes`);
    assert.deepEqual(issue.evidence, [
      ["declaration", issue.declaration] as const, ["first-sensitive-operation", issue.operation] as const,
    ].map(([kind, node]) => `${kind} index.ts:${sourcePosition(current.source, node).line}:${sourcePosition(current.source, node).column}`),
    `${name}: one shared owner publishes exact related source coordinates for both targets`);
    assert.deepEqual(issue.sourceSpan, sourceSpan(current.source, issue.site), `${name}: actual instantiation site span`);
    assert.equal(Object.isFrozen(selected.issues) && Object.isFrozen(issue), true, `${name}: immutable completed summary`);
  });
}

test("a generic class static owner stays distinct from its method's actual adoption bindings", () => {
  const current = fixture(`
    class Box<Stored> {
      static count = 0;
      static async wrap<Value>(value: Value): Promise<Value> { return value; }
      constructor(readonly value: Stored) { Box.count += 1; }
    }
    const pending = Promise.resolve(7);
    const ordinary = new Box(7);
    const promised = new Box(pending);
    void Box.count; void ordinary.value; void promised.value;
    void Box.wrap(7); void Box.wrap(pending);
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete static and instance contracts");
  if (selected.kind !== "resolved") return;
  assert.equal(selected.issues.length, 1, "static source ownership does not erase the generic method's adopting actual");
  assert.equal(current.textFor(selected.issues[0]!.site), "Box.wrap(pending)", "the real adopting method call remains the only rejection");
  assert.equal(current.textFor(selected.issues[0]!.operation), "return value;", "the method's exact generic return owns adoption");
});

test("a class parameter and captured structural method are summarized at their actual constructors", () => {
  const current = fixture(`
    class Holder<T> { constructor(readonly value: T) {} async get(): Promise<T> { return this.value; } }
    function make<T>(value: T): { read(): Promise<T> } { return { async read(): Promise<T> { return value; } }; }
    const promised = Promise.resolve(7);
    void new Holder(7); void new Holder(promised); void make(7); void make(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete class summary");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(), ["make(promised)", "new Holder(promised)"]);
});

for (const [name, extra, receiver, expression] of [
  ["incoming", "", "Holder<Promise<number>>", "holder.get()"],
  ["aliased", "type Alias<V> = Holder<V>;", "Alias<Promise<number>>", "holder.get()"],
  ["finite-union", "", "Holder<number> | Holder<Promise<number>>", "holder.get()"],
  ["inherited", "class Derived<U> extends Holder<U> {}", "Derived<Promise<number>>", "holder.get()"],
  ["fixed-inherited", "class Derived extends Holder<Promise<number>> {}", "Derived", "holder.get()"],
  ["indexed-inherited", "class Derived<Parts extends unknown[]> extends Holder<Parts[0]> {}", "Derived<[Promise<number>]>", "holder.get()"],
  ["wrapped-inherited", "class Derived<Part> extends Holder<Promise<Part>> {}", "Derived<number>", "holder.get()"],
  ["conditional-inherited", "class Derived<Part> extends Holder<Part extends number ? number : Promise<number>> {}", "Derived<string>", "holder.get()"],
  ["parenthesized-call", "", "Holder<Promise<number>>", "(holder.get)()"],
  ["getter", "", "Holder<Promise<number>>", "holder.task"],
  ["method-value", "", "Holder<Promise<number>>", "holder.get"],
] as const) {
  test(`generic adoption retains the actual ${name} receiver binding`, () => {
    const current = fixture(`class Holder<T> { constructor(readonly value: T) {}
      async get(): Promise<T> { return this.value; }
      get task(): Promise<T> { return this.get(); }
    } ${extra}
    export function use(holder: ${receiver}) { return ${expression}; }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [expression],
      "every actual receiver alternative is checked, without a callee-property duplicate");
  });
}

test("a receiver forwards sensitivity through the exact outer function binder", () => {
  const current = fixture(`class Holder<T> { constructor(readonly value: T) {}
    async get(): Promise<T> { return this.value; } }
    function forward<V>(holder: Holder<V>) { return holder.get(); }
    export function use(holder: Holder<Promise<number>>) { return forward(holder); }`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "receiver forwarding");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["forward(holder)"],
    "the owning checked call supplies the actual binding, not a guessed member spelling");
});

test("a synchronous class-binder result is native pass-through, not an invented async completion", () => {
  const current = fixture(`interface Method<Value> { read(): Value; }
    interface Property<Value> { read: () => Value; }
    abstract class Abstract<Value> { abstract read(): Value; }
    export function use(method: Method<Promise<number>>, property: Property<Promise<number>>,
      abstract: Abstract<Promise<number>>) {
      void method.read(); void property.read(); void abstract.read();
    }`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "no source await or async result adopts the class's native payload");
});

for (const [name, declaration] of [
  ["interface", "interface Contract<Value> { read(): Promise<Value>; }"],
  ["abstract", "abstract class Contract<Value> { abstract read(): Promise<Value>; }"],
  ["callable-property", "interface Contract<Value> { read: () => Promise<Value>; }"],
  ["class-callable-property", `class Contract<Value> { read: () => Promise<Value>;
    constructor(read: () => Promise<Value>) { this.read = read; } }`],
] as const) {
  test(`unknown ${name} receiver completion keeps its exact class binding fail-closed`, () => {
    const current = fixture(`${declaration}
      export function use(value: Contract<Promise<number>>) { return value.read(); }`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["value.read()"],
      "a bodyless native contract cannot erase the actual generic receiver instantiation");
  });
}

test("an ordinary helper does not become a resolver merely because its callback has the same signature", () => {
  const current = fixture(`function use<T>(value: T): Promise<number> { return new Promise<number>(resolve => {
    function observe(callback: (value: T) => void): void { callback(value); }
    observe(item => { void item; }); resolve(7);
  }); }
  export function run(value: Promise<number>) { return use(value); }`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "resolver provenance is actual storage identity, not callback type");
});

for (const recursive of [false, true]) {
  test(`resolver qualification preserves the whole ${recursive ? "recursive" : "direct"} callback/value row`, () => {
    const helper = recursive ? `function deliver<V>(callback: (value: V) => void, value: V, count: number): void {
      if (count > 0) bounce(callback, value, count - 1); else callback(value);
    } function bounce<U>(callback: (value: U) => void, value: U, count: number): void {
      if (count > 0) deliver(callback, value, count - 1); else callback(value);
    }` : "function deliver<V>(callback: (value: V) => void, value: V, count: number): void { callback(value); }";
    for (const reversed of [false, true]) {
      const calls = ["deliver(resolve, 7, 2);", "deliver(item => { void item; }, value, 2);"];
      const current = fixture(`${helper}
        function wrap<T>(value: T) { return new Promise<number>(resolve => {
          ${(reversed ? calls.slice().reverse() : calls).join("\n")}
        }); }
        void wrap(7); void wrap(Promise.resolve(7));`);
      const selected = current.query();
      assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
        selected.kind === "unresolved" ? selected.reason : "only 7 reaches the resolver in either activation order");
    }
  });
  test(`a genuinely adopting ${recursive ? "recursive" : "direct"} resolver row retains its actual outer binder`, () => {
    const helper = recursive ? `function deliver<V>(callback: (value: V) => void, value: V, count: number): void {
      if (count > 0) bounce(callback, value, count - 1); else callback(value);
    } function bounce<U>(callback: (value: U) => void, value: U, count: number): void {
      if (count > 0) deliver(callback, value, count - 1); else callback(value);
    }` : "function deliver<V>(callback: (value: V) => void, value: V, count: number): void { callback(value); }";
    const current = fixture(`${helper}
      function wrap<T>(value: T) { return new Promise<T>(resolve => deliver(resolve, value, 2)); }
      const promised = Promise.resolve(7); void wrap(7); void wrap(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "same resolver activation");
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["wrap(promised)"],
      "the matching value reaches the resolver through the exact finite helper executions");
  });
}

test("an opaque resolver result is unresolved, never an empty safe source summary", () => {
  const current = fixture(`declare function opaque<T>(value: T): T;
    function wrap<T>(value: T) { return new Promise<T>(resolve => { const done = opaque(resolve); done(value); }); }
    void wrap(Promise.resolve(7));`);
  const selected = current.query();
  assert.equal(selected.kind, "unresolved", "an open opaque result is not a closed nonresolver");
  if (selected.kind !== "unresolved") return;
  assert.equal(current.textFor(selected.at), "opaque(resolve)", "the exact unresolved operation is preserved");
});

test("an opaque resolver relation does not refuse a proven ordinary actual", () => {
  const current = fixture(`type Alias<Value> = (resolve: (value: Value) => void) => (value: Value) => void;
    function wrap<T>(value: T, alias: Alias<T>) { return new Promise<T>(resolve => {
      const done = alias(resolve); done(value);
    }); }
    void wrap<number>(7, resolve => resolve);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "the actual number is proven non-adopting without inventing an alias body");
});

test("a canonical Promise wrapper is adopting even when its payload still has an outer binder", () => {
  const current = fixture(`${identity}
    function wrap<Value>(value: Value) { return identity(Promise.resolve(value)); }
    void wrap(7);`);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "canonical Awaited wrapper");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["identity(Promise.resolve(value))"],
    "Awaited(actual) differs from the actual outer Promise regardless of the inner free parameter");
});

test("an open direct binder and a native payload container propagate without becoming Promise wrappers", () => {
  const current = fixture(`${identity}
    function forward<Value>(value: Value) { return identity(value); }
    function container<Value>(value: Value) { return identity([Promise.resolve(value)]); }
    void forward(7); void container(7);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "the native array is identical to its canonical Awaited type");
});

test("generic adoption provenance has one canonical Unicode/CRLF span and project-relative format", () => {
  const text = 'const marker = "界😀";\r\nasync function identity<Value>(value: Value) {\r\n\treturn value;\r\n}\r\n' +
    "export function reject(promised: Promise<number>): void {\r\n\tvoid identity(promised);\r\n}";
  const expectedSpan = { fileName: "index.ts", line: 6, column: 7, endLine: 6, endColumn: 25 };
  const expectedEvidence = ["declaration index.ts:2:1", "first-sensitive-operation index.ts:3:2"];
  const results = ["/checkout/rust/src", "/another/csharp/src"].map(root => {
    const current = fixture(text, root);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "complete provenance");
    if (selected.kind !== "resolved") return undefined;
    assert.equal(selected.issues.length, 1, `${root}: one actual instantiation`);
    const issue = selected.issues[0]!;
    assert.equal(current.textFor(issue.site), "identity(promised)", `${root}: unchanged original site`);
    assert.deepEqual(issue.sourceSpan, expectedSpan, `${root}: UTF-8 offsets, scalar columns and CRLF lines`);
    assert.deepEqual(issue.evidence, expectedEvidence, `${root}: one fixed shared related-location format`);
    assert.equal(Object.isFrozen(issue.sourceSpan) && Object.isFrozen(issue.evidence), true, `${root}: immutable publication`);
    return { sourceSpan: issue.sourceSpan, evidence: issue.evidence };
  });
  assert.deepEqual(results[0], results[1], "a different target checkout cannot change diagnostic provenance bytes");
});

test("mutual generic forwarding uses one finite SCC and keeps exact actual instantiation sites", () => {
  const current = fixture(`
    async function left<T>(value: T, count: number): Promise<void> { if (count > 0) await right(value, count - 1); }
    async function right<U>(value: U, count: number): Promise<void> {
      if (count > 0) await left(value, count - 1); void Promise.resolve(value);
    }
    const promised = Promise.resolve(7); void left(7, 2); void left(promised, 2);
  `);
  for (let count = 0; count < 2; count++) {
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "finite mutually recursive summary");
    if (selected.kind !== "resolved") continue;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), ["left(promised, 2)"]);
  }
  const exhausted = current.query(1);
  assert.equal(exhausted.kind === "unresolved" && exhausted.reason.includes("budget"), true,
    "budget exhaustion publishes neither an empty safe summary nor a partial refusal set");
});

test("native payload containers, ordinary library generics and primitive constraints do not become generic adoption", () => {
  const current = fixture(`
    ${identity}
    async function primitive<T extends number>(value: T): Promise<T> { return value; }
    async function container<T>(value: T[]): Promise<T[]> { return value; }
    const promised = Promise.resolve(7);
    void identity(7); void identity("exact"); void primitive(7); void container([promised]);
    void [1, 2].map(async value => value); void Promise.all([promised]);
    async function library(): Promise<void> { await Promise.all([1, 2].map(async value => value)); }
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    selected.kind === "unresolved" ? selected.reason : "native payload containers and ambient generic binders are not adoption sites");
});

test("unknown and any actuals keep their checked non-thenable boundary", () => {
  const current = fixture(`${identity}\ndeclare const unknownValue: unknown; declare const anyValue: any;
    void identity(unknownValue); void identity(anyValue);`);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "the checker, not Promise-shaped spelling, owns the actual awaitable selection");
});

test("target-owned erased lifetime parameters use their exact declarations, never a parameter-name guess", () => {
  const current = fixture(`async function marker<Region>(value: Region) { return value; }
    const promised = Promise.resolve(7); void marker(promised);`);
  const parameter = current.nodes.find(node => current.source.ast.is.IsTypeParameterDeclaration(node));
  assert.equal(parameter !== undefined, true, "actual target-marked parameter");
  const selection = current.query(defaultSourceStorageLimits.maximumSteps, node => node === parameter);
  assert.equal(selection.kind === "resolved" && selection.issues.length === 0, true, "one explicit target-owned erased marker");
  const ordinary = current.query();
  assert.equal(ordinary.kind === "resolved" && ordinary.issues.length === 1, true, "the same name alone is never an exemption");
});

test("a project member named Promise.resolve is not a native Promise resolving owner", () => {
  const current = fixture(`export {};
    const local = { resolve<Value>(value: Value): Value { return value; } };
    function wrap<T>(value: T): void { void local.resolve(value); }
    const promised = Promise.resolve(7); void wrap(promised);
  `);
  const selected = current.query();
  assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
    "only the actual checked configured-library/provider declaration owns Promise resolution");
});

for (const [name, body] of [
  ["unused-named", "async function unused() { return value; } return 1;"],
  ["discarded-arrow", "async () => value; return 1;"],
  ["type-only", "async function unused() { return value; } type OnlyType = typeof unused; return 1;"],
  ["erased-forwarding", "function unused() { return identity(value); } return 1;"],
]) {
  test(`generic adoption excludes only the canonical ${name} subtree`, () => {
    const current = fixture(`${identity}\nfunction consume<T>(value: T) { ${body} }
      const promised = Promise.resolve(1); void consume(promised);`);
    const selected = current.query();
    assert.equal(selected.kind === "resolved" && selected.issues.length === 0, true,
      selected.kind === "unresolved" ? selected.reason : "an erased body has no runtime adoption operation");
  });
}

for (const [name, declaration, invoked] of [
  ["called-nested", "function consume<T>(value: T) { async function inner() { return value; } return inner(); }", "consume"],
  ["hoisted-call", "function consume<T>(value: T) { return inner(); async function inner() { return value; } }", "consume"],
  ["returned-arrow", "function consume<T>(value: T) { return async () => value; }", "consume"],
  ["stored-arrow", "function consume<T>(value: T) { const queue: (() => Promise<T>)[] = []; const later = async () => value; queue.push(later); }", "consume"],
  ["invoked-arrow", "function consume<T>(value: T) { return (async () => value)(); }", "consume"],
  ["overloaded", "function identity2<V>(value: V): Promise<V>; async function identity2<V>(value: V): Promise<V> { return value; }", "identity2"],
] as const) {
  test(`generic adoption retains the complete ${name} source domain`, () => {
    const current = fixture(`${declaration}\nconst promised = Promise.resolve(1); void ${invoked}(promised);`);
    const selected = current.query();
    assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : name);
    if (selected.kind !== "resolved") return;
    assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)), [`${invoked}(promised)`],
      "a runtime-reachable nested body or overload is never erased from adoption evidence");
  });
}

test("interface and abstract generic signatures stay fail-closed without a source implementation", () => {
  const current = fixture(`
    interface Contract { identity<Value>(value: Value): Promise<Value>; }
    abstract class Base { abstract identity<Value>(value: Value): Promise<Value>; }
    function reject(contract: Contract, base: Base, promised: Promise<number>): void {
      void contract.identity(promised); void base.identity(promised);
    }
  `);
  const selected = current.query();
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "two unknown source contracts");
  if (selected.kind !== "resolved") return;
  assert.deepEqual(selected.issues.map(issue => current.textFor(issue.site)).sort(),
    ["base.identity(promised)", "contract.identity(promised)"], "both actual generic signature instantiations require adoption");
});
