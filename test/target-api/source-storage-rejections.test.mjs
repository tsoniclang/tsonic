import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { jsSourceCallableParameterEffects } from "../../packages/js-source-profile/dist/index.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], undefined, {
    callbackEntries(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      const owner = declaration === undefined ? undefined : source.ast.parent(declaration);
      const ownerName = owner === undefined ? undefined : source.ast.text(source.ast.name(owner));
      if (ownerName !== "PromiseConstructor" && ownerName !== "Promise" && ownerName !== "PromiseLike") return undefined;
      const memberName = source.ast.is.IsConstructSignatureDeclaration(declaration) ? "constructor"
        : source.ast.text(source.ast.name(declaration));
      return jsSourceCallableParameterEffects({ ownerName, memberName });
    },
  });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const selected = storage.subjectFor(initializer(name));
    assert.equal(selected.kind === "resolved", true, `${name}: checked result subject`);
    return storage.closedOriginsFor(selected.subject);
  };
  const expectOriginal = (name, original) => {
    const selected = query(name);
    assert.equal(selected.kind === "complete", true, `${name}: ${selected.reason ?? selected.kind}`);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === initializer(original), true,
      `${name}: original rejection object identity`);
    assert.equal(storage.failureReason() === undefined, true, "finite source graph remains valid");
  };
  return { source, storage, query, expectOriginal };
}

for (const nested of [false, true]) for (const stored of [false, true]) {
  test(`await retains the exact rejection object (${nested ? "captured reject" : "direct reject"}, ${stored ? "stored" : "direct"})`, () => {
    const pending = `new Promise<void>((resolve, reject) => {
      ${nested ? "function fail(): void { reject(original); } fail();" : "reject(original);"}
    })`;
    const current = fixture(`
      const original = {};
      async function run(): Promise<void> {
        ${stored ? `const pending = ${pending};` : ""}
        try { await ${stored ? "pending" : pending}; }
        catch (caught) { const result = caught; }
      }
      void run();
    `);
    current.expectOriginal("result", "original");
  });
}

test("native async throws enter the await catch without a Promise-constructor effect", () => {
  const current = fixture(`
    const original = {};
    async function fail(): Promise<void> { function raise(): never { throw original; } raise(); }
    async function run(): Promise<void> {
      try { await fail(); } catch (caught) { const result = caught; }
    }
    void run();
  `);
  current.expectOriginal("result", "original");
});

for (const reaction of ["catch(caught => { const result = caught; })", "then(undefined, caught => { const result = caught; })"]) {
  test(`a rejection reaction gets its receiver's original rejection (${reaction.split("(")[0]})`, () => {
    const current = fixture(`
      const original = {};
      const pending = new Promise<void>((resolve, reject) => { reject(original); });
      pending.${reaction};
    `);
    current.expectOriginal("result", "original");
  });
}

test("distinct Promise constructions retain distinct rejection channels", () => {
  const current = fixture(`
    const original = {}; const separate = {};
    const first = new Promise<void>((resolve, reject) => { reject(original); });
    const second = new Promise<void>((resolve, reject) => { reject(separate); });
    async function run(): Promise<void> {
      try { await first; } catch (caught) { const result = caught; }
      try { await second; } catch (caught) { const untouched = caught; }
    }
    void run();
  `);
  current.expectOriginal("result", "original");
  current.expectOriginal("untouched", "separate");
});

test("an escaping rejection parameter cannot certify a closed rejection origin", () => {
  const current = fixture(`
    declare function retain(reject: (reason: unknown) => void): void;
    async function run(): Promise<void> {
      try { await new Promise<void>((resolve, reject) => { retain(reject); }); }
      catch (caught) { const result = caught; }
    }
    void run();
  `);
  const selected = current.query("result");
  assert.equal(selected.kind === "unresolved", true, "unproved rejection escape never fabricates a closed object");
  assert.match(selected.reason, /rejection parameter.*escapes/u);
});

test("an unawaited async call does not throw its rejection into a synchronous catch", () => {
  const current = fixture(`
    const original = {};
    async function fail(): Promise<void> { throw original; }
    try { void fail(); } catch (caught) { const result = caught; }
  `);
  const selected = current.query("result");
  assert.equal(selected.kind !== "complete", true, "a Promise rejection is not a synchronous thrown input");
});
