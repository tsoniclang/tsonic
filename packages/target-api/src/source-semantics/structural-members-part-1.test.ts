import assert from "node:assert/strict";

import test from "node:test";

import { inspect, check, memberDeclaration } from "./structural-members-fixtures.js";

test("selected member descriptors retain their exact checked receiver contracts", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    declare const actual: { readonly value: number };
    declare const destination: { readonly value: number; optional?: object };
    observe(actual); observe(destination);
  `);
  const [actual, destination] = current.argumentTypes;
  assert.ok(actual && destination);
  const selected = current.semantics.types.structuralMember(actual, destination,
    memberDeclaration(current, destination, "value"), "correspondence");
  assert.equal(selected?.kind === "present" && selected.source.receiverType === actual &&
    selected.destination.receiverType === destination, true,
  "source and external destination keep distinct exact checked type identities");
  const absent = current.semantics.types.structuralMember(actual, destination,
    memberDeclaration(current, destination, "optional"), "correspondence");
  assert.equal(absent?.kind === "absent" && absent.destination.receiverType === destination &&
    absent.destination.property.optional, true, "optional absence retains its actual declared allocation contract");
});

test("checked primitive member correspondence retains native carriers and exact declaration identities", () => {
  for (const [name, carrier, literal, predicate] of [
    ["String", "string", '"native"', "isStringLike"],
    ["Number", "number", "7", "isNumberLike"],
    ["Boolean", "boolean", "true", "isBooleanLike"],
    ["BigInt", "bigint", "9007199254740993n", "isBigIntLike"],
    ["Symbol", "symbol", "token", "isSymbolLike"],
  ] as const) {
    const { results, semantics, argumentTypes } = inspect(`
      export {};
      declare global { interface ${name} { inspectNative(): object; } }
      declare const token: unique symbol;
      declare function observe<Value>(value: Value): void;
      const actual = ${literal};
      declare const destination: ${carrier};
      observe(actual); observe(destination);
    `);
    const actual = argumentTypes[0]!;
    const destination = argumentTypes[1]!;
    const relation = semantics.types.structuralMembers(actual, destination, "read");
    assert.equal(results.every(result => result.kind === "available") && relation.kind === "available", true, name);
    if (relation.kind !== "available") continue;
    assert.equal(relation.source.type === actual && relation.destination.type === destination, true,
      `${name}: member evidence never substitutes a boxed carrier`);
    assert.equal(semantics.types[predicate](relation.source.type) && semantics.types[predicate](relation.destination.type), true, name);
    const selected = relation.members.find(member => member.destination.property.name === "inspectNative");
    assert.equal(selected?.kind === "present" && selected.source.declarations.length === 1 &&
      selected.source.declarations[0] === selected.destination.declarations[0], true,
      `${name}: exact checker declaration identity, not a name-only or invented match`);
    assert.equal(semantics.types.structuralMembers(actual, destination, "read") === relation && Object.isFrozen(relation.members), true,
      `${name}: one immutable checked correspondence`);
  }
});

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
  const changed = semantics.types.structuralMembers(optional.source.type, required.destination.type, "read");
  assert.deepEqual(changed, { kind: "unavailable", reason: "missing-required-member" });
  assert.equal(semantics.types.structuralMembers(required.source.type, required.destination.type, "read"), required);
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

test("disjoint required literal members prove impossible record alternatives without depending on member order", () => {
  for (const [name, left, right] of [
    ["string", '"done"', '"read"'],
    ["number", "3", "4"],
    ["bigint", "9007199254740993n", "9007199254740994n"],
    ["boolean", "true", "false"],
  ]) {
    const { results, semantics } = inspect(`
      declare function observe<T>(value: T): void;
      declare const actual: { readonly kind: ${left}; readonly value: number };
      declare const selected: { readonly next: () => void; readonly kind: ${right} };
      observe(actual); observe(selected);
    `);
    const actual = results[0];
    const selected = results[1];
    assert.equal(actual?.kind === "available" && selected?.kind === "available", true, name);
    if (actual?.kind !== "available" || selected?.kind !== "available") continue;
    assert.deepEqual(semantics.types.structuralMembers(actual.source.type, selected.source.type, "read"),
      { kind: "unavailable", reason: "disjoint-shape" }, name);
    assert.deepEqual(semantics.types.structuralMembers(selected.source.type, actual.source.type, "read"),
      { kind: "unavailable", reason: "disjoint-shape" }, `${name} reverse`);
  }
});

test("optional, widened and equal discriminants never hide missing required member evidence", () => {
  for (const [name, property] of [
    ["optional", 'readonly kind?: "done"'],
    ["widened", "readonly kind: string"],
    ["equal", 'readonly kind: "read"'],
  ]) {
    const { results, semantics } = inspect(`
      declare function observe<T>(value: T): void;
      declare const actual: { ${property}; readonly value: number };
      declare const selected: { readonly next: () => void; readonly kind: "read" };
      observe(actual); observe(selected);
    `);
    const actual = results[0];
    const selected = results[1];
    assert.equal(actual?.kind === "available" && selected?.kind === "available", true, name);
    if (actual?.kind !== "available" || selected?.kind !== "available") continue;
    assert.deepEqual(semantics.types.structuralMembers(actual.source.type, selected.source.type, "read"),
      { kind: "unavailable", reason: "missing-required-member" }, name);
  }
});
