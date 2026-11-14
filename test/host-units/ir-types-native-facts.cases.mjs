import assert from "node:assert/strict";
import { nativeFactsFixture } from "./fixtures/native-facts.mjs";

const issue = (rule, field, index) => ({ rule, site: { field, index }, detail: [{ kind: "text", value: field }] });

export async function nativeFactsCases(suite, product) {
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
      carrierHolding: row => { row.holding = "by-reference"; },
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
    assert.equal(product.verifyNativeFacts(reversed).filter(value => value.rule === "native-fact-order").length, 3);
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
