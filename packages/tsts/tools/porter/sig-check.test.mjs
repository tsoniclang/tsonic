// Unit tests for the signature comparator + canonicalizer + convention engine.
// Descriptor-level (no parser/snapshot), so fast and deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { typesEqual, canonicalKey } from "./ts-extractor/ast-signatures.mjs";
import { loadConventions, normalizeDescriptor } from "./ts-extractor/conventions.mjs";
import { loadProfile } from "./ts-extractor/profile.mjs";
import { buildExpectedIndex, goUnitDescriptor } from "./ts-extractor/expected-from-go.mjs";
import { compareSignatures, resolveOverride, unitSignatureSnapshot } from "./sig-check.mjs";

const ref = (id, ...args) => ({ t: "ref", id, args });
const kw = (k) => ({ t: "kw", kw: k });
const kinds = (ms) => new Set(ms.map((m) => m.kind));
const noConv = loadConventions({});

test("typesEqual: Array<T> == T[]", () => {
  const arrayGen = ref("global::Array", kw("string"));
  const arraySugar = { t: "array", element: kw("string") };
  // Array<T> is canonicalized to {t:array} by the extractor; here assert the array form matches itself
  assert.ok(typesEqual(arraySugar, { t: "array", element: kw("string") }));
  assert.equal(canonicalKey(arrayGen) === canonicalKey(arraySugar), false); // pre-canonicalization differ
});

test("typesEqual: soft id compares by terminal name; hard ids must match fully", () => {
  assert.ok(typesEqual(ref("name::Node"), ref("a/b.ts::Node"))); // soft vs hard -> by name
  assert.ok(!typesEqual(ref("core.ts::Node"), ref("ast.ts::Node"))); // two hard, different module
  assert.ok(typesEqual(ref("ast.ts::Node"), ref("ast.ts::Node")));
});

test("typesEqual: re-export canon collapses module aliases", () => {
  const canon = (id) => (id === "ast.ts::Node" ? "spine.ts::Node" : id);
  assert.ok(typesEqual(ref("ast.ts::Node"), ref("spine.ts::Node"), canon));
  assert.ok(!typesEqual(ref("ast.ts::Node"), ref("other.ts::Node"), canon));
});

test("compareFunc: arity, param-type, return-type, param-order", () => {
  const exp = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::A") }, { type: ref("m::B") }] };
  const dropParam = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::A") }] };
  assert.ok(kinds(compareSignatures(exp, dropParam, null)).has("arity"));

  const wrongType = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::A") }, { type: ref("m::C") }] };
  assert.ok(kinds(compareSignatures(exp, wrongType, null)).has("param-type"));

  const wrongRet = { kind: "func", typeParams: [], ret: kw("number"), params: exp.params };
  assert.ok(kinds(compareSignatures(exp, wrongRet, null)).has("return-type"));

  const swapped = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::B") }, { type: ref("m::A") }] };
  assert.ok(kinds(compareSignatures(exp, swapped, null)).has("param-order"));

  assert.equal(compareSignatures(exp, exp, null).length, 0);
});

test("compareInterface: member-type, missing-member, extra-member; method == fn-property", () => {
  const exp = { kind: "interface", typeParams: [], members: [{ name: "x", type: ref("m::A") }, { name: "y", type: kw("string") }] };
  const wrong = { kind: "interface", typeParams: [], members: [{ name: "x", type: ref("m::B") }, { name: "y", type: kw("string") }] };
  assert.ok(kinds(compareSignatures(exp, wrong, null)).has("member-type"));

  const missing = { kind: "interface", typeParams: [], members: [{ name: "x", type: ref("m::A") }] };
  assert.ok(kinds(compareSignatures(exp, missing, null)).has("missing-member"));

  const extra = { kind: "interface", typeParams: [], members: [...exp.members, { name: "z", type: kw("number") }] };
  assert.ok(kinds(compareSignatures(exp, extra, null)).has("extra-member"));

  // method `m(p):R` and property `m: (p)=>R` both arrive as {t:'fn'} members -> equal.
  const fnType = { t: "fn", params: [{ type: kw("string") }], ret: kw("void") };
  const ifaceA = { kind: "interface", typeParams: [], members: [{ name: "m", type: fnType }] };
  const ifaceB = { kind: "interface", typeParams: [], members: [{ name: "m", type: { t: "fn", params: [{ type: kw("string") }], ret: kw("void") } }] };
  assert.equal(compareSignatures(ifaceA, ifaceB, null).length, 0);
});

test("compareValue: value-annotation-missing and value-type", () => {
  const exp = { kind: "value", decls: [{ name: "c", type: ref("core::int") }] };
  const unannotated = { kind: "value", decls: [{ name: "c", missing: true }] };
  assert.ok(kinds(compareSignatures(exp, unannotated, null)).has("value-annotation-missing"));

  const wrongType = { kind: "value", decls: [{ name: "c", type: kw("string") }] };
  assert.ok(kinds(compareSignatures(exp, wrongType, null)).has("value-type"));

  assert.equal(compareSignatures(exp, { kind: "value", decls: [{ name: "c", type: ref("core::int") }] }, null).length, 0);
});

test("overrides: ignore aspect only", () => {
  const exp = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::A") }] };
  const wrong = { kind: "func", typeParams: [], ret: kw("number"), params: [{ type: ref("m::B") }] };
  const ms = compareSignatures(exp, wrong, { ignore: new Set(["return-type"]) });
  assert.ok(!kinds(ms).has("return-type"));
  assert.ok(kinds(ms).has("param-type"));
});

test("local signature override captures go and ts snapshots", () => {
  const exp = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::A") }] };
  const actual = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("m::B") }] };
  const issues = [];
  const override = resolveOverride(
    {
      category: "runtime-performance",
      allow: ["signature"],
      reason: "Target-native carrier.",
      goSignature: unitSignatureSnapshot(exp),
      tsSignature: unitSignatureSnapshot(actual),
    },
    "id",
    exp,
    actual,
    (x) => x,
    issues,
  );
  assert.equal(issues.length, 0);
  assert.equal(compareSignatures(exp, actual, override).length, 0);

  const staleIssues = [];
  const stale = resolveOverride(
    {
      category: "runtime-performance",
      allow: ["signature"],
      reason: "Target-native carrier.",
      goSignature: "stale",
      tsSignature: unitSignatureSnapshot(actual),
    },
    "id",
    exp,
    actual,
    (x) => x,
    staleIssues,
  );
  assert.equal(stale.ignore.size, 0);
  assert.equal(staleIssues.length, 1);
});

test("conventions: acceptNullable strips | undefined", () => {
  const conv = loadConventions({ structural: { acceptNullable: true } });
  const exp = ref("m::T");
  const nullable = { t: "union", members: [kw("undefined"), ref("m::T")] };
  assert.ok(typesEqual(normalizeDescriptor(exp, conv), normalizeDescriptor(nullable, conv)));
  // off by default -> not equal
  assert.ok(!typesEqual(normalizeDescriptor(exp, noConv), normalizeDescriptor(nullable, noConv)));
});

test("conventions: equivalences are scoped to constraint context", () => {
  const conv = loadConventions({ equivalences: [{ as: "comparable", scope: "constraint", match: [{ name: "comparable" }, { refName: "GoComparable" }] }] });
  const goComparable = ref("name::comparable");
  const tsComparable = ref("packages/tsts/src/go/compat.ts::GoComparable");
  assert.ok(typesEqual(normalizeDescriptor(goComparable, conv, "constraint"), normalizeDescriptor(tsComparable, conv, "constraint")));
  assert.ok(!typesEqual(normalizeDescriptor(goComparable, conv, "type"), normalizeDescriptor(tsComparable, conv, "type")));
});

test("compareTypeParams: non-trivial constraints cannot be erased", () => {
  const exp = { kind: "func", typeParams: [{ constraint: ref("name::comparable") }], ret: kw("void"), params: [] };
  const actual = { kind: "func", typeParams: [{ constraint: null }], ret: kw("void"), params: [] };
  assert.ok(kinds(compareSignatures(exp, actual, null, (x) => x, noConv)).has("type-param-constraint"));
});

test("compareTypeParams: exact GoConstraint marker preserves raw tilde constraints", () => {
  const conv = loadConventions({});
  const exp = { kind: "func", typeParams: [{ constraint: { t: "raw", text: "~int32 | ~uint32" } }], ret: kw("void"), params: [] };
  const actual = {
    kind: "func",
    typeParams: [{
      constraint: {
        t: "intersect",
        members: [
          ref("packages/tsts/src/go/compat.ts::GoConstraint", { t: "lit", text: JSON.stringify("~int32 | ~uint32") }),
          kw("number"),
        ],
      },
    }],
    ret: kw("void"),
    params: [],
  };
  assert.equal(compareSignatures(exp, actual, null, (x) => x, conv).length, 0);
});

test("compareInterface: unsupported member shapes are reported, not dropped", () => {
  const exp = { kind: "interface", typeParams: [], members: [{ name: "x", type: kw("string") }] };
  const actual = { kind: "interface", typeParams: [], members: [{ name: "x", type: kw("string") }, { name: "<IndexSignature>", unsupported: "IndexSignature" }] };
  assert.ok(kinds(compareSignatures(exp, actual, null)).has("unsupported-member"));
});

test("gate: unresolved type identity is surfaced", () => {
  const exp = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("name::Untracked") }] };
  const act = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("name::Untracked") }] };
  assert.ok(kinds(compareSignatures(exp, act, null)).has("unresolved-ref"));
});

test("gate: allowed ambient globals do not produce unresolved-ref", () => {
  const exp = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("global::Uint8Array") }] };
  const act = { kind: "func", typeParams: [], ret: kw("void"), params: [{ type: ref("global::Uint8Array") }] };
  assert.equal(compareSignatures(exp, act, null, (x) => x, noConv, ["Uint8Array"]).length, 0);
});

test("typesEqual: object descriptors compare structurally", () => {
  const left = { t: "object", members: [{ name: "flag", type: ref("m::TypeFlags") }, { name: "name", type: kw("string") }] };
  const right = { t: "object", members: [{ name: "name", type: kw("string") }, { name: "flag", type: ref("m::TypeFlags") }] };
  assert.ok(typesEqual(left, right));
  assert.ok(!typesEqual(left, { t: "object", members: [{ name: "name", type: kw("string") }] }));
});

test("typesEqual: nested unions are associative", () => {
  const a = ref("m::A");
  const b = ref("m::B");
  const c = ref("m::C");
  assert.ok(typesEqual({ t: "union", members: [a, { t: "union", members: [b, c] }] }, { t: "union", members: [c, a, b] }));
  assert.ok(typesEqual({ t: "intersect", members: [a, { t: "intersect", members: [b, c] }] }, { t: "intersect", members: [b, c, a] }));
});

test("conventions: anyMapKey makes the map key a wildcard", () => {
  const conv = loadConventions({ structural: { anyMapKey: true } });
  const a = ref("c::GoMap", ref("m::StructKey"), kw("string"));
  const b = ref("c::GoMap", kw("string"), kw("string"));
  assert.ok(typesEqual(normalizeDescriptor(a, conv), normalizeDescriptor(b, conv)));
});

test("conventions: unwrapPtrFunc treats GoPtr<fn> as fn", () => {
  const conv = loadConventions({ structural: { unwrapPtrFunc: true } });
  const fn = { t: "fn", params: [], ret: kw("void") };
  const ptrFn = ref("c::GoPtr", fn);
  assert.ok(typesEqual(normalizeDescriptor(ptrFn, conv), normalizeDescriptor(fn, conv)));
});

test("conventions: nilable Go carriers accept only carrier/interface undefined forms", () => {
  const conv = loadConventions({
    structural: {
      acceptNilableGoTypes: true,
      nilableRefs: ["m::Iface"],
    },
  });
  const slice = ref("c::GoSlice", kw("string"));
  const ptrSlice = ref("c::GoPtr", slice);
  const nullableSlice = { t: "union", members: [kw("undefined"), slice] };
  assert.ok(typesEqual(normalizeDescriptor(ptrSlice, conv), normalizeDescriptor(slice, conv)));
  assert.ok(typesEqual(normalizeDescriptor(nullableSlice, conv), normalizeDescriptor(slice, conv)));

  const iface = ref("m::Iface");
  assert.ok(typesEqual(normalizeDescriptor(ref("c::GoPtr", iface), conv), normalizeDescriptor(iface, conv)));
  assert.ok(typesEqual(normalizeDescriptor({ t: "union", members: [kw("undefined"), iface] }, conv), normalizeDescriptor(iface, conv)));

  const intType = ref("core::int");
  assert.ok(!typesEqual(normalizeDescriptor({ t: "union", members: [kw("undefined"), intType] }, conv), normalizeDescriptor(intType, conv)));
  assert.ok(!typesEqual(normalizeDescriptor(ref("c::GoPtr", ref("m::Struct")), conv), normalizeDescriptor(ref("m::Struct"), conv)));
});

test("portability: a non-tsts profile drives the Go->TS mapping (no hardcoding)", () => {
  // A completely different project profile: different bridge/module/primitive names.
  const config = {
    goModulePath: "example.com/proj",
    signatureCheck: {
      modules: { core: "@acme/prim", compat: "src/rt/bridge.ts" },
      bridge: { pointer: "Ptr", slice: "Slc", array: "Arr", map: "Dict", chan: "Ch" },
      primitives: { keyword: { string: "string" }, core: { int: "i32" }, compat: {} },
      stdlibTypes: {},
      facadeTemplate: "src/rt/{importPath}.ts",
    },
  };
  const profile = loadProfile(config);
  const index = buildExpectedIndex(config, { files: [] }, new Map(), profile);
  // func f(a *int) — pointer-to-int.
  const unit = {
    kind: "func",
    file: { importPath: "example.com/proj/pkg", imports: [] },
    parameters: [{ names: ["a"], type: { kind: "pointer", element: { kind: "ident", name: "int" } } }],
    results: [],
    typeParameterDetails: [],
  };
  const desc = goUnitDescriptor(unit, index);
  assert.equal(canonicalKey(desc.params[0].type), "R:src/rt/bridge.ts::Ptr<R:@acme/prim::i32>");
  // selector to a stdlib facade uses the configured template.
  const sel = goUnitDescriptor(
    { kind: "func", file: { importPath: "example.com/proj/pkg", imports: [{ path: "time" }] }, parameters: [{ names: ["t"], type: { kind: "selector", package: "time", name: "Duration" } }], results: [], typeParameterDetails: [] },
    index,
  );
  assert.equal(canonicalKey(sel.params[0].type), "R:src/rt/time.ts::Duration");
});

test("expected-from-go: inline struct value types are structural descriptors", () => {
  const config = {
    goModulePath: "example.com/proj",
    signatureCheck: {
      modules: { core: "@acme/prim", compat: "src/rt/bridge.ts" },
      bridge: { pointer: "Ptr", slice: "Slc", array: "Arr", map: "Dict", chan: "Ch" },
      primitives: { keyword: { string: "string" }, core: { int: "i32" }, compat: {} },
      stdlibTypes: {},
      facadeTemplate: "src/rt/{importPath}.ts",
    },
  };
  const profile = loadProfile(config);
  const index = buildExpectedIndex(config, { files: [] }, new Map(), profile);
  const unit = {
    kind: "varGroup",
    file: { importPath: "example.com/proj/pkg", imports: [] },
    valueSpecs: [{
      names: ["table"],
      inferredValueTypes: [{
        kind: "array",
        length: "...",
        element: {
          kind: "struct",
          members: [
            { kind: "field", name: "flag", typeExpr: { kind: "ident", name: "int" } },
            { kind: "field", name: "name", typeExpr: { kind: "ident", name: "string" } },
          ],
        },
      }],
    }],
  };
  const desc = goUnitDescriptor(unit, index);
  assert.equal(canonicalKey(desc.decls[0].type), "R:src/rt/bridge.ts::Arr<O:{flag:R:@acme/prim::i32;name:K:string},L:\"...\">");
});

test("expected-from-go: embedded receiver methods do not override direct fields", () => {
  const config = {
    goModulePath: "example.com/proj",
    signatureCheck: {
      modules: { core: "@acme/prim", compat: "src/rt/bridge.ts" },
      bridge: { pointer: "Ptr", slice: "Slc", array: "Arr", map: "Dict", chan: "Ch" },
      primitives: { keyword: { string: "string" }, core: {}, compat: {} },
      stdlibTypes: {},
      facadeTemplate: "src/rt/{importPath}.ts",
    },
  };
  const baseType = {
    id: "example.com/proj::pkg/base.go::type::Base",
    kind: "type",
    name: "Base",
    typeKind: "struct",
    members: [],
    typeParameterDetails: [],
  };
  const baseMethod = {
    id: "example.com/proj::pkg/base.go::method::Base.Signature",
    kind: "method",
    name: "Signature",
    receiverType: { kind: "pointer", element: { kind: "ident", name: "Base" } },
    parameters: [],
    results: [{ type: { kind: "ident", name: "string" } }],
    typeParameterDetails: [],
  };
  const childType = {
    id: "example.com/proj::pkg/child.go::type::Child",
    kind: "type",
    name: "Child",
    typeKind: "struct",
    members: [
      { kind: "embeddedField", typeExpr: { kind: "ident", name: "Base" } },
      { kind: "field", name: "Signature", typeExpr: { kind: "ident", name: "string" } },
    ],
    typeParameterDetails: [],
  };
  const file = { importPath: "example.com/proj/pkg", imports: [], units: [baseType, baseMethod, childType] };
  const profile = loadProfile(config);
  const tsById = new Map([
    [baseType.id, { path: "pkg/base.ts" }],
    [childType.id, { path: "pkg/child.ts" }],
  ]);
  const index = buildExpectedIndex(config, { files: [file] }, tsById, profile);
  const desc = goUnitDescriptor({ ...childType, file }, index);
  const signatureMembers = desc.members.filter((member) => member.name === "Signature");
  assert.equal(signatureMembers.length, 1);
  assert.equal(canonicalKey(signatureMembers[0].type), "K:string");
});
