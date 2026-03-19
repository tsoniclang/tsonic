/**
 * CLR Type String Parsing
 *
 * Pure functions for parsing CLR type strings (from normalized signatures
 * and bindings.json) into IrType nodes.
 *
 * Also includes helpers for converting tsbindgen .d.ts TypeNode AST nodes
 * to IrType and computing signature keys for deterministic overload matching.
 *
 * FACADE: re-exports from clr-type-string-parsing and dts-type-node-conversion.
 */

export {
  parseClrTypeString,
  splitTypeArguments,
} from "./clr-type-string-parsing.js";

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
  makeMethodSignatureKey,
} from "./dts-type-node-conversion.js";
