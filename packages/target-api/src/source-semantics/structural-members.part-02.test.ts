import assert from "node:assert/strict";

import test from "node:test";

import { createSourceStructuralMemberQueries } from "./structural-members.js";

import { inspect, memberDeclaration } from "./structural-members.split-fixtures.js";

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
