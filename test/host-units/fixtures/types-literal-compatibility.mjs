import assert from "node:assert/strict";

export async function literalCompatibilityCases(suite, types) {
  const facts = { nativeIntegerWidths: [{ carrier: "native-int", bits: 9 }, { carrier: "native-uint", bits: 41 }], floatingFormats: [] };
  const number = (numerator, denominator = 1n, negativeZero = false) => ({ kind: "number", value: { numerator, denominator, negativeZero } });
  const string = value => ({ kind: "string", value });
  const table = terms => ({ terms, signatures: [] });
  const check = (terms, value, type = 0, selected = facts) => types.literalCompatibilityOf(table(terms), type, value, selected,
    { numericRepresentation: "literal-operand", typeOf: id => terms[id], admit: () => true });
  const boolean = { kind: "boolean", value: true };
  const absent = { kind: "absence" };

  await suite.test("literal-base lookup admission is paid at every actual hop and stops before the next read", () => {
    for (const length of [0, 1, 7]) {
      const terms = Array.from({ length }, (_, index) => ({ kind: "literal", value: boolean, base: index + 1 }));
      terms.push({ kind: "primitive", primitive: "bool" });
      const required = 6 + 4 * length;
      for (let maximum = 0; maximum <= required; maximum += 1) {
        let remaining = maximum;
        let stopped = false;
        const reads = [];
        const charge = units => {
          assert.equal(stopped, false, "neither admission nor a later lookup follows the original stop");
          if (units > remaining) { stopped = true; return false; }
          remaining -= units;
          return true;
        };
        const result = types.literalCompatibilityOf(table(terms), 0, boolean, facts, {
          numericRepresentation: "literal-operand",
          admit: (work, entries) => charge(work) && charge(entries),
          typeOf: id => {
            if (!charge(1)) return null;
            reads.push(id);
            return terms[id];
          },
        });
        assert.equal(result.kind, maximum === required ? "compatible" : "resource-stop");
        assert.deepEqual(reads, Array.from({ length: Math.min(length + 1, Math.max(0, Math.floor((maximum - 6) / 4) + 1)) }, (_, index) => index));
        if (maximum === required) assert.equal(remaining, 0);
      }
    }
  });

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
    assert.equal(types.literalCompatibilityOf(table(terms), 0, boolean, facts, { numericRepresentation: "literal-operand", admit: () => true,
      typeOf: () => { reads += 1; return null; } }).kind, "resource-stop");
    assert.equal(reads, 1);
    const samples = [[{ kind: "literal", value: string("x"), base: 1 }, { kind: "string" }],
      [{ kind: "union", members: [1, 2] }, { kind: "primitive", primitive: "char" }, { kind: "primitive", primitive: "native-int" }],
      [{ kind: "optional", value: 1 }, { kind: "string" }]];
    for (const terms of samples) {
      let needed = 0;
      const full = types.literalCompatibilityOf(table(terms), 0, string("x"), facts, {
        numericRepresentation: "literal-operand",
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
        const result = types.literalCompatibilityOf(table(terms), 0, string("x"), facts, { numericRepresentation: "literal-operand", admit,
          typeOf: id => admit(1, 0) ? terms[id] : null });
        assert.equal(result.kind, allowance === needed ? full.kind : "resource-stop");
      }
    }
  });

  await suite.test("binary64 literal fit requires the selected descriptor and exact finite dyadic value", () => {
    const format = { carrier: "float64", interchange: "ieee754-binary64", nanSignObservable: true,
      nanPayloadObservable: true, signalingNaNObservable: true };
    const terms = [{ kind: "primitive", primitive: "float64" }];
    const selected = { ...facts, floatingFormats: [format] };
    const values = [[number(0n, 1n, true), true], [number(5n, 4n), true], [number(-5n, 4n), true],
      [number(9007199254740994n), true],
      [number(1n, 1n << 1074n), true], [number((1n << 1024n) - (1n << 971n)), true],
      [number(9007199254740993n), false], [number(1n, 10n), false], [number(1n, 1n << 1075n), false],
      [number(1n << 1024n), false], [number(1n, -1n), false], [number(2n, 4n), false],
      [number(0n, 2n), false], [number(1n, 1n, true), false]];
    for (const [value, exact] of values) {
      assert.equal(types.exactFloat64LiteralFit(value.value, format), exact);
      assert.equal(check(terms, value, 0, selected).kind, exact ? "compatible" : "needs-selected-evidence");
    }
    const other = { ...format, carrier: "float32", interchange: "ieee754-binary32" };
    assert.equal(types.exactFloat64LiteralFit(number(0n).value, other), false);
    assert.equal(types.exactFloat64LiteralFit(number(0n).value, { ...format, interchange: other.interchange }), false);
    assert.equal(check(terms, number(0n), 0, facts).kind, "needs-selected-evidence");
    const unread = { get floatingFormats() { assert.fail("Retaining an existing payload must not select materialization."); } };
    assert.deepEqual(types.literalCompatibilityOf(table(terms), 0, number(5n, 4n), unread, {
      numericRepresentation: "preserve-payload", typeOf: id => terms[id], admit: () => true,
    }), { kind: "needs-selected-evidence", type: 0, primitive: "float64", requirement: "literal-conversion" });
    assert.equal(types.literalCompatibilityOf(table(terms), 0, number(5n, 4n), unread, {
      typeOf: id => terms[id], admit: () => true,
    }).kind, "needs-selected-evidence", "the old unqualified reader cannot authorize binary64 fit");
    const selectedFormats = [other, format];
    for (let allowance = 0; allowance <= 8; allowance += 1) {
      let remaining = allowance;
      const reads = [];
      const admit = (work, entries) => { remaining -= work + entries; return remaining >= 0; };
      const formats = new Proxy(selectedFormats, { get(rows, key) {
        if (key === "0" || key === "1") reads.push(Number(key));
        return Reflect.get(rows, key);
      } });
      const result = types.literalCompatibilityOf(table(terms), 0, number(0n), { ...facts, floatingFormats: formats }, {
        numericRepresentation: "literal-operand", admit, typeOf: id => admit(1, 0) ? terms[id] : null,
      });
      assert.equal(result.kind, allowance === 8 ? "compatible" : "resource-stop");
      assert.deepEqual(reads, [0, 1].slice(0, Math.max(0, allowance - 6)));
    }
  });
}
