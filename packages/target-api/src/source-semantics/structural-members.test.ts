import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

function inspect(text: string, files: Record<string, string> = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { ...files, "/src/index.ts": text },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.extensionDiagnostics, []);
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const results = [];
  for (const node of walk(file)) {
    if (!source.ast.is.IsCallExpression(node)) continue;
    const call = semantics.operations.call(node);
    if (call?.sourceArguments.length !== 1) continue;
    const actual = call.sourceArguments[0]?.type;
    const selected = call.sourceSelectedSignatureParameters[0]?.selectedType;
    assert.ok(actual && selected);
    const result = semantics.types.structuralMembers(actual, selected);
    assert.equal(semantics.types.structuralMembers(actual, selected), result);
    assert.ok(Object.isFrozen(result));
    results.push(result);
  }
  return { results, source, semantics };
  function* walk(node: Node): Generator<Node> {
    yield node;
    for (const child of source.ast.children(node)) if (child !== undefined) yield* walk(child);
  }
}

function check(text: string, files?: Record<string, string>) {
  return inspect(text, files).results;
}

test("structural variable arguments retain distinct selected identities, optional absence and aliases", () => {
  const results = check(`
    declare function accept(value: { flags?: string; highWaterMark: number; mode?: number }): void;
    const options = { extra: true, highWaterMark: 3 };
    const alias = options;
    accept(alias);
    const present = { mode: undefined, highWaterMark: 4 };
    accept(present);
  `);
  assert.equal(results.length, 2);
  const first = results[0];
  assert.equal(first?.kind, "available");
  if (first?.kind !== "available") return;
  assert.deepEqual(first.members.map(member => [member.destination.property.name, member.kind]),
    [["flags", "absent"], ["highWaterMark", "present"], ["mode", "absent"]]);
  const pair = first.members[1];
  assert.ok(pair?.kind === "present");
  assert.notEqual(pair.source.property.symbol, pair.destination.property.symbol);
  assert.equal(pair.source.property.name, "highWaterMark");
  assert.ok(Object.isFrozen(pair.source.property));
  const second = results[1];
  assert.ok(second?.kind === "available");
  assert.equal(second.members[2]?.kind, "present");
});

test("structural correspondence uses instantiated mapped, generic, inherited and accessor members", () => {
  const results = check(`
    type Fields<T> = { [K in keyof T]: T[K] };
    declare function accept(value: Fields<{ value: number }>): void;
    class Base<T> { readonly value: T; constructor(value: T) { this.value = value; } }
    class Derived extends Base<number> {}
    declare const inherited: Derived;
    accept(inherited);
    const accessor = { get value(): number { return 3; } };
    accept(accessor);
  `);
  assert.equal(results.length, 2);
  for (const result of results) {
    assert.ok(result.kind === "available");
    assert.equal(result.members.length, 1);
    const pair = result.members[0];
    assert.ok(pair?.kind === "present");
    assert.ok(pair.source.declarations.length > 0);
    assert.ok(pair.destination.property.rootSymbols.length > 0);
  }
  const accessor = results[1];
  assert.ok(accessor?.kind === "available");
  const pair = accessor.members[0];
  assert.ok(pair?.kind === "present");
  assert.equal(pair.source.read, "accessor");
  assert.equal(pair.source.getters.length, 1);
});

test("structural correspondence keeps index and callable obligations separate and refuses unresolved unions", () => {
  const results = check(`
    declare function indexed(value: { [key: string]: number }): void;
    indexed({ value: 3 });
    declare function callable(value: { (): number; value?: number }): void;
    declare const fn: { (): number; value: number };
    callable(fn);
    declare function union(value: { value: number } | { other: number }): void;
    union({ value: 3 });
  `);
  assert.ok(results[0]?.kind === "available");
  assert.equal(results[0].destination.indexes.length, 1);
  assert.ok(results[1]?.kind === "available");
  assert.equal(results[1].destination.calls.length, 1);
  assert.deepEqual(results[2], { kind: "unavailable", reason: "unresolved-shape" });
});

test("cross-file structural members retain selected generic types and inherited accessors", () => {
  const { results, source, semantics } = inspect(`
    import type { Options } from "./contract.js";
    import { configuration } from "./configuration.js";
    declare function accept(value: Options<number>): void;
    accept(configuration);
  `, {
    "/src/contract.ts": "export type Options<T> = { [K in 'value' | 'fallback']?: T };",
    "/src/configuration.ts": `
      class Base<T> {
        stored: T;
        constructor(stored: T) { this.stored = stored; }
        get value(): T { return this.stored; }
        set value(next: T) { this.stored = next; }
      }
      class Config extends Base<number> {}
      export const configuration = new Config(3);
    `,
  });
  const result = results[0];
  assert.ok(result?.kind === "available");
  const pair = result.members.find(member => member.destination.property.name === "value");
  assert.ok(pair?.kind === "present");
  assert.equal(semantics.types.isNumberLike(pair.source.property.type), true);
  const destinationType = semantics.types.withoutMissingOrUndefined(pair.destination.property.type);
  assert.ok(destinationType);
  assert.equal(semantics.types.isNumberLike(destinationType), true);
  assert.equal(pair.source.getters.length, 1);
  assert.equal(pair.source.setters.length, 1);
  assert.equal(source.ast.getSourceFile(pair.source.getters[0])?.fileName, "/src/configuration.ts");
  assert.equal(pair.source.property.optional, false);
  assert.equal(pair.destination.property.optional, true);
  assert.equal(result.members.find(member => member.destination.property.name === "fallback")?.kind, "absent");
});

test("optional members, method members and computed keys retain exact source dispositions", () => {
  const { results } = inspect(`
    declare function accept(value: { count?: number; run(): number; 'dash-key': string }): void;
    declare const options: { run(): number; 'dash-key': string; count?: number };
    accept(options);
  `);
  const result = results[0];
  assert.ok(result?.kind === "available");
  assert.ok(result.members.every(member => member.kind === "present"));
  const optional = result.members[0];
  assert.ok(optional?.kind === "present");
  assert.equal(optional.source.property.optional, true);
  assert.equal(result.members[1]?.kind === "present" && result.members[1].source.read, "method");
  const key = result.members[2];
  assert.ok(key?.kind === "present");
  assert.notEqual(key.source.property.symbol, key.destination.property.symbol);
  assert.equal(key.source.property.name, "dash-key");
  assert.throws(() => { Array.prototype.push.call(result.members, key); }, TypeError);
  assert.throws(() => { Object.defineProperty(key.source.property, "optional", { value: true }); }, TypeError);
});

test("missing required members, setter-only reads and changed type pairs do not inherit a cached map", () => {
  const { results, semantics } = inspect(`
    declare function accept(value: { value: number }): void;
    declare function optional(value: { value?: number }): void;
    accept({ value: 3 });
    optional({});
    accept({ set value(next: number) {} });
  `);
  const required = results[0];
  const optional = results[1];
  assert.ok(required?.kind === "available" && optional?.kind === "available");
  const changed = semantics.types.structuralMembers(optional.source.type, required.destination.type);
  assert.deepEqual(changed, { kind: "unavailable", reason: "missing-required-member" });
  assert.equal(semantics.types.structuralMembers(required.source.type, required.destination.type), required);
  assert.deepEqual(results[2], { kind: "unavailable", reason: "unreadable-member" });
});

test("symbol and numeric keys use exact compiler member lookup", () => {
  const results = check(`
    declare const key: unique symbol;
    type RequiredMembers = { readonly [key]: number } & { 0: string };
    declare function accept(value: RequiredMembers): void;
    const value = { 0: "first", [key]: 3 };
    accept(value);
  `);
  const result = results[0];
  assert.ok(result?.kind === "available");
  assert.equal(result.members.length, 2);
  for (const member of result.members) {
    assert.ok(member.kind === "present");
    assert.notEqual(member.source.property.symbol, member.destination.property.symbol);
    assert.ok(member.source.declarations.length > 0);
  }
});
