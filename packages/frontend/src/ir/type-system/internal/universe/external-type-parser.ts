/**
 * External Type String Parsing
 *
 * Pure functions for parsing target type strings (from normalized signatures
 * and bindings.json) into IrType nodes.
 *
 * Also includes helpers for converting tsbindgen .d.ts TypeNode AST nodes
 * to IrType and computing signature keys for deterministic overload matching.
 *
 * FACADE: re-exports from external-type-string-parsing and dts-type-node-conversion.
 */

export {
  parseExternalTypeString,
  splitTypeArguments,
} from "./external-type-string-parsing.js";

export {
  INSTANCE_SUFFIX,
  VIEWS_PREFIX,
  VIEWS_SUFFIX,
  stripTsBindgenInstanceSuffix,
  stripTsBindgenViewsWrapper,
  getRightmostQualifiedNameText,
  getRightmostPropertyAccessText,
  dtsTypeNodeToIrType,
  irTypeToSignatureKey,
  makeMethodOverloadKey,
} from "./dts-type-node-conversion.js";
