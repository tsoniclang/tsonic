import assert from "node:assert/strict";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";

const issue = (rule, field, index) => ({ rule, site: { field, index }, detail: [{ kind: "text", value: field }] });

export async function nativeFactsCases(suite, product) {
  await suite.test("binary floating membership is exact and does not include another numeric representation", () => {
    for (const carrier of ["float16", "float32", "float64"])
      assert.equal(product.isNativeBinaryFloatPrimitive(carrier), true, carrier);
    for (const carrier of ["bool", "char", "decimal", "bigint", "native-int", "native-uint",
      "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128"])
      assert.equal(product.isNativeBinaryFloatPrimitive(carrier), false, carrier);
  });

  await suite.test("selected integer geometry owns exact fixed and supplied native widths without a target-geometry guess", () => {
    const facts = nativeFactsFixture();
    facts.nativeIntegerWidths = [{ carrier: "native-int", bits: 41 }, { carrier: "native-uint", bits: 97 }];
    const cases = [
      ["int8", 8, true, -128n, 127n], ["uint8", 8, false, 0n, 255n],
      ["int16", 16, true, -32768n, 32767n], ["uint16", 16, false, 0n, 65535n],
      ["int32", 32, true, -2147483648n, 2147483647n], ["uint32", 32, false, 0n, 4294967295n],
      ["int64", 64, true, -9223372036854775808n, 9223372036854775807n],
      ["uint64", 64, false, 0n, 18446744073709551615n],
      ["int128", 128, true, -170141183460469231731687303715884105728n, 170141183460469231731687303715884105727n],
      ["uint128", 128, false, 0n, 340282366920938463463374607431768211455n],
      ["native-int", 41, true, -(1n << 40n), (1n << 40n) - 1n],
      ["native-uint", 97, false, 0n, (1n << 97n) - 1n],
    ];
    for (const [primitive, bits, signed, minimum, maximum] of cases) {
      const admissions = [];
      const actual = product.nativeIntegerGeometryOf(primitive, facts, (work, storage) => { admissions.push([work, storage]); return true; });
      assert.deepEqual(actual, { kind: "integer", bits, signed, minimum, maximum });
      const reads = primitive === "native-int" ? 1 : primitive === "native-uint" ? 2 : 0;
      assert.deepEqual(admissions, [[1, 0], ...Array.from({ length: reads }, () => [1, 0]),
        [bits, bits], [bits, bits], [bits, bits], [1, 0]],
      "one dispatch, actual native row reads, three width-dependent arithmetic/storage admissions, one result");
    }
    for (const primitive of ["bool", "char", "float16", "float32", "float64", "decimal"])
      assert.deepEqual(product.nativeIntegerGeometryOf(primitive, null, () => true), { kind: "not-integer" });
    for (const primitive of ["native-int", "native-uint"]) {
      assert.deepEqual(product.nativeIntegerGeometryOf(primitive, { ...facts, nativeIntegerWidths: [] }, () => true),
        { kind: "missing-native-width", carrier: primitive });
      for (const bits of [1, 9, 137]) {
        const actual = product.nativeIntegerGeometryOf(primitive, { ...facts, nativeIntegerWidths: [{ carrier: primitive, bits }] }, () => true);
        assert.equal(actual.bits, bits);
        assert.equal(actual.minimum, primitive === "native-int" ? -(1n << BigInt(bits - 1)) : 0n);
        assert.equal(actual.maximum, (1n << BigInt(bits - (primitive === "native-int" ? 1 : 0))) - 1n);
      }
      for (const bits of [-0, -1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
        assert.throws(() => product.nativeIntegerGeometryOf(primitive, { ...facts, nativeIntegerWidths: [{ carrier: primitive, bits }] }, () => true), TypeError);
    }
    assert.throws(() => product.nativeIntegerGeometryOf("int256", facts, () => true), TypeError);
    assert.throws(() => product.nativeIntegerGeometryOf("native-int", { ...facts, nativeIntegerWidths: new Array(1) }, () => true), TypeError);
  });

  await suite.test("integer geometry admits width-dependent work before arithmetic and retains the caller's first stop", () => {
    const facts = nativeFactsFixture();
    facts.nativeIntegerWidths = [{ carrier: "native-int", bits: 9 }, { carrier: "native-uint", bits: 17 }];
    const environment = (maximumWork, maximumBits) => {
      const original = { kind: "refused", maximumWork, maximumBits };
      const state = { work: 0, stop: null, requests: [] };
      const admit = (work, bits) => {
        if (state.stop !== null) return false;
        state.requests.push([work, bits]);
        if (work > maximumWork - state.work || bits > maximumBits) { state.stop = original; return false; }
        state.work += work;
        return true;
      };
      return { original, state, admit };
    };
    for (const [primitive, bits, reads] of [["int8", 8, 0], ["uint16", 16, 0], ["native-int", 9, 1], ["native-uint", 17, 2]]) {
      const need = 2 + reads + bits * 3;
      const exact = environment(need, bits);
      assert.equal(product.nativeIntegerGeometryOf(primitive, facts, exact.admit).kind, "integer");
      assert.equal(exact.state.work, need);
      for (let maximum = 0; maximum < need; maximum += 1) {
        const current = environment(maximum, bits);
        assert.deepEqual(product.nativeIntegerGeometryOf(primitive, facts, current.admit), { kind: "resource-stop" });
        assert.equal(current.state.stop, current.original);
        const before = structuredClone(current.state);
        assert.deepEqual(product.nativeIntegerGeometryOf(null, null, current.admit), { kind: "resource-stop" });
        assert.deepEqual(current.state, before, "a stopped invocation reads no later selected row or arithmetic input");
      }
      for (let maximum = 0; maximum < bits; maximum += 1) {
        const current = environment(need, maximum);
        assert.deepEqual(product.nativeIntegerGeometryOf(primitive, facts, current.admit), { kind: "resource-stop" });
        assert.equal(current.state.stop, current.original);
        assert.equal(current.state.requests.at(-1)[1], bits, "the first width-dependent allocation was refused before the shift");
      }
    }
    const huge = { ...facts, nativeIntegerWidths: [{ carrier: "native-int", bits: Number.MAX_SAFE_INTEGER }] };
    const bounded = environment(1000, 128);
    assert.deepEqual(product.nativeIntegerGeometryOf("native-int", huge, bounded.admit), { kind: "resource-stop" },
      "no attempted enormous BigInt shift before its genuine work/storage admission");
    const shared = environment(27, 8);
    assert.equal(product.nativeIntegerGeometryOf("int8", facts, shared.admit).kind, "integer");
    assert.equal(product.nativeIntegerGeometryOf("int8", facts, shared.admit).kind, "resource-stop");
    assert.equal(shared.state.stop, shared.original, "subsequent selections share the same remaining account rather than a fresh allowance");
  });

  await suite.test("native carrier reads the actual primitive or literal-base relation through one charged ready reader", () => {
    const literal = base => ({ kind: "literal", value: { kind: "number", value: { numerator: 1n, denominator: 1n, negativeZero: false } }, base });
    const table = { terms: [{ kind: "primitive", primitive: "float32" }, literal(0), literal(1), { kind: "string" }, literal(3)], signatures: [] };
    const run = (type, maximum) => {
      const reads = [];
      let charged = 0;
      let attempts = 0;
      const result = product.nativeCarrierOf(table, type, selected => {
        attempts += 1;
        if (charged === maximum) return null;
        charged += 1;
        reads.push(selected);
        return table.terms[selected];
      });
      return { result, reads, charged, attempts };
    };
    assert.deepEqual(run(2, 3), { result: { kind: "primitive", type: 0, primitive: "float32" }, reads: [2, 1, 0], charged: 3, attempts: 3 });
    assert.deepEqual(run(2, 2), { result: { kind: "resource-stop" }, reads: [2, 1], charged: 2, attempts: 3 });
    assert.deepEqual(run(2, 0), { result: { kind: "resource-stop" }, reads: [], charged: 0, attempts: 1 });
    assert.deepEqual(run(4, 2), { result: { kind: "needs-selected-association", type: 3 }, reads: [4, 3], charged: 2, attempts: 2 });
    assert.deepEqual(run(3, 1), { result: { kind: "needs-selected-association", type: 3 }, reads: [3], charged: 1, attempts: 1 });
    let sharedReads = 0;
    let stopped = false;
    const sharedReader = type => {
      if (stopped) return null;
      if (sharedReads === 1) { stopped = true; return null; }
      sharedReads += 1;
      return table.terms[type];
    };
    assert.deepEqual(product.nativeCarrierOf(table, 2, sharedReader), { kind: "resource-stop" });
    assert.deepEqual(product.nativeCarrierOf(table, 0, sharedReader), { kind: "resource-stop" });
    assert.equal(sharedReads, 1, "reusing the caller's refused account performs no later table lookup");
    for (const primitive of ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
      "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"]) {
      const selected = { terms: [{ kind: "primitive", primitive }], signatures: [] };
      assert.deepEqual(product.nativeCarrierOf(selected, 0, type => selected.terms[type]), { kind: "primitive", type: 0, primitive });
    }
    const many = { terms: [{ kind: "primitive", primitive: "int128" }], signatures: [] };
    for (let index = 1; index < 100_000; index += 1) many.terms.push(literal(index - 1));
    let reads = 0;
    assert.deepEqual(product.nativeCarrierOf(many, many.terms.length - 1, type => { reads += 1; return many.terms[type]; }),
      { kind: "primitive", type: 0, primitive: "int128" });
    assert.equal(reads, many.terms.length, "one charged read per actual row without native stack growth");
    for (const selected of [{ terms: [literal(0)], signatures: [] }, { terms: [literal(1), literal(0)], signatures: [] }]) {
      let count = 0;
      assert.throws(() => product.nativeCarrierOf(selected, 0, type => { count += 1; return selected.terms[type]; }),
        error => error instanceof TypeError && error.message === "A native carrier literal-base relation must be acyclic");
      assert.equal(count, selected.terms.length, "the actual finite domain bounds successful reads");
      assert.deepEqual(product.nativeCarrierOf(selected, 0, () => null), { kind: "resource-stop" }, "earned refusal precedes an unread cycle");
    }
    for (const type of [-1, -0, 0.5, NaN, Infinity, 5]) assert.throws(() => product.nativeCarrierOf(table, type, () => {
      throw new Error("Invalid ready-domain input must not read a row");
    }), error => error instanceof TypeError && error.message === "A native carrier requires its actual ready type domain");
    assert.throws(() => product.nativeCarrierOf({ terms: [literal(7)], signatures: [] }, 0, () => literal(7)),
      error => error instanceof TypeError && error.message === "A native carrier requires its actual ready type domain");
    assert.throws(() => product.nativeCarrierOf(table, 0, () => undefined),
      error => error instanceof TypeError && error.message === "A native carrier requires a complete ready type row");
  });
  await suite.test("supplied contract facts retain independent laws and actual geometry without width inference", () => {
    const facts = nativeFactsFixture();
    facts.geometry.layouts.push({ declaration: { providerId: "provider", providerVersion: "1", providerModuleId: "native",
      moduleSpecifier: "layout", exportId: "abi" }, layout: { fingerprint: "abi-32", byteOrder: "big", addressWidth: 32 } });
    assert.deepEqual(product.verifyNativeFacts(facts), []);
    assert.equal(facts.nativeIntegerWidths[0].bits, 128);
    assert.equal(facts.geometry.layouts[0].layout.addressWidth, 32);
    assert.equal(product.nativeFactsKey(facts), product.nativeFactsKey(structuredClone(facts)));
    const before = structuredClone(facts);
    for (const field of ["divisionByZero", "remainderByZero", "signedQuotientOverflow"]) {
      const changed = structuredClone(facts);
      changed[field].at(-1).law = changed[field].at(-1).law === "unwind" ? "abort" : "unwind";
      assert.notEqual(product.nativeFactsKey(changed), product.nativeFactsKey(facts), field);
    }
    assert.deepEqual(facts, before, "keying and validation never mutate supplied evidence");
    const declaration = facts.geometry.layouts[0].declaration;
    for (const field of Object.keys(declaration)) assert.notEqual(product.platformDeclarationKey({ ...declaration, [field]: "other" }), product.platformDeclarationKey(declaration), field);
  });

  await suite.test("canonical facts identity observes every scalar, table and exact native-width value", () => {
    const original = nativeFactsFixture();
    const originalKey = product.nativeFactsKey(original);
    const alternatives = { arrayIndexFailure: "abort", tupleIndexFailure: "unwind", fixedArrayIndexFailure: "abort",
      stringIndexFailure: "unwind", absentAccessFailure: "abort", typeTestFailure: "unwind", allocationFailure: "abort",
      handleActivation: "at-creation", destinationCheck: "after-value", byPlaceArgumentCheck: "before-later-arguments",
      cleanupFailure: "preserve-pending", derivedFieldInitialization: "before-base", constructionIdentity: "unavailable" };
    for (const [field, value] of Object.entries(alternatives)) {
      const changed = { ...original, [field]: value };
      assert.deepEqual(product.verifyNativeFacts(changed), []);
      assert.notEqual(product.nativeFactsKey(changed), originalKey, field);
    }
    const changes = {
      carrierHolding: row => { row.holding = row.holding === "by-reference" ? "in-place" : "by-reference"; },
      arrayExtents: row => { row.result = "int32"; },
      nativeIntegerWidths: row => { row.bits = 64; },
      floatingFormats: row => { row.nanPayloadObservable = false; },
      integerOverflow: row => { row.result = "int128"; },
      divisionRounding: row => { row.rounding = "floor"; },
      remainderSign: row => { row.sign = "divisor"; },
      invalidShiftCount: row => { row.law.mask = 127n; },
      conversions: row => { row.positiveInfinity.value += 1n; },
    };
    for (const [field, change] of Object.entries(changes)) {
      const changed = structuredClone(original);
      change(changed[field][0]);
      assert.deepEqual(product.verifyNativeFacts(changed), []);
      assert.notEqual(product.nativeFactsKey(changed), originalKey, field);
    }
  });

  await suite.test("array construction is selected independently of storage, extent and allocation", () => {
    const original = nativeFactsFixture();
    const grant = { kind: "exact-length", extentFailure: "unwind", rangeCopy: "contiguous" };
    const selected = { ...original, arrayConstruction: grant };
    assert.deepEqual(product.verifyNativeFacts(selected), []);
    assert.notEqual(product.nativeFactsKey(selected), product.nativeFactsKey(original));
    for (const opposite of [
      { ...selected, arrayConstruction: { ...grant, extentFailure: "abort" } },
      { ...selected, allocationFailure: "abort" },
      { ...selected, carrierHolding: nativeFactsFixture({ arrayHolding: "in-place" }).carrierHolding },
      { ...selected, arrayExtents: nativeFactsFixture({ arrayExtent: "int32" }).arrayExtents },
    ]) {
      assert.deepEqual(product.verifyNativeFacts(opposite), []);
      assert.notEqual(product.nativeFactsKey(opposite), product.nativeFactsKey(selected));
    }
    const { arrayConstruction, ...missing } = selected;
    void arrayConstruction;
    for (const malformed of [missing, ...[
      { ...grant, kind: "growth" },
      { ...grant, extentFailure: "wrap" },
      { ...grant, rangeCopy: "element-conversion" },
    ].map(arrayConstruction => ({ ...selected, arrayConstruction }))])
      assert.deepEqual(product.verifyNativeFacts(malformed), [issue("native-fact-value", "arrayConstruction", null)]);
  });

  await suite.test("native extent laws are ordered and independent of holding and index failure", () => {
    const facts = nativeFactsFixture({ arrayHolding: "in-place", arrayExtent: "int32", fixedArrayExtent: "uint64" });
    const rows = facts.arrayExtents;
    assert.deepEqual(product.verifyNativeFacts(facts), []);
    assert.equal(product.nativeArrayExtentOf(rows, "array"), "int32");
    assert.equal(product.nativeArrayExtentOf(rows, "fixed-array"), "uint64");
    assert.equal(product.nativeArrayExtentOf([rows[0]], "fixed-array"), null);
    assert.equal(product.nativeArrayExtentOf(null, "array"), null);
    assert.equal(product.nativeArrayExtentOf([rows[0], rows[1], rows[0]], "array"), null);
    assert.equal(product.nativeArrayExtentOf([rows[0], rows[0]], "array"), null);
    assert.equal(product.nativeArrayExtentOf([{ carrier: "array", result: "float64" }], "array"), null);
    for (const [arrayExtents, rule] of [
      [[rows[1], rows[0]], "native-fact-order"],
      [[rows[0], rows[0]], "native-fact-unique"],
      [[{ carrier: "array", result: "float64" }], "native-fact-value"],
      [[{ carrier: "unknown", result: "int64" }], "native-fact-value"],
    ]) {
      assert.deepEqual(product.verifyNativeFacts({ ...facts, arrayExtents }).map(finding => [finding.rule, finding.site.field]),
        [[rule, "arrayExtents"]]);
    }
  });

  await suite.test("every admitted primitive, integer family and closed law is checked as supplied data", () => {
    for (const carrier of ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
      "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"]) {
      const facts = nativeFactsFixture(); facts.carrierHolding = [{ carrier, holding: "in-place" }];
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const operation of ["add", "subtract", "multiply", "negate", "increment", "decrement", "left-shift"]) {
      for (const law of ["wrap", "unwind", "abort"]) {
        const facts = nativeFactsFixture(); facts.integerOverflow[0] = { carrier: "uint128", operation, result: "uint128", law };
        facts.signedQuotientOverflow[0] = { carrier: "native-int", law };
        assert.deepEqual(product.verifyNativeFacts(facts), []);
      }
    }
    for (const carrier of ["bigint", "decimal", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int128", "uint128", "native-int", "native-uint"]) {
      const facts = nativeFactsFixture(); facts.divisionByZero = [{ carrier, law: "unwind" }];
      facts.remainderByZero = [{ carrier, law: "abort" }];
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const carrier of ["float16", "float32", "float64"]) {
      const facts = nativeFactsFixture();
      facts.divisionByZero = [{ carrier, law: "ieee754" }];
      facts.remainderByZero = [{ carrier, law: "ieee754" }];
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const carrier of ["int8", "int16", "int32", "int64", "int128", "native-int"]) {
      const facts = nativeFactsFixture(); facts.signedQuotientOverflow[0].carrier = carrier;
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const rounding of ["toward-zero", "floor", "ceiling", "nearest-even", "nearest-away"]) {
      const facts = nativeFactsFixture(); facts.divisionRounding[0].rounding = rounding;
      facts.conversions[0].rounding = rounding;
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const sign of ["dividend", "divisor", "nonnegative"]) {
      const facts = nativeFactsFixture(); facts.remainderSign[0].sign = sign;
      assert.deepEqual(product.verifyNativeFacts(facts), []);
    }
    for (const result of [{ kind: "wrap" }, { kind: "saturate" }, { kind: "constant", value: 9007199254740993n }, { kind: "fail", failure: "unwind" }]) {
      const facts = nativeFactsFixture(); facts.conversions[0].outOfRange = result;
      facts.invalidShiftCount[0].law = { kind: "fail", failure: "abort" };
      assert.deepEqual(product.verifyNativeFacts(facts), []);
      assert.equal(typeof product.nativeFactsKey(facts), "string");
    }
    const identity = nativeFactsFixture();
    identity.conversions = [{ from: "int64", to: "int64", rounding: "toward-zero",
      outOfRange: { kind: "not-applicable" }, notANumber: { kind: "not-applicable" },
      positiveInfinity: { kind: "not-applicable" }, negativeInfinity: { kind: "not-applicable" } }];
    assert.deepEqual(product.verifyNativeFacts(identity), []);
    assert.equal(typeof product.nativeFactsKey(identity), "string");
    identity.conversions[0].to = "bigint";
    assert.deepEqual(product.verifyNativeFacts(identity), []);
  });

  await suite.test("array and tuple holding are explicit, unique selected carrier facts", () => {
    const facts = nativeFactsFixture({ arrayHolding: "in-place", fixedArrayHolding: "by-reference" });
    const rows = facts.carrierHolding;
    assert.deepEqual(product.verifyNativeFacts(facts), []);
    assert.equal(product.nativeCarrierHoldingOf(rows, "array"), "in-place");
    assert.equal(product.nativeCarrierHoldingOf(rows, "fixed-array"), "by-reference");
    assert.notEqual(product.nativeFactsKey(facts), product.nativeFactsKey(nativeFactsFixture()));
    assert.equal(product.nativeCarrierHoldingOf(rows.filter(row => row.carrier !== "fixed-array"), "fixed-array"), null);
    const array = rows[0];
    const duplicate = [array, ...rows];
    assert.deepEqual(product.verifyNativeFacts({ ...facts, carrierHolding: duplicate }), [issue("native-fact-unique", "carrierHolding", 1)]);
    assert.equal(product.nativeCarrierHoldingOf(duplicate, "array"), null);
    assert.equal(product.nativeCarrierHoldingOf([{ carrier: "fixed-array", holding: "invalid" }], "fixed-array"), null);
    assert.equal(product.nativeCarrierHoldingOf(Array(22).fill(array), "array"), null);
    assert.equal(product.nativeCarrierHoldingOf(null, "array"), null);
    assert.equal(product.nativeCarrierHoldingOf(rows, "tuple"), null);
    const tuple = { carrier: "tuple", holding: "in-place" };
    const selected = { ...facts, carrierHolding: [...rows, tuple] };
    assert.deepEqual(product.verifyNativeFacts(selected), []);
    assert.equal(product.nativeCarrierHoldingOf(selected.carrierHolding, "tuple"), "in-place");
    assert.notEqual(product.nativeFactsKey(selected), product.nativeFactsKey(facts));
    const ambiguous = [...selected.carrierHolding, { ...tuple, holding: "by-reference" }];
    assert.equal(product.nativeCarrierHoldingOf(ambiguous, "tuple"), null);
    assert.deepEqual(product.verifyNativeFacts({ ...selected, carrierHolding: ambiguous }), [issue("native-fact-unique", "carrierHolding", rows.length + 1)]);
  });

  await suite.test("closed native facts reject missing fields, unknown laws and malformed rows without fallback", () => {
    assert.deepEqual(product.verifyNativeFacts(undefined), [issue("native-fact-value", "nativeFacts", null)]);
    const facts = nativeFactsFixture();
    for (const field of Object.keys(facts).filter(field => !Array.isArray(facts[field]) && field !== "geometry")) {
      assert.deepEqual(product.verifyNativeFacts({ ...facts, [field]: "unknown" }), [issue("native-fact-value", field, null)], field);
    }
    const changes = {
      carrierHolding: [{ carrier: "unknown", holding: "in-place" }, { carrier: "bool", holding: "unknown" }],
      floatingFormats: [{ carrier: "int64", interchange: "ieee754-binary64", nanSignObservable: true, nanPayloadObservable: true, signalingNaNObservable: true },
        ...[{ interchange: "unknown" }, { nanSignObservable: "yes" }, { nanPayloadObservable: 1 }, { signalingNaNObservable: null }]
          .map(change => ({ ...facts.floatingFormats[0], ...change }))],
      nativeIntegerWidths: [{ carrier: "int64", bits: 64 }, ...[0, -1, NaN, Infinity, 1.5].map(bits => ({ carrier: "native-int", bits }))],
      integerOverflow: [{ carrier: "bool", operation: "add", result: "int64", law: "wrap" },
        { carrier: "int64", operation: "unknown", result: "int64", law: "wrap" },
        { carrier: "int64", operation: "add", result: "unknown", law: "wrap" },
        { carrier: "int64", operation: "add", result: "int64", law: "unknown" }],
      divisionByZero: [{ carrier: "unknown", law: "unwind" }, { carrier: "int64", law: "ieee754" }, { carrier: "float64", law: "unknown" }],
      remainderByZero: [{ carrier: "bool", law: "unwind" }, { carrier: "int64", law: "ieee754" }, { carrier: "float64", law: "unknown" }],
      signedQuotientOverflow: [{ carrier: "uint64", law: "wrap" }, { carrier: "int64", law: "unknown" }],
      divisionRounding: [{ carrier: "bool", rounding: "floor" }, { carrier: "int64", rounding: "unknown" }],
      remainderSign: [{ carrier: "bool", sign: "dividend" }, { carrier: "int64", sign: "unknown" }],
      invalidShiftCount: [{ carrier: "float64", law: { kind: "fail", failure: "unwind" } }, { carrier: "int64", law: null },
        { carrier: "int64", law: { kind: "mask", mask: -1n } }, { carrier: "int64", law: { kind: "mask", mask: 1 } },
        { carrier: "int64", law: { kind: "unknown" } }, { carrier: "int64", law: { kind: "fail", failure: "unknown" } }],
    };
    for (const [field, rows] of Object.entries(changes)) for (const row of rows) {
      assert.deepEqual(product.verifyNativeFacts({ ...facts, [field]: [row] }), [issue("native-fact-value", field, 0)], field);
    }
    for (const field of ["outOfRange", "notANumber", "positiveInfinity", "negativeInfinity"]) {
      for (const invalid of [null, undefined, { kind: "unknown" }, { kind: "constant", value: 1 }, { kind: "fail", failure: "unknown" }]) {
        const changed = structuredClone(facts); changed.conversions[0][field] = invalid;
        assert.deepEqual(product.verifyNativeFacts(changed), [issue("native-fact-value", "conversions", 0)]);
      }
    }
    for (const change of [{ from: "unknown" }, { to: "float64" }, { rounding: "unknown" }]) {
      const changed = structuredClone(facts); Object.assign(changed.conversions[0], change);
      assert.deepEqual(product.verifyNativeFacts(changed), [issue("native-fact-value", "conversions", 0)]);
    }
    for (const field of Object.keys(facts).filter(field => Array.isArray(facts[field]))) {
      for (const rows of [undefined, [undefined], [null], Array(400)]) {
        assert.deepEqual(product.verifyNativeFacts({ ...facts, [field]: rows }), [issue("native-fact-value", field, Array.isArray(rows) && rows.length === 1 ? 0 : null)]);
      }
    }
    for (const geometry of [null, undefined, { layouts: null }]) assert.deepEqual(product.verifyNativeFacts({ ...facts, geometry }), [issue("native-fact-value", "geometry", null)]);
  });

  await suite.test("facts tables preserve exact order and unique identities, including all authored layout provenance", () => {
    const facts = nativeFactsFixture();
    for (const field of Object.keys(facts).filter(field => Array.isArray(facts[field]))) {
      const repeated = { ...facts, [field]: [facts[field][0], facts[field][0]] };
      assert.deepEqual(product.verifyNativeFacts(repeated), [issue("native-fact-unique", field, 1)], field);
    }
    const reversed = { ...facts, carrierHolding: [...facts.carrierHolding].reverse() };
    assert.equal(product.verifyNativeFacts(reversed).filter(value => value.rule === "native-fact-order").length,
      facts.carrierHolding.length - 1);
    const registration = { declaration: { providerId: "provider", providerVersion: "1", providerModuleId: "native", moduleSpecifier: "layout", exportId: "abi" },
      layout: { fingerprint: "abi", byteOrder: "little", addressWidth: 64 } };
    facts.geometry.layouts = [registration, registration];
    assert.deepEqual(product.verifyNativeFacts(facts), [issue("native-fact-unique", "geometry.layouts", 1)]);
    for (const field of Object.keys(registration.declaration)) {
      for (const invalid of ["", 0]) {
        const changed = structuredClone(registration); changed.declaration[field] = invalid;
        assert.deepEqual(product.verifyNativeFacts({ ...facts, geometry: { layouts: [changed] } }), [issue("native-fact-value", "geometry.layouts", 0)]);
      }
    }
    for (const change of [{ declaration: null }, { declaration: undefined }, { layout: null }, { layout: undefined },
      { layout: { ...registration.layout, fingerprint: "" } }, { layout: { ...registration.layout, fingerprint: 0 } },
      { layout: { ...registration.layout, byteOrder: "unknown" } }, { layout: { ...registration.layout, addressWidth: 16 } }]) {
      assert.deepEqual(product.verifyNativeFacts({ ...facts, geometry: { layouts: [{ ...registration, ...change }] } }), [issue("native-fact-value", "geometry.layouts", 0)]);
    }
    for (const row of [null, undefined]) {
      assert.deepEqual(product.verifyNativeFacts({ ...facts, geometry: { layouts: [row] } }), [issue("native-fact-value", "geometry.layouts", 0)]);
    }
  });

  await suite.test("floating encoding uses the supplied interchange and preserves every bit regardless of observability", () => {
    const facts = nativeFactsFixture();
    for (const [interchange, width] of [["ieee754-binary16", 16n], ["ieee754-binary32", 32n], ["ieee754-binary64", 64n]]) {
      const format = { ...facts.floatingFormats[0], interchange };
      assert.equal(product.floatingFormatWidth(format), Number(width));
      facts.floatingFormats = [format];
      assert.deepEqual(product.verifyNativeFacts(facts), []);
      const last = (1n << width) - 1n;
      for (const bits of [0n, 1n, 1n << (width - 1n), last]) {
        assert.equal(product.floatingBitsFit(bits, format), true);
        assert.equal(product.floatingBitsFit(bits, { ...format, nanSignObservable: false, nanPayloadObservable: false,
          signalingNaNObservable: false }), true);
      }
      for (const bits of [-1n, 1n << width, 1n << 4096n, 0, undefined]) assert.equal(product.floatingBitsFit(bits, format), false);
      const key = product.nativeFactsKey(facts);
      for (const field of ["nanSignObservable", "nanPayloadObservable", "signalingNaNObservable"]) {
        const changed = { ...facts, floatingFormats: [{ ...format, [field]: false }] };
        assert.notEqual(product.nativeFactsKey(changed), key, field);
      }
      assert.notEqual(product.nativeFactsKey({ ...facts, floatingFormats: [] }), key);
    }
    assert.equal(product.floatingBitsFit(0n, { ...facts.floatingFormats[0], interchange: "unknown" }), false);
    assert.equal(product.floatingFormatWidth({ ...facts.floatingFormats[0], interchange: "unknown" }), null);
    facts.floatingFormats = ["float16", "float32", "float64"].map(carrier => ({ ...facts.floatingFormats[0], carrier }));
    assert.deepEqual(product.verifyNativeFacts(facts), []);
    assert.equal(product.verifyNativeFacts({ ...facts, floatingFormats: [...facts.floatingFormats].reverse() }).filter(row => row.rule === "native-fact-order").length, 2);
  });
}
