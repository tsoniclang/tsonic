/**
 * Structural member extraction and type-alias analysis — Facade
 *
 * Re-exports from sub-modules:
 * - references-structural-bindings: declaration file classification, bindings
 *     resolution, type-alias identity/erasure/recursion analysis
 * - references-structural-members: structural member extraction from declarations,
 *     index signature → dictionary conversion, type alias body expansion
 */

export {
  isTsonicBindingsDeclarationFile,
  isTsonicSourcePackageFile,
  shouldPreserveUserTypeAliasIdentity,
  resolveSourceClrIdentity,
  isSafeToEraseUserTypeAliasTarget,
  isRecursiveUserTypeAliasDeclaration,
  shouldExtractFromDeclaration,
} from "./references-structural-bindings.js";

export {
  extractStructuralMembersFromDeclarations,
  tryConvertPureIndexSignatureToDictionary,
  expandTypeAliasBody,
} from "./references-structural-members.js";
