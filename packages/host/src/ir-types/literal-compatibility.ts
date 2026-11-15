import type { TyId } from "../ids/contract.js";
import type { LiteralCompatibilityOf, LiteralCompatibilityResult } from "./contract.js";
import type { TypeTerm } from "./data.js";
import { readLiteralBase } from "./native-carrier.js";
import { nativeIntegerGeometryOf } from "./native-facts.js";

interface Frame {
  readonly selected: TyId;
  readonly term: TypeTerm;
  readonly children: readonly TyId[];
  next: number;
  missing: LiteralCompatibilityResult | null;
}

export const literalCompatibilityOf: LiteralCompatibilityOf = (table, type, value, facts, reader) => {
  if (!reader.admit(1, 3)) return { kind: "resource-stop" };
  const frames: Frame[] = [];
  const active = new Set<TyId>();
  let current = type;
  let result: LiteralCompatibilityResult | null = null;
  for (;;) {
    if (!reader.admit(1, 0)) return { kind: "resource-stop" };
    if (result === null) {
      const base = readLiteralBase(table, current, reader.typeOf, { value, admit: reader.admit });
      if (base.kind === "resource-stop") return base;
      if (base.kind === "malformed-type") return { kind: "malformed-type", type: base.type };
      if (base.kind === "incompatible") result = base;
      else {
        const term = base.term;
        switch (term.kind) {
          case "optional":
            if (value.kind === "absence") result = { kind: "compatible" };
            else if (active.has(base.type)) throw new TypeError("Literal optional links must be acyclic");
            else {
              if (!reader.admit(1, 3)) return { kind: "resource-stop" };
              active.add(base.type);
              frames.push({ selected: base.type, term, children: [term.value], next: 1, missing: null });
              current = term.value;
              continue;
            }
            break;
          case "union": case "intersection":
            if (active.has(base.type)) result = { kind: "needs-selected-evidence", type: base.type, primitive: null, requirement: "checked-association" };
            else if (term.members.length === 0) result = { kind: term.kind === "union" ? "incompatible" : "compatible" };
            else {
              if (!reader.admit(1, 2)) return { kind: "resource-stop" };
              active.add(base.type);
              frames.push({ selected: base.type, term, children: term.members, next: 1, missing: null });
              const child = term.members[0];
              if (child === undefined) return { kind: "malformed-type", type: base.type };
              current = child;
              continue;
            }
            break;
          case "primitive": {
            if (term.primitive === "bool") { result = { kind: value.kind === "boolean" ? "compatible" : "incompatible" }; break; }
            const integer = nativeIntegerGeometryOf(term.primitive, facts, reader.admit);
            if (integer.kind === "resource-stop") return integer;
            if (integer.kind === "integer") {
              const actual = value.kind === "bigint" ? value.value : value.kind === "number"
                && value.value.denominator === 1n && !value.value.negativeZero ? value.value.numerator : null;
              result = { kind: actual !== null && actual >= integer.minimum && actual <= integer.maximum ? "compatible" : "incompatible" };
            } else result = { kind: "needs-selected-evidence", type: base.type, primitive: term.primitive,
              requirement: integer.kind === "missing-native-width" || term.primitive === "char" || term.primitive === "decimal"
                ? "representation" : "literal-conversion" };
            break;
          }
          case "string": result = { kind: value.kind === "string" ? "compatible" : "incompatible" }; break;
          case "intrinsic": {
            const compatible = term.intrinsic === "any" || term.intrinsic === "unknown"
              || term.intrinsic === "bigint" && value.kind === "bigint"
              || term.intrinsic === "symbol" && value.kind === "unique-symbol"
              || (term.intrinsic === "absence" || term.intrinsic === "void") && value.kind === "absence";
            result = { kind: compatible ? "compatible" : "incompatible" };
            break;
          }
          case "array": case "tuple": case "fixed-array": case "shape": case "callable":
          case "error": result = { kind: "incompatible" }; break;
          case "declared": case "construction-reference": case "enum": case "param": case "self": case "projection": case "open":
            result = { kind: "needs-selected-evidence", type: base.type, primitive: null, requirement: "checked-association" }; break;
        }
      }
    }
    const parent = frames[frames.length - 1];
    if (parent === undefined) return result;
    if (parent.term.kind === "optional" || parent.term.kind === "union" && result.kind === "compatible"
      || parent.term.kind === "intersection" && result.kind === "incompatible") {
      frames.pop(); active.delete(parent.selected);
      continue;
    }
    if (result.kind === "needs-selected-evidence" && parent.missing === null) parent.missing = result;
    if (parent.next === parent.children.length) {
      result = parent.missing ?? { kind: parent.term.kind === "union" ? "incompatible" : "compatible" };
      frames.pop(); active.delete(parent.selected);
    } else {
      if (!reader.admit(1, 0)) return { kind: "resource-stop" };
      const child = parent.children[parent.next++];
      if (child === undefined) return { kind: "malformed-type", type: parent.selected };
      current = child; result = null;
    }
  }
};
