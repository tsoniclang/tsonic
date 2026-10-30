import assert from "node:assert/strict";

import test from "node:test";

import { inspect, memberDeclaration } from "./structural-members.split-fixtures.js";

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
