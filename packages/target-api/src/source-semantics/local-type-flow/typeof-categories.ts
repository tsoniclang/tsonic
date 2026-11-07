import type { AstReader, Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type {
  SourceNullishAdmission, SourceRefusal, SourceSumFacts, SourceTypeofCategoryName, SourceUnionRelation,
} from "../../public/source/facts.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceSolvedValueModel } from "./solver.js";
import { sourceTypeDescriptorStructure } from "./terms.js";
import { sourceTypeFlowEnumValueCategory } from "./element-selection.js";
import type { SourceClosedSum, SourceTypeDescriptor } from "./types.js";

// The typeof category and nullish admission of a typeof/nullish site (E23, WP0 A1/A7, K-2657, N3', N7, Q20): the one
// owner of the decision (REVIEW-R1 #9). The facts assembler (program-facts.ts) only caches and publishes the record.

const wideIntegers: ReadonlySet<SourcePrimitiveKind> = new Set(["int64", "uint64", "int128", "uint128"]);

/** The value-model readers the typeof decision reads (all published Host facts; no checker input except host-input). */
export interface SourceTypeofCategoryInputs {
  readonly ast: AstReader;
  readonly input: SourceHostInput;
  readonly solved: Pick<SourceSolvedValueModel, "numberOrigin" | "literal" | "armNumberOriginKinds" | "numberOriginKinds">;
  readonly sums: Pick<SourceSumFacts, "sum" | "sumOf">;
  relationAt(node: Node): SourceUnionRelation | undefined;
  resolvedType(node: Node): SourceTypeDescriptor | undefined;
  requireType(node: Node, purpose: string): SourceTypeDescriptor;
  absence(selected: SourceTypeDescriptor): "never" | "possible" | "always";
}

/** The typeof/nullish record of `operand` at `operation`, or the refusal of an unproven category. Not memoized here. */
export function createSourceTypeofCategories(inputs: SourceTypeofCategoryInputs):
  (operation: Node, operand: Node) => SourceNullishAdmission | SourceRefusal {
  const { ast, input, solved, sums, relationAt, resolvedType, requireType, absence } = inputs;
  // typeof category of a descriptor's non-nullish part, from its Source (TS) type (N3', contract decision 3).
  function category(selected: SourceTypeDescriptor, operand: Node | undefined): SourceNullishAdmission["category"] {
    const structure = sourceTypeDescriptorStructure(selected);
    switch (structure.kind) {
      case "string": return "string";
      case "primitive":
        if (structure.primitive === "bool") return "boolean";
        if (structure.primitive === "char") return "string";
        return wideIntegers.has(structure.primitive) && (operand === undefined || solved.numberOrigin(operand) === undefined) ? "bigint" : "number";
      case "intrinsic":
        // `object` holds both objects and functions: no single category is proven.
        return structure.intrinsic === "bigint" ? "bigint" : structure.intrinsic === "symbol" ? "symbol" : undefined;
      case "callable": return "function";
      // A value with a call or construct signature is a JS function: a class constructor with static members is a
      // construct-only shape and still `typeof === "function"` (K-2669).
      case "shape": return structure.calls.length > 0 || structure.constructs.length > 0 ? "function" : "object";
      case "array": case "tuple": return "object";
      case "declared":
        // The one enum value category (element-selection.ts): a heterogeneous enum proves no category (R1 #22).
        if (ast.is.IsEnumDeclaration(structure.declaration)) {
          return sourceTypeFlowEnumValueCategory({ ast, literal: node => solved.literal(node) }, structure.declaration);
        }
        // A class instance is an object. A type parameter, or an interface/alias reference without a definition (a
        // recursion cut, an unexpressible declaration-file type), proves no category here.
        return ast.is.IsClassDeclaration(structure.declaration) || ast.is.IsClassExpression(structure.declaration) ? "object" : undefined;
      case "union": {
        const categories = new Set(structure.types.map(member => category(member, operand)));
        return categories.size === 1 ? [...categories][0] : undefined;
      }
      case "optional": return category(structure.value, operand);
    }
  }
  // The nullish admission of an operand whose Host descriptor admits absence (§4.3 E9, N7, K-2676), from the intrinsic
  // null / undefined constituents of the value read at the operand, taken by host-input before the one-absence erasure
  // (aliases with their actual type arguments, generic member and call results, narrowing: host-input/nullish-components).
  // A found intrinsic is proven; a missing one is proven absent only when every constituent was classified. Both found:
  // "both" (an opaque constituent cannot remove a found intrinsic). An opaque constituent or no read: "unavailable".
  function nullishAdmission(operand: Node, absent: boolean): SourceNullishAdmission["admission"] {
    if (!absent) return "none";
    const found = input.nullishComponents(operand);
    if (found.null && found.undefined) return "both";
    if (!found.complete) return "unavailable";
    // A complete read with neither intrinsic while the descriptor keeps absence: the absence arm is not attributable.
    return found.null ? "null-only" : found.undefined ? "undefined-only" : "unavailable";
  }
  // ---- typeof sites (E23, WP0 A1/A7, K-2657) -------------------------------------------------------------------------
  // A wide-integer arm (int64/uint64/int128/uint128) is "number" only when its values come from a Q1-defaulted TS
  // `number` (pre-projection number origin), else "bigint"; every other arm's category follows its descriptor.
  type CategoryName = SourceTypeofCategoryName;
  const isWideInteger = (type: SourceTypeDescriptor): boolean => {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "primitive" && wideIntegers.has(structure.primitive);
  };
  const isAbsenceArm = (type: SourceTypeDescriptor): boolean =>
    type.kind === "intrinsic" && (type.intrinsic === "absence" || type.intrinsic === "void");
  // The pre-Q1 origin kinds of a wide-integer value or sum arm come from the one tracer, the solver (N3′, C-2499, R1 #8);
  // the assembler only supplies the published type and sum readers.
  const originInputs = Object.freeze({ typeOf: resolvedType, sumOf: (type: SourceTypeDescriptor) => sums.sumOf(type) });
  const wideArmOrigins = (sum: SourceClosedSum, arm: SourceTypeDescriptor) => solved.armNumberOriginKinds(sum, arm, originInputs);
  const valueOrigins = (node: Node) => solved.numberOriginKinds(node, originInputs);
  function sumArmCategory(sum: SourceClosedSum, index: number, admission: SourceNullishAdmission["admission"]):
    CategoryName | "unproven" | "conflict" {
    const arm = sum.arms[index]!.type;
    if (isAbsenceArm(arm)) return admission === "undefined-only" ? "undefined" : admission === "null-only" ? "object" : "unproven";
    if (!isWideInteger(arm)) return category(arm, undefined) ?? "unproven";
    const origins = wideArmOrigins(sum, arm);
    return origins === undefined ? "unproven" : origins.size === 1 ? [...origins][0]! : "conflict";
  }
  return function typeofCategory(operation: Node, operand: Node): SourceNullishAdmission | SourceRefusal {
    const selected = requireType(operand, "a typeof/nullish admission");
    const admission = nullishAdmission(operand, absence(selected) !== "never");
    // The category an absent operand value has (Q20): undefined-only is "undefined"; null-only, both and unavailable are
    // "object" (typeof null). Present for every admission except "none".
    const absentCategory = admission === "none" ? {} : { absentCategory: admission === "undefined-only" ? "undefined" as const : "object" as const };
    const sum = selected.kind === "union" || selected.kind === "optional" ? sums.sumOf(selected) : undefined;
    let record: SourceNullishAdmission | SourceRefusal;
    if (sum !== undefined) {
      const categories = sum.arms.map((_, index) => sumArmCategory(sum, index, admission));
      if (categories.includes("conflict")) {
        record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_UNION", site: operation, related: operand,
          message: "Values from a number and from an explicit 64-bit integer share one union arm of this operand, so its " +
            "typeof category is not proven. Annotate the value as number or as the explicit integer type." });
      } else {
        const roles = sum.roles.map(role => {
          const arms = role.arms.map(arm => Object.freeze({ arm, category: categories[arm] as CategoryName | "unproven" }));
          const proven = [...new Set(arms.flatMap(arm => arm.category === "unproven" ? [] : [arm.category]))];
          return Object.freeze({ role: role.role, categories: Object.freeze(proven), arms: Object.freeze(arms) });
        });
        record = Object.freeze({ kind: "typeof-site", operation, operand, admission, ...absentCategory,
          sum: Object.freeze({ identity: sum.identity, roles: Object.freeze(roles) }) });
      }
    } else {
      // A narrowed read that extracts one arm of a declared sum keeps that arm's category (its own origin).
      const relation = ast.is.IsIdentifier(operand) ? relationAt(operand) : undefined;
      let selectedCategory: CategoryName | "unproven" | "conflict" | undefined;
      const present = sourceTypeDescriptorStructure(selected);
      const value = present.kind === "optional" ? present.value : selected;
      if (relation?.kind === "extract-arm") selectedCategory = sumArmCategory(sums.sum(relation.sum), relation.arm, admission);
      else if (isWideInteger(value)) {
        const origins = valueOrigins(operand);
        selectedCategory = origins === undefined ? "unproven" : origins.size === 1 ? [...origins][0]! : "conflict";
      } else selectedCategory = category(selected, operand);
      if (selectedCategory === "conflict") {
        record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_UNION", site: operation, related: operand,
          message: "Values from a number and from an explicit 64-bit integer reach this operand, so its typeof category " +
            "is not proven. Annotate the value as number or as the explicit integer type." });
      } else {
        const scalar = selectedCategory === "unproven" || selectedCategory === "undefined" ? undefined : selectedCategory;
        record = Object.freeze({ kind: "typeof-site", operation, operand, admission, ...absentCategory,
          ...(scalar === undefined ? {} : { category: scalar }), sum: undefined });
      }
    }
    return record;
  };
}
