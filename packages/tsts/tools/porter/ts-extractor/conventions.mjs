// Configurable Go->TS porting-convention engine.
//
// Conventions are editable `a => b` equivalence rules in porter.config.json under
// `signatureCheck.conventions`. They normalize a type descriptor before
// comparison, so explicitly-approved porting conventions are accepted without
// per-unit overrides, while genuine drift still flags. The set is extensible,
// but each convention must be narrow: broad "make it pass" rules belong in
// source fixes, not validation.
//
// Config shape:
//   "signatureCheck": { "conventions": {
//     "equivalences": [
//       { "as": "<token>", "match": [ {"name":"comparable"}, {"refName":"GoComparable"}, {"kw":"number"}, {"raw":"~uint32"}, {"rawIncludes":"~int"} ] }
//     ],
//     "structural": {
//       "acceptNullable": false,      // T | undefined  ==  T
//       "unwrapPtrFunc": false,       // GoPtr<(..)=>R>  ==  (..)=>R
//       "anyMapKey": false,           // GoMap<K,V> key types must match
//       "ptrValueEquivStruct": false, // GoPtr<X> == X  (interface/value origin)
//       "acceptNilableGoTypes": true, // Go nilable carriers/interfaces can be T or GoPtr<T>
//       "acceptErasedConstraints": false,
//       "facadeGenerics": [],
//       "facadeGenericRefs": ["packages/tsts/src/go/sync.ts::Pool"]
//     }
//   } }

import { terminalName } from "./ast-signatures.mjs";

// `c` is the conventions config object (profile.conventions).
export function loadConventions(c = {}) {
  return {
    // Each equivalence is SCOPED: "constraint" rules apply only when comparing
    // type-parameter constraints (so a Go numeric constraint can map to `number`
    // WITHOUT making a param `x: int` equal `x: number`); "type" rules apply to
    // ordinary positions. Default scope is "constraint" (the safe default).
    equivalences: (c.equivalences ?? []).map((r) => ({ as: r.as, match: r.match ?? [], scope: r.scope ?? "constraint" })),
    structural: {
      acceptNullable: c.structural?.acceptNullable === true,
      unwrapPtrFunc: c.structural?.unwrapPtrFunc === true,
      anyMapKey: c.structural?.anyMapKey === true,
      ptrValueEquivStruct: c.structural?.ptrValueEquivStruct === true,
      acceptNilableGoTypes: c.structural?.acceptNilableGoTypes === true,
      nilableRefs: new Set(c.structural?.nilableRefs ?? []),
      // A recognized Go constraint (one that normalizes to an `equivalences`
      // token) is acceptable even when the TS type param erases it (`<T>`).
      acceptErasedConstraints: c.structural?.acceptErasedConstraints === true,
      // NAMED facade types the TS port intentionally genericizes from an untyped
      // Go facade (e.g. Go `sync.Pool` -> TS `Pool<T>`): their type args are not
      // compared. Targeted by name — NOT a global "ignore generic args".
      facadeGenerics: new Set(c.structural?.facadeGenerics ?? []),
      // Fully-qualified facade generic identities. Use this where the terminal
      // name is not globally unique enough (e.g. go/sync.Map vs global Map).
      facadeGenericRefs: new Set(c.structural?.facadeGenericRefs ?? []),
    },
  };
}

function matchesPredicate(d, p) {
  if (p.kw !== undefined) return d.t === "kw" && d.kw === p.kw;
  if (p.raw !== undefined) return d.t === "raw" && d.text === p.raw;
  if (p.rawIncludes !== undefined) return d.t === "raw" && d.text.includes(p.rawIncludes);
  if (p.name !== undefined || p.refName !== undefined) {
    const want = p.name ?? p.refName;
    return d.t === "ref" && terminalName(d.id) === want;
  }
  return false;
}

function isGoPtr(d) {
  return d.t === "ref" && terminalName(d.id) === "GoPtr" && d.args.length === 1;
}
function isGoMap(d) {
  return d.t === "ref" && terminalName(d.id) === "GoMap" && d.args.length === 2;
}
function isGoRef(d) {
  return d.t === "ref" && terminalName(d.id) === "GoRef" && d.args.length === 1;
}
function isGoConstraint(d) {
  return d.t === "ref" && terminalName(d.id) === "GoConstraint" && d.args.length === 1 && d.args[0].t === "lit";
}
function isGoCarrierRef(d) {
  return d.t === "ref" && ["GoSlice", "GoMap", "GoChan"].includes(terminalName(d.id));
}
function isNilLiteral(d) {
  return d.t === "kw" && (d.kw === "undefined" || d.kw === "null");
}
function isNilablePayload(d, structural) {
  if (d.t === "fn") return true;
  if (isGoCarrierRef(d)) return true;
  return d.t === "ref" && structural.nilableRefs?.has(d.id);
}

function unwrapNilableGoType(d, structural) {
  if (!structural.acceptNilableGoTypes) return d;
  if (isGoPtr(d) && isNilablePayload(d.args[0], structural)) return d.args[0];
  if (d.t === "union") {
    const nonNil = d.members.filter((m) => !isNilLiteral(m));
    if (nonNil.length === 1 && isNilablePayload(nonNil[0], structural)) return nonNil[0];
  }
  return d;
}

function literalText(d) {
  if (d?.t !== "lit") return undefined;
  try {
    return JSON.parse(d.text);
  } catch {
    return undefined;
  }
}

function goConstraintText(d) {
  if (d.t === "raw" && d.text.includes("~")) return d.text;
  if (isGoConstraint(d)) return literalText(d.args[0]);
  if (d.t === "intersect") {
    const carrier = d.members.find(isGoConstraint);
    return carrier ? literalText(carrier.args[0]) : undefined;
  }
  return undefined;
}

function isPrimitiveLike(d) {
  if (d.t === "kw") return ["boolean", "number", "string", "bigint"].includes(d.kw);
  if (d.t !== "ref") return false;
  return ["bool", "byte", "sbyte", "short", "ushort", "int", "uint", "long", "ulong", "float", "double", "decimal", "char", "nint", "nuint"].includes(terminalName(d.id));
}

// Recursively normalize a type descriptor under the active conventions.
// `context` is "type" (ordinary positions) or "constraint" (type-param bounds);
// structural shape rules apply only to "type"; equivalences apply only to their
// own scope. Children are always normalized in "type" context (a constraint's
// inner types are ordinary types).
export function normalizeDescriptor(d, conv, context = "type") {
  if (!d || typeof d !== "object") return d;
  // Normalize children first (inner types are ordinary positions).
  let n;
  switch (d.t) {
    case "ref":
      n = { t: "ref", id: d.id, args: d.args.map((a) => normalizeDescriptor(a, conv, "type")) };
      break;
    case "array":
      n = { t: "array", element: normalizeDescriptor(d.element, conv, "type") };
      break;
    case "tuple":
      n = { t: "tuple", elements: d.elements.map((e) => normalizeDescriptor(e, conv, "type")) };
      break;
    case "union":
    case "intersect":
      n = { t: d.t, members: d.members.map((m) => normalizeDescriptor(m, conv, "type")) };
      break;
    case "fn":
      n = { t: "fn", params: d.params.map((p) => ({ ...p, type: normalizeDescriptor(p.type, conv, "type") })), ret: normalizeDescriptor(d.ret, conv, "type") };
      break;
    case "object":
      n = {
        t: "object",
        members: d.members.map((m) => m.unsupported ? m : { ...m, type: normalizeDescriptor(m.type, conv, "type") }),
      };
      break;
    default:
      n = d;
  }

  // Structural conventions are type-shape rules; only in "type" context.
  if (context === "type") {
    const s = conv.structural;
    if (s.acceptNullable && n.t === "union") {
      const kept = n.members.filter((m) => !(m.t === "kw" && (m.kw === "undefined" || m.kw === "null")));
      n = kept.length === 1 ? kept[0] : { t: "union", members: kept };
    }
    if (s.unwrapPtrFunc && isGoPtr(n) && n.args[0].t === "fn") {
      n = n.args[0];
    }
    if (s.ptrValueEquivStruct && isGoPtr(n) && (n.args[0].t === "ref" || n.args[0].t === "raw")) {
      n = n.args[0];
    }
    n = unwrapNilableGoType(n, s);
    if (s.anyMapKey && isGoMap(n)) {
      n = { t: "ref", id: n.id, args: [{ t: "conv", token: "mapkey" }, n.args[1]] };
    }
    if (n.t === "ref" && n.args.length > 0 && (s.facadeGenericRefs?.has(n.id) || s.facadeGenerics?.has(terminalName(n.id)))) {
      n = { t: "ref", id: n.id, args: [] };
    }
    if (isGoPtr(n) && isGoRef(n.args[0]) && isPrimitiveLike(n.args[0].args[0])) {
      n = n.args[0];
    } else if (isGoRef(n) && isPrimitiveLike(n.args[0])) {
      n = { t: "ref", id: n.id.replace(/::GoRef$/, "::GoPtr"), args: n.args };
    }
  } else if (context === "constraint") {
    const constraintText = goConstraintText(n);
    if (constraintText) return { t: "conv", token: `go-constraint:${constraintText}` };
  }

  // Value-equivalence rules: collapse matching forms to a shared token, but only
  // rules whose scope matches the current context.
  for (const rule of conv.equivalences) {
    if (rule.scope === context && rule.match.some((p) => matchesPredicate(n, p))) return { t: "conv", token: rule.as };
  }
  return n;
}
