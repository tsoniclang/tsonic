import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { analyzeSourceReceiverOccurrences } from "./receiver-occurrences.js";

function fixture(text: string, files: Readonly<Record<string, string>> = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const storage = createSourceStorageQuery(source, source.sourceFiles);
  const selected = analyzeSourceReceiverOccurrences(storage);
  assert.equal(selected.kind, "resolved", selected.kind === "unresolved" ? selected.reason : "resolved source inventory");
  const declaration = (name: string): Node => {
    const node = storage.nodes.find(node => source.ast.text(source.ast.name(node)) === name &&
      source.ast.body(node) !== undefined);
    assert.equal(node !== undefined, true, name);
    return node!;
  };
  return { source, storage, declaration, occurrences: selected.occurrences };
}

test("receiver bodies share lexical-arrow occurrences but never another callable's own receiver", () => {
  const { source, storage, declaration, occurrences } = fixture(`
    export class Box {
      value = 1;
      field = () => this.value;
      run() {
        this.value;
        const arrow = () => this.value;
        function nested(this: Box) { return this.value; }
        const object = { value: 2, read() { return this.value; } };
        class Inner { value = 3; read() { return this.value; } }
        if (false) { this.value; }
        return [arrow, nested, object, Inner];
      }
    }
  `);
  const run = declaration("run");
  const nested = declaration("nested");
  const arrows = storage.nodes.filter(node => source.ast.is.IsArrowFunction(node));
  const methods = storage.nodes.filter(node => source.ast.is.IsMethodDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "read");
  assert.equal(occurrences.get(run)?.length, 3, "own read, lexical arrow and syntactically present dead branch");
  assert.equal(occurrences.get(nested)?.length, 1, "ordinary function owns its receiver");
  assert.deepEqual(arrows.map(node => occurrences.get(node)?.length), [1, 1]);
  assert.deepEqual(methods.map(node => occurrences.get(node)?.length), [1, 1]);
  const outer = new Set(occurrences.get(run));
  assert.equal(occurrences.get(arrows[1]!)?.every(node => outer.has(node)), true, "identical checked references");
  for (const method of [nested, ...methods]) {
    assert.equal(occurrences.get(method)?.some(node => outer.has(node)), false, "no cross-receiver leakage");
    assert.equal(Object.isFrozen(occurrences.get(method)), true);
  }
});

test("receiver bodies exclude type syntax, ambient declarations and parameter initializers", () => {
  const { source, storage, occurrences } = fixture(`
    declare class External { value: number; read(): this; }
    export class Box {
      value = 1;
      read(argument = this.value): number {
        type Owner = typeof this;
        const value = this as Owner;
        return value.value + argument;
      }
    }
  `, { "/src/external.d.ts": "declare class Ambient { read(): this; }" });
  const methods = storage.nodes.filter(node => source.ast.is.IsMethodDeclaration(node));
  const concrete = methods.find(node => source.ast.body(node) !== undefined)!;
  const indexed = occurrences.get(concrete)!;
  assert.equal(indexed.length, 1, "only the body value-expression receiver is retained");
  assert.equal(source.ast.kindName(source.ast.parent(indexed[0]!)), "KindAsExpression");
  for (const method of methods.filter(node => source.ast.body(node) === undefined)) {
    assert.equal(occurrences.has(method), false, "a declaration without a body has no execution inventory");
  }
});

test("computed member names and heritage evaluate in the enclosing body, class initialization does not", () => {
  const { source, storage, declaration, occurrences } = fixture(`
    export class Box {
      key = "read";
      Base = class { value = 0; };
      run() {
        const object = { [this.key]() { return this; } };
        class Inner extends this.Base {
          read() { return this; }
          field = () => this.value;
          static value = 2;
          static { this.value; }
          static field = () => this.value;
        }
        return [object, Inner];
      }
    }
  `);
  const run = declaration("run");
  const outer = occurrences.get(run)!;
  assert.equal(outer.length, 2, "the computed object name and the heritage expression");
  const otherReferences = storage.nodes.filter(node => source.ast.is.IsArrowFunction(node) ||
    source.ast.is.IsMethodDeclaration(node) && node !== run)
    .flatMap(node => [...(occurrences.get(node) ?? [])]);
  assert.equal(otherReferences.length, 4, "two own methods and two field arrows");
  assert.equal(otherReferences.some(node => outer.includes(node)), false);
});

test("constructors, accessors, nested arrows and explicit function receivers keep exact body owners", () => {
  const { source, storage, declaration, occurrences } = fixture(`
    export class Box {
      value: number;
      constructor(value = 1) { this.value = value; }
      get read(): number { return this.value; }
      set read(value: number) { this.value = value; }
      create() {
        const nested = () => () => this.value;
        const independent = function (this: Box) { return this.value; };
        return [nested, independent];
      }
    }
  `);
  const selected = occurrences.get(declaration("create"))!;
  assert.equal(selected.length, 1);
  const arrows = storage.nodes.filter(node => source.ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const arrow of arrows) assert.equal(occurrences.get(arrow)?.[0] === selected[0], true);
  const own = storage.nodes.filter(node => source.ast.body(node) !== undefined && (source.ast.is.IsConstructorDeclaration(node) ||
    source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node) ||
    source.ast.is.IsFunctionExpression(node)));
  assert.equal(own.length, 4);
  for (const callable of own) {
    assert.equal(occurrences.get(callable)?.length, 1);
    assert.equal(occurrences.get(callable)?.[0] === selected[0], false);
  }
});

test("receiver indexing rejects incomplete inventories and finite-budget exhaustion without partial data", () => {
  const { storage } = fixture("class Box { read() { return this; } }");
  for (const limits of [{ maximumSteps: 1 }, { maximumNodes: 1 }, { maximumTransportRows: 1 }]) {
    const selected = analyzeSourceReceiverOccurrences(storage, limits);
    assert.equal(selected.kind, "unresolved");
    assert.equal("occurrences" in selected, false);
  }
  for (const nodes of [[...storage.nodes].reverse(), [...storage.nodes, storage.nodes[0]!], []]) {
    const selected = analyzeSourceReceiverOccurrences({ ...storage, nodes });
    assert.equal(selected.kind, "unresolved");
    assert.equal("occurrences" in selected, false);
  }
  const failed = analyzeSourceReceiverOccurrences({ ...storage, failureReason: () => "exact source failure" });
  assert.equal(failed.kind === "unresolved" && failed.reason === "exact source failure", true);
});
