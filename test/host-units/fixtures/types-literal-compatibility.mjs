import assert from "node:assert/strict";

export async function literalCompatibilityCases(suite, types) {
  const facts = { nativeIntegerWidths: [{ carrier: "native-int", bits: 9 }, { carrier: "native-uint", bits: 41 }] };
  const number = (numerator, denominator = 1n, negativeZero = false) => ({ kind: "number", value: { numerator, denominator, negativeZero } });
  const string = value => ({ kind: "string", value });
  const table = terms => ({ terms, signatures: [] });
  const check = (terms, value, type = 0, selected = facts) => types.literalCompatibilityOf(table(terms), type, value, selected,
    { typeOf: id => terms[id], admit: () => true });
  const boolean = { kind: "boolean", value: true };
  const absent = { kind: "absence" };

  await suite.test("literal compatibility retains exact payload/base identity and arbitrary optional nesting", () => {
    for (const [value, base] of [[string("x"), { kind: "string" }], [boolean, { kind: "primitive", primitive: "bool" }],
      [{ kind: "bigint", value: 2n ** 100n }, { kind: "intrinsic", intrinsic: "bigint" }],
      [{ kind: "unique-symbol", declaration: "owner.a" }, { kind: "intrinsic", intrinsic: "symbol" }],
      [absent, { kind: "intrinsic", intrinsic: "absence" }], [number(0n, 1n, true), { kind: "intrinsic", intrinsic: "unknown" }]]) {
      assert.equal(check([{ kind: "literal", value, base: 1 }, base], value).kind, "compatible");
      const mismatch = value.kind === "number" ? number(0n) : value.kind === "unique-symbol"
        ? { ...value, declaration: "owner.b" } : value.kind === "absence" ? boolean : { ...value, value: value.kind === "string" ? "y" : value.kind === "bigint" ? 3n : false };
      assert.equal(check([{ kind: "literal", value, base: 1 }, base], mismatch).kind, "incompatible");
    }
    const terms = Array.from({ length: 20000 }, (_value, position) => ({ kind: "optional", value: position + 1 }));
    terms.push({ kind: "primitive", primitive: "int32" });
    assert.equal(check(terms, number(7n)).kind, "compatible");
    assert.equal(check(terms, string("x")).kind, "incompatible");
    assert.equal(check(terms, absent).kind, "compatible");
    assert.equal(check([{ kind: "literal", value: number(1n), base: 1 }, { kind: "literal", value: number(2n), base: 2 },
      { kind: "primitive", primitive: "int32" }], number(1n)).kind, "incompatible");
  });

  await suite.test("structural sums and intersections preserve broad intrinsics and reject scalar aggregates", () => {
    for (const intrinsic of ["any", "unknown"]) assert.equal(check([{ kind: "intrinsic", intrinsic }], string("x")).kind, "compatible");
    for (const intrinsic of ["never", "object", "void", "absence", "bigint", "symbol"])
      assert.equal(check([{ kind: "intrinsic", intrinsic }], string("x")).kind, "incompatible");
    for (const intrinsic of ["void", "absence"]) assert.equal(check([{ kind: "intrinsic", intrinsic }], absent).kind, "compatible");
    for (const term of [{ kind: "array", element: 1, readonly: false }, { kind: "tuple", elements: [], readonly: false },
      { kind: "fixed-array", element: 1, extent: { length: 2n, runtimeBase: 0n } },
      { kind: "shape", members: [], indexes: [], calls: [], constructs: [] }, { kind: "callable", calls: [], constructs: [] }, { kind: "error" }])
      assert.equal(check([term], string("x")).kind, "incompatible");
    const terminals = [{ kind: "string" }, { kind: "intrinsic", intrinsic: "bigint" }, { kind: "primitive", primitive: "char" }];
    for (const kind of ["union", "intersection"]) {
      assert.equal(check([{ kind, members: [1, 2] }, ...terminals], string("x")).kind, kind === "union" ? "compatible" : "incompatible");
      assert.equal(check([{ kind, members: [1, 2] }, ...terminals], boolean).kind, "incompatible");
      assert.equal(check([{ kind, members: [] }], boolean).kind, kind === "union" ? "incompatible" : "compatible");
      assert.equal(check([{ kind, members: [1, 1] }, { kind: "string" }], string("x")).kind, "compatible");
      assert.equal(check([{ kind, members: [1, 2] }, { kind: "primitive", primitive: "char" }, { kind: "string" }], boolean).kind,
        kind === "union" ? "needs-selected-evidence" : "incompatible");
      assert.equal(check([{ kind, members: [1, 2] }, { kind: "primitive", primitive: "char" }, { kind: "string" }], string("x")).kind,
        kind === "union" ? "compatible" : "needs-selected-evidence");
    }
  });

  await suite.test("integer compatibility consumes actual selected geometry and never guesses other representations", () => {
    for (const [primitive, minimum, maximum] of [["int8", -128n, 127n], ["uint128", 0n, (1n << 128n) - 1n],
      ["native-int", -256n, 255n], ["native-uint", 0n, (1n << 41n) - 1n]]) {
      for (const value of [minimum, maximum]) assert.equal(check([{ kind: "primitive", primitive }], number(value)).kind, "compatible");
      for (const value of [minimum - 1n, maximum + 1n]) assert.equal(check([{ kind: "primitive", primitive }], { kind: "bigint", value }).kind, "incompatible");
      for (const value of [number(0n, 1n, true), number(1n, 2n), string("x")])
        assert.equal(check([{ kind: "primitive", primitive }], value).kind, "incompatible");
    }
    assert.equal(check([{ kind: "primitive", primitive: "bool" }], number(1n)).kind, "incompatible");
    assert.deepEqual(check([{ kind: "primitive", primitive: "native-int" }], number(0n), 0, { nativeIntegerWidths: [] }),
      { kind: "needs-selected-evidence", type: 0, primitive: "native-int", requirement: "representation" });
    for (const primitive of ["char", "decimal", "float16", "float32", "float64"]) assert.deepEqual(check([{ kind: "primitive", primitive }], number(0n)),
      { kind: "needs-selected-evidence", type: 0, primitive, requirement: primitive === "char" || primitive === "decimal" ? "representation" : "literal-conversion" });
    for (const kind of ["declared", "construction-reference", "enum", "param", "self", "projection", "open"])
      assert.deepEqual(check([{ kind }], number(0n)), { kind: "needs-selected-evidence", type: 0, primitive: null, requirement: "checked-association" });
  });

  await suite.test("structural readers keep malformed references, recursive dependency and original resource stop distinct", () => {
    assert.deepEqual(check([], boolean), { kind: "malformed-type", type: 0 });
    assert.deepEqual(check([undefined], boolean), { kind: "malformed-type", type: 0 });
    for (const type of [-1, -0, NaN, 0.5]) assert.equal(check([{ kind: "string" }], string("x"), type).kind, "malformed-type");
    assert.equal(check([{ kind: "union", members: [undefined] }], boolean).kind, "malformed-type");
    assert.equal(check([{ kind: "union", members: [1, undefined] }, { kind: "string" }], boolean).kind, "malformed-type");
    assert.equal(check([{ kind: "union", members: [0] }], boolean).kind, "needs-selected-evidence");
    assert.throws(() => check([{ kind: "optional", value: 0 }], boolean), /acyclic/);
    assert.throws(() => check([{ kind: "literal", value: boolean, base: 0 }], boolean), /acyclic/);
    let reads = 0;
    const terms = [{ kind: "primitive", primitive: "int32" }];
    assert.equal(types.literalCompatibilityOf(table(terms), 0, boolean, facts, { admit: () => true,
      typeOf: () => { reads += 1; return null; } }).kind, "resource-stop");
    assert.equal(reads, 1);
    const samples = [[{ kind: "literal", value: string("x"), base: 1 }, { kind: "string" }],
      [{ kind: "union", members: [1, 2] }, { kind: "primitive", primitive: "char" }, { kind: "primitive", primitive: "native-int" }],
      [{ kind: "optional", value: 1 }, { kind: "string" }]];
    for (const terms of samples) {
      let needed = 0;
      const full = types.literalCompatibilityOf(table(terms), 0, string("x"), facts, {
        admit: (work, entries) => { needed += work + entries; return true; },
        typeOf: id => { needed += 1; return terms[id]; } });
      assert.notEqual(full.kind, "resource-stop");
      for (let allowance = 0; allowance <= needed; allowance += 1) {
        let remaining = allowance; let stopped = false;
        const admit = (work, entries) => {
          assert.equal(stopped, false, "no work after the first original refusal");
          if (work + entries > remaining) { stopped = true; return false; }
          remaining -= work + entries; return true;
        };
        const result = types.literalCompatibilityOf(table(terms), 0, string("x"), facts, { admit,
          typeOf: id => admit(1, 0) ? terms[id] : null });
        assert.equal(result.kind, allowance === needed ? full.kind : "resource-stop");
      }
    }
  });
}
