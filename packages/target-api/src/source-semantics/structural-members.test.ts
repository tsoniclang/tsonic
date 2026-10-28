import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node, type Type } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";
import { createSourceStructuralMemberQueries } from "./structural-members.js";

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
  const argumentTypes: Type[] = [];
  for (const node of walk(file)) {
    if (!source.ast.is.IsCallExpression(node)) continue;
    const call = semantics.operations.call(node);
    if (call?.sourceArguments.length !== 1) continue;
    const actual = call.sourceArguments[0]?.type;
    const selected = call.sourceSelectedSignatureParameters[0]?.selectedType;
    assert.ok(actual && selected);
    argumentTypes.push(actual);
    const result = semantics.types.structuralMembers(actual, selected, "read");
    assert.equal(semantics.types.structuralMembers(actual, selected, "read"), result);
    assert.ok(Object.isFrozen(result));
    results.push(result);
  }
  return { results, source, semantics, argumentTypes, checked, file };
  function* walk(node: Node): Generator<Node> {
    yield node;
    for (const child of source.ast.children(node)) if (child !== undefined) yield* walk(child);
  }
}

function check(text: string, files?: Record<string, string>) {
  return inspect(text, files).results;
}

function memberDeclaration(current: ReturnType<typeof inspect>, type: Type, name: string): Node {
  const property = current.semantics.types.propertyInfos(type).find(property => property.name === name);
  assert.ok(property, name);
  const declarations = current.semantics.declarations.symbolDeclarations(property.symbol);
  assert.equal(declarations.length, 1, `${name}: one checked member declaration`);
  return declarations[0]!;
}

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

test("native absence is disjoint only from a proven present record, not an unresolved or nullable shape", () => {
  for (const absent of ["null", "undefined"]) {
    for (const present of ["{ readonly token: {} }", "{ readonly token?: {} }"]) {
      const { semantics, argumentTypes } = inspect(`
        declare function observe<T>(value: T): void;
        declare const absent: ${absent}; declare const present: ${present};
        observe(absent); observe(present);
      `);
      const from = argumentTypes[0]!;
      const to = argumentTypes[1]!;
      for (const [source, destination] of [[from, to], [to, from]]) {
        assert.deepEqual(semantics.types.structuralMembers(source!, destination!, "read"),
          { kind: "unavailable", reason: "disjoint-shape" }, `${absent} / ${present}`);
      }
    }
    for (const unresolved of ["null", "undefined", "any", "unknown", "void", "never", "{ token: {} } | null", "{ token: {} } | undefined"]) {
      const { semantics, argumentTypes } = inspect(`
        declare function observe<T>(value: T): void;
        declare const absent: ${absent}; declare const unresolved: ${unresolved};
        observe(absent); observe(unresolved);
      `);
      assert.deepEqual(semantics.types.structuralMembers(argumentTypes[0]!, argumentTypes[1]!, "read"),
        { kind: "unavailable", reason: "unresolved-shape" }, `${absent} / ${unresolved}`);
    }
  }
});

test("selected physical members do not certify unrelated required fields or convert their absence to a value", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    declare const actual: { readonly fromBase: number };
    declare const physical: { readonly fromBase: number; readonly fromBody: number; readonly argument: number };
    observe(actual); observe(physical);
  `);
  const [actual, physical] = current.argumentTypes;
  assert.ok(actual && physical);
  const fromBase = memberDeclaration(current, physical, "fromBase");
  const fromBody = memberDeclaration(current, physical, "fromBody");
  const whole = current.semantics.types.structuralMembers(actual, physical, "read");
  assert.equal(whole.kind === "unavailable" && whole.reason === "missing-required-member", true,
    "the Holder-facing type cannot prove the whole physical Base shape");
  const selected = current.semantics.types.structuralMember(actual, physical, fromBase, "read");
  assert.equal(selected?.kind === "present" && selected.source.property.readonly &&
    current.semantics.types.isNumberLike(selected.source.property.type), true,
    "the independently selected physical member retains its exact native type and permissions");
  assert.equal(selected?.kind === "present" && selected.source.declarations[0] === memberDeclaration(current, actual, "fromBase"), true,
    "the correspondence retains actual checked declarations");
  const absent = current.semantics.types.structuralMember(actual, physical, fromBody, "read");
  assert.equal(absent?.kind === "absent" && !absent.destination.property.optional, true,
    "absence of a checked member is metadata, never an available required source value");
  assert.equal(current.semantics.types.structuralMembers(actual, physical, "read") === whole &&
    current.semantics.types.structuralMember(actual, physical, fromBase, "read") === selected, true,
    "full and partial reads reuse one immutable type-pair index");
  const foreign = inspect(`
    declare function observe<T>(value: T): void;
    declare const value: { readonly fromBase: number }; observe(value);
  `);
  const foreignType = foreign.argumentTypes[0];
  assert.ok(foreignType);
  assert.equal(current.semantics.types.structuralMember(actual, physical,
    memberDeclaration(foreign, foreignType, "fromBase"), "read") === undefined, true,
    "a same-named foreign declaration is not the selected checked member");
});

test("selected union members retain instantiated payloads without asserting complete union shape", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    interface Box<T> { readonly value: T; }
    declare const actual: Box<{ left: number }> | Box<{ right: string }>;
    declare const selected: Box<{ left: number } | { right: string }>;
    observe(actual); observe(selected);
  `);
  const [actual, selected] = current.argumentTypes;
  assert.ok(actual && selected);
  const declaration = memberDeclaration(current, selected, "value");
  const member = current.semantics.types.structuralMember(actual, selected, declaration, "read");
  assert.equal(member?.kind === "present" && member.source.property.readonly && member.destination.property.readonly, true,
    "every constituent has the selected checked Box member");
  assert.equal(member?.kind === "present" && current.semantics.types.isUnion(member.source.property.type) &&
    current.semantics.types.unionOrIntersectionTypes(member.source.property.type).length === 2, true,
    "generic alternatives retain both exact payload types");
  const whole = current.semantics.types.structuralMembers(actual, selected, "read");
  assert.equal(whole.kind === "unavailable" && whole.reason === "unresolved-shape", true,
    "a selected common member does not prove the whole union");
});

test("selected-member queries distinguish optional absence, partial union membership and unreadable accessors", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    declare const empty: {};
    declare const optional: { value?: number };
    declare const required: { value: number };
    declare const partial: { value: number } | { other: number };
    const setter = { set value(next: number) {} };
    observe(empty); observe(optional); observe(required); observe(partial); observe(setter);
  `);
  const [empty, optional, required, partial, setter] = current.argumentTypes;
  assert.ok(empty && optional && required && partial && setter);
  const optionalDeclaration = memberDeclaration(current, optional, "value");
  const requiredDeclaration = memberDeclaration(current, required, "value");
  const absent = current.semantics.types.structuralMember(empty, optional, optionalDeclaration, "read");
  assert.equal(absent?.kind === "absent" && absent.destination.property.optional, true,
    "only a genuinely missing optional member supplies optional-absence evidence");
  assert.equal(current.semantics.types.structuralMember(partial, required, requiredDeclaration, "read") === undefined, true,
    "a missing common union member is not proof that every constituent lacks it");
  assert.equal(current.semantics.types.structuralMember(setter, required, requiredDeclaration, "read") === undefined, true,
    "setter-only metadata is never readable physical storage");
});

test("setter correspondence retains one exact pair across alternating read and metadata questions", () => {
  for (const readFirst of [false, true]) {
    const current = inspect(`
      declare function observe<T>(value: T): void;
      class Base<T> { set value(next: T) {} }
      class Derived extends Base<number> {}
      declare const actual: Derived;
      declare const destination: { value: number };
      observe(actual); observe(destination);
    `);
    const [actual, destination] = current.argumentTypes;
    assert.ok(actual && destination);
    const declaration = memberDeclaration(current, destination, "value");
    const { types } = current.semantics;
    if (readFirst) {
      assert.equal(types.structuralMember(actual, destination, declaration, "read") === undefined, true,
        "a first read refusal does not remove the checked setter");
    }
    const correspondence = types.structuralMembers(actual, destination, "correspondence");
    const pair = types.structuralMember(actual, destination, declaration, "correspondence");
    assert.equal(correspondence.kind === "available" && correspondence.members.length === 1 &&
      correspondence.members[0] === pair, true, "whole and selected geometry share the exact pair");
    assert.equal(pair?.kind === "present" && pair.source.read === "unavailable" && pair.source.getters.length === 0 &&
      pair.source.setters.length === 1 && pair.source.declarations[0] === pair.source.setters[0] &&
      types.isNumberLike(pair.source.property.type), true, "inherited generic setter metadata is never a readable value");
    const read = types.structuralMembers(actual, destination, "read");
    assert.deepEqual(read, { kind: "unavailable", reason: "unreadable-member" });
    for (let index = 0; index < 4; index += 1) {
      assert.equal(types.structuralMember(actual, destination, declaration, "read") === undefined, true,
        "every actual setter-only read remains refused");
      assert.equal(types.structuralMembers(actual, destination, "read") === read &&
        types.structuralMembers(actual, destination, "correspondence") === correspondence &&
        types.structuralMember(actual, destination, declaration, "correspondence") === pair, true,
      "neither purpose creates a second pair or poisons the other question");
    }
    assert.equal(Object.isFrozen(correspondence) && Object.isFrozen(pair), true,
      "both views retain immutable checked evidence");
    for (const purpose of [undefined, null, "write"]) {
      assert.throws(() => Reflect.apply(types.structuralMembers, types, [actual, destination, purpose]),
        { name: "TypeError", message: "Source structural member queries require an explicit correspondence or read purpose." });
      assert.throws(() => Reflect.apply(types.structuralMember, types, [actual, destination, declaration, purpose]),
        { name: "TypeError", message: "Source structural member queries require an explicit correspondence or read purpose." });
    }
  }
});

test("selected members preserve inherited generic accessor evidence and exact literal incompatibility", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    class Base<T> {
      constructor(private stored: T) {}
      get value(): T { return this.stored; }
      set value(next: T) { this.stored = next; }
    }
    class Derived extends Base<number> {}
    declare const actual: Derived;
    declare const selected: { value: number; extra: string };
    observe(actual); observe(selected);
  `);
  const [actual, selected] = current.argumentTypes;
  assert.ok(actual && selected);
  const member = current.semantics.types.structuralMember(actual, selected, memberDeclaration(current, selected, "value"), "read");
  assert.equal(member?.kind === "present" && member.source.read === "accessor" &&
    member.source.getters.length === 1 && member.source.setters.length === 1 &&
    current.semantics.types.isNumberLike(member.source.property.type), true,
    "the exact instantiated inherited accessor is selected independently of unrelated fields");
  for (const [left, right] of [['"left"', '"right"'], ["3", "4"],
    ["9007199254740993n", "9007199254740994n"], ["true", "false"]]) {
    const literal = inspect(`
      declare function observe<T>(value: T): void;
      declare const actual: { value: number; kind: ${left} }; declare const selected: { value: number; kind: ${right} };
      observe(actual); observe(selected);
    `);
    const [from, to] = literal.argumentTypes;
    assert.ok(from && to);
    assert.equal(literal.semantics.types.structuralMember(from, to, memberDeclaration(literal, to, "kind"), "read") === undefined,
      true, `${left}/${right}: incompatible exact native literals never acquire a selected correspondence`);
    assert.equal(literal.semantics.types.structuralMember(from, to, memberDeclaration(literal, to, "value"), "read") === undefined,
      true, `${left}/${right}: an impossible whole alternative never contributes an otherwise common member`);
  }
});

test("selected-member admission refuses unresolved roots and malformed or ambiguous checked metadata", () => {
  const current = inspect(`
    declare function observe<T>(value: T): void;
    declare const actual: { value: number; other: number };
    declare const selected: { value: number; other: number };
    observe(actual); observe(selected);
  `);
  const [actual, selected] = current.argumentTypes;
  assert.ok(actual && selected);
  const declaration = memberDeclaration(current, selected, "value");
  const queries = current.checked.getSourceFileQueries(current.file);
  const properties = queries.typeShape.getPropertyInfos(actual);
  const duplicated = createSourceStructuralMemberQueries(queries.ast, queries.checker, { ...queries.typeShape,
    getPropertyInfos: type => type === actual ? [...properties, ...properties] : queries.typeShape.getPropertyInfos(type) });
  assert.equal(duplicated.structuralMember(actual, selected, declaration, "read") === undefined, true,
    "duplicate source symbols cannot publish partial evidence");
  const sourceSymbols = new Set(properties.flatMap(property => [property.symbol, ...property.rootSymbols]));
  const missing = createSourceStructuralMemberQueries(queries.ast, { ...queries.checker,
    getSymbolDeclarations: symbol => symbol !== undefined && sourceSymbols.has(symbol)
      ? [] : queries.checker.getSymbolDeclarations(symbol),
  }, queries.typeShape);
  assert.equal(missing.structuralMember(actual, selected, declaration, "read") === undefined, true,
    "a physical member requires its actual checked source declarations, not an invented empty value");
  const destinationSymbols = new Set(queries.typeShape.getPropertyInfos(selected).map(property => property.symbol));
  const ambiguous = createSourceStructuralMemberQueries(queries.ast, { ...queries.checker,
    getSymbolDeclarations: symbol => symbol !== undefined && destinationSymbols.has(symbol)
      ? [declaration] : queries.checker.getSymbolDeclarations(symbol),
  }, queries.typeShape);
  assert.equal(ambiguous.structuralMember(actual, selected, declaration, "read") === undefined, true,
    "one declaration selecting two properties is ambiguous, not a name-based choice");
  const foreign = createSourceStructuralMemberQueries(queries.ast, { ...queries.checker,
    getPropertyOfType: type => type === actual ? queries.typeShape.getPropertyInfos(selected)[0]?.symbol : undefined,
  }, queries.typeShape);
  assert.equal(foreign.structuralMember(actual, selected, declaration, "read") === undefined, true,
    "a checked lookup must select an actual property symbol of the source type");
  for (const root of ["any", "unknown", "never", "void", "null", "undefined", "{ value: number } | null"]) {
    const unresolved = inspect(`
      declare function observe<T>(value: T): void;
      declare const actual: ${root}; declare const selected: { value: number };
      observe(actual); observe(selected);
    `);
    const [from, to] = unresolved.argumentTypes;
    assert.ok(from && to);
    assert.equal(unresolved.semantics.types.structuralMember(from, to, memberDeclaration(unresolved, to, "value"), "read") === undefined,
      true, `${root}: missing root evidence never proves a selected member or its absence`);
  }
});
