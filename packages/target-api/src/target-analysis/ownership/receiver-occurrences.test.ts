import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { analyzeSourceReceiverOccurrences } from "./receiver-occurrences.js";
import type { SourceReceiverResourceLimits } from "./receiver-resources.js";

function fixture(text: string, files: Readonly<Record<string, string>> = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const sourceFiles = source.sourceFiles;
  const nodes = source.navigation.nodesForFiles(sourceFiles);
  const selected = analyzeSourceReceiverOccurrences(source, sourceFiles);
  assert.equal(selected.kind, "resolved", selected.kind !== "resolved" ? selected.reason : "resolved source inventory");
  const declaration = (name: string): Node => {
    const node = nodes.find(node => source.ast.text(source.ast.name(node)) === name &&
      source.ast.body(node) !== undefined);
    assert.equal(node !== undefined, true, name);
    return node!;
  };
  return { source, sourceFiles, nodes, declaration, occurrences: selected.occurrences };
}

test("receiver bodies share lexical-arrow occurrences but never another callable's own receiver", () => {
  const { source, nodes, declaration, occurrences } = fixture(`
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
  const arrows = nodes.filter(node => source.ast.is.IsArrowFunction(node));
  const methods = nodes.filter(node => source.ast.is.IsMethodDeclaration(node) &&
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
  const { source, nodes, occurrences } = fixture(`
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
  const methods = nodes.filter(node => source.ast.is.IsMethodDeclaration(node));
  const concrete = methods.find(node => source.ast.body(node) !== undefined)!;
  const indexed = occurrences.get(concrete)!;
  assert.equal(indexed.length, 1, "only the body value-expression receiver is retained");
  assert.equal(source.ast.kindName(source.ast.parent(indexed[0]!)), "KindAsExpression");
  for (const method of methods.filter(node => source.ast.body(node) === undefined)) {
    assert.equal(occurrences.has(method), false, "a declaration without a body has no execution inventory");
  }
});

test("computed member names and heritage evaluate in the enclosing body, class initialization does not", () => {
  const { source, nodes, declaration, occurrences } = fixture(`
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
  const otherReferences = nodes.filter(node => source.ast.is.IsArrowFunction(node) ||
    source.ast.is.IsMethodDeclaration(node) && node !== run)
    .flatMap(node => [...(occurrences.get(node) ?? [])]);
  assert.equal(otherReferences.length, 4, "two own methods and two field arrows");
  assert.equal(otherReferences.some(node => outer.includes(node)), false);
});

test("constructors, accessors, nested arrows and explicit function receivers keep exact body owners", () => {
  const { source, nodes, declaration, occurrences } = fixture(`
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
  const arrows = nodes.filter(node => source.ast.is.IsArrowFunction(node));
  assert.equal(arrows.length, 2);
  for (const arrow of arrows) assert.equal(occurrences.get(arrow)?.[0] === selected[0], true);
  const own = nodes.filter(node => source.ast.body(node) !== undefined && (source.ast.is.IsConstructorDeclaration(node) ||
    source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node) ||
    source.ast.is.IsFunctionExpression(node)));
  assert.equal(own.length, 4);
  for (const callable of own) {
    assert.equal(occurrences.get(callable)?.length, 1);
    assert.equal(occurrences.get(callable)?.[0] === selected[0], false);
  }
});

test("receiver indexing rejects incomplete inventories and finite-budget exhaustion without partial data", () => {
  const { source, sourceFiles, nodes } = fixture("class Box { read() { return this; } }");
  const controls: readonly (readonly [Partial<SourceReceiverResourceLimits>, string])[] = [
    [{ maximumSteps: 1 }, "analysis-work"],
    [{ maximumNodes: 1 }, "source-node"],
    [{ maximumTransportRows: 1 }, "transport-row"],
  ];
  for (const [limits, subject] of controls) {
    const selected = analyzeSourceReceiverOccurrences(source, sourceFiles, limits);
    assert.equal(selected.kind, "resource");
    assert.equal(selected.subject, subject);
    assert.equal(selected.limit, 1);
    assert.equal(Object.isFrozen(selected), true, "resource outcomes are immutable");
    assert.equal("occurrences" in selected, false);
  }
  for (const invalidNodes of [[...nodes].reverse(), [...nodes, nodes[0]!], []]) {
    const selected = analyzeSourceReceiverOccurrences({ ...source,
      navigation: { ...source.navigation, nodesForFiles: () => invalidNodes } }, sourceFiles);
    assert.equal(selected.kind, "unresolved");
    assert.equal("occurrences" in selected, false);
  }
  const history = createSourceStorageQuery(source, sourceFiles, { maximumNodes: 1 });
  assert.equal(history.failureReason(), "Source storage transport exceeds its finite source-node budget.",
    "the separate history engine really is resource-exhausted");
  const independent = analyzeSourceReceiverOccurrences(source, sourceFiles);
  assert.equal(independent.kind, "resolved", "history-engine failure is not a receiver-admission authority");
  assert.equal(independent.occurrences.size, 1, "all checked receiver owners still publish without partial history data");
});

test("receiver inventory keeps exact selected-file scope, original identities and requested order", () => {
  const { source, sourceFiles, nodes } = fixture("export class First { read() { return this; } }", {
    "/src/second.ts": "export class Second { read() { return this; } }",
    "/src/external.d.ts": "export declare class External { read(): this; }",
  });
  const first = sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts")!;
  const second = sourceFiles.find(file => source.ast.getFileName(file) === "/src/second.ts")!;
  const declarations = nodes.filter(node => source.ast.is.IsMethodDeclaration(node) && source.ast.body(node) !== undefined);
  const whole = analyzeSourceReceiverOccurrences(source, [first, second]);
  assert.equal(whole.kind, "resolved");
  const ordered = [...whole.occurrences.keys()];
  assert.equal(ordered.length, 2, "both exact requested roots are covered");
  assert.equal(source.ast.getSourceFile(ordered[0]!) === second &&
    source.ast.getSourceFile(ordered[1]!) === first, true, "reverse requested-file order is retained");
  assert.equal(ordered.every(node => declarations.includes(node)), true, "original checked callable identities are retained");
  const subset = analyzeSourceReceiverOccurrences(source, [first]);
  assert.equal(subset.kind, "resolved");
  assert.equal(subset.occurrences.size, 1, "an explicit subset never widens to all navigation files");
  assert.equal([...subset.occurrences.keys()].every(node => source.ast.getSourceFile(node) === first), true,
    "no unrelated checked-file receiver is published");
  for (const references of subset.occurrences.values()) {
    assert.equal(references.every(node => nodes.includes(node)), true, "all receiver expressions keep checked node identity");
    assert.equal(Object.isFrozen(references), true, "each published occurrence array remains immutable");
  }
});

test("receiver declaration-only views stay explicit and foreign or duplicate selected files are invalid", () => {
  const current = fixture("export class Box { read() { return this; } }", {
    "/src/native.d.ts": "export declare class Native { read(): this; }",
  });
  const declaration = current.sourceFiles.find(file => current.source.ast.getFileName(file) === "/src/native.d.ts")!;
  assert.equal(current.source.navigation.sourceFiles.includes(declaration), false, "the declaration is outside the default view");
  const selected = analyzeSourceReceiverOccurrences(current.source, [declaration]);
  assert.equal(selected.kind, "resolved");
  assert.equal(selected.occurrences.size, 0, "checked declaration-only files publish no invented execution bodies");
  const foreign = fixture("export class Box { read() { return this; } }");
  assert.throws(() => analyzeSourceReceiverOccurrences(current.source, [foreign.sourceFiles[0]!]),
    "same-spelled foreign checked identity stays invalid");
  assert.throws(() => analyzeSourceReceiverOccurrences(current.source, [current.sourceFiles[0]!, current.sourceFiles[0]!]),
    "duplicate selected roots stay invalid rather than silently deduplicated");
});

test("receiver inventory rejects a missing requested root and cyclic parent evidence without partial publication", () => {
  const { source, sourceFiles, nodes } = fixture("export class First { read() { return this; } }", {
    "/src/second.ts": "export class Second { read() { return this; } }",
  });
  const first = sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts")!;
  const missing = analyzeSourceReceiverOccurrences({ ...source, navigation: { ...source.navigation,
    nodesForFiles: () => nodes.filter(node => source.ast.getSourceFile(node) === first) } }, sourceFiles);
  assert.equal(missing.kind === "unresolved" &&
    missing.reason === "Receiver occurrences require every selected checked source file.", true,
    "every explicitly requested checked root is mandatory");
  assert.equal("occurrences" in missing, false, "missing roots publish no successful prefix");
  const root = nodes.find(node => source.ast.is.IsSourceFile(node))!;
  const cyclic = analyzeSourceReceiverOccurrences({ ...source,
    ast: { ...source.ast, parent: node => node === root ? root : source.ast.parent(node) } }, sourceFiles);
  assert.equal(cyclic.kind === "unresolved" &&
    cyclic.reason === "Receiver occurrences require unique checked nodes after their exact source parents.", true,
    "a root cannot authorize its own cyclic parent");
  assert.equal("occurrences" in cyclic, false, "cyclic evidence publishes no successful prefix");
});

test("receiver parameter evidence remains mandatory before any occurrence publication", () => {
  const { source, sourceFiles } = fixture("class Box { read(value = 1) { return this; } }");
  const selected = analyzeSourceReceiverOccurrences({ ...source, semantics: { ...source.semantics,
    forNode: node => {
      const semantics = source.semantics.forNode(node);
      return { ...semantics, declarations: { ...semantics.declarations, declarationSignature: () => undefined } };
    } } }, sourceFiles);
  assert.equal(selected.kind === "unresolved" &&
    selected.reason === "Receiver scopes require their exact checked value parameters.", true,
    "absent checked parameter evidence is still invalid, never guessed from syntax");
  assert.equal("occurrences" in selected, false, "an invalid parameter owner publishes no partial receiver map");
});

test("receiver resource selections never raise the original finite limits or become language refusals", () => {
  const { source, sourceFiles } = fixture("class Box { read() { return this; } }");
  for (const limits of [
    { maximumNodes: 0 }, { maximumNodes: 1_048_577 }, { maximumTransportRows: 4_194_305 },
    { maximumSteps: 33_554_433 }, { maximumSteps: Number.NaN }, { maximumNodes: -1 },
  ]) {
    const selected = analyzeSourceReceiverOccurrences(source, sourceFiles, limits);
    assert.equal(selected.kind === "unresolved" &&
      selected.reason === "Receiver resource limits must be positive safe integers no greater than the bounded defaults.", true,
      "invalid finite resource selections stay invalid rather than increasing compiler admission");
    assert.equal("occurrences" in selected, false, "invalid resource selections expose no partial data");
  }
});
