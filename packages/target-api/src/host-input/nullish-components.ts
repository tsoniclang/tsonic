// host-input/nullish-components: the null-versus-undefined split of the checker read witness at a value read (E9,
// PLAN §4.3 typeof row, N7, K-2676). It is the same witness as `SourceHostInput.presence` (the checked type of the value
// read at the node: aliases applied with their actual type arguments, generic member and call results instantiated by
// the checker's one instantiation, control-flow narrowing applied), split per constituent by the factual Legacy reader
// `typeShape.intrinsicNullishFlags` BEFORE the canonical one-absence erasure (descriptors.ts: a nullish constituent
// becomes the one `absence` intrinsic). Nothing here chooses an admission: the Host rule in program-facts.ts decides it
// from these flags (R3). No alias body is walked here: the checker's instantiated read type is the only input.
import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, SourceProgramSemantics } from "./semantics-types.js";

/** The intrinsic nullish constituents of the value read at a node. */
export interface SourceHostNullishComponents {
  /** A constituent is the intrinsic `null`. */
  readonly null: boolean;
  /** A constituent is the intrinsic `undefined`, or `void` (admitted as absence exactly like `undefined`, WP0 A11). */
  readonly undefined: boolean;
  /**
   * Every constituent was classified. false: the checker has no type at the read, or a constituent is opaque (`any`,
   * `unknown`, a type variable or deferred generic type whose values may include null or undefined). An incomplete
   * answer proves only the intrinsics it found; a missing intrinsic is then NOT evidence of absence.
   */
  readonly complete: boolean;
}

const unread: SourceHostNullishComponents = Object.freeze({ null: false, undefined: false, complete: false });

/** One reader per program adapter (its lifetime, I5). */
export function createSourceHostNullishComponents(semantics: SourceProgramSemantics): (node: Node) => SourceHostNullishComponents {
  const read = new Map<Node, SourceHostNullishComponents>();
  // One constituent: an intrinsic null / undefined (factual flags), void, never, or a value type whose TS type facts
  // exclude both intrinsics (the checker's non-nullable form of it is the constituent itself, constraints included).
  const classify = (types: SourceFileSemantics["types"], constituent: Type,
    found: { null: boolean; undefined: boolean; complete: boolean }): void => {
    const flags = types.intrinsicNullishFlags(constituent);
    if (flags.null || flags.undefined) {
      found.null ||= flags.null;
      found.undefined ||= flags.undefined;
      return;
    }
    if (types.isVoidLike(constituent)) { found.undefined = true; return; }
    if (types.isNever(constituent)) return;
    if (types.isAny(constituent) || types.isUnknown(constituent)) { found.complete = false; return; }
    const present = types.nonNullableType(constituent);
    if (present === undefined || !types.isIdentical(present, constituent)) found.complete = false;
  };
  return (node: Node): SourceHostNullishComponents => {
    const existing = read.get(node);
    if (existing !== undefined) return existing;
    const types = semantics.forNode(node).types;
    const type = types.expressionType(node);
    let result = unread;
    if (type !== undefined) {
      const found = { null: false, undefined: false, complete: true };
      for (const constituent of types.isUnion(type) ? types.unionOrIntersectionTypes(type) : [type]) classify(types, constituent, found);
      result = Object.freeze(found);
    }
    read.set(node, result);
    return result;
  };
}
