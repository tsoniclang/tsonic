/**
 * Call Resolution Signatures (facade)
 *
 * Sub-modules:
 * - call-resolution-signatures-raw.ts     : getRawSignature, lookupStructuralMember
 * - call-resolution-signatures-catalog.ts : computeReceiverSubstitution, tryResolveCallFromUnifiedCatalog
 */

export {
  getRawSignature,
  lookupStructuralMember,
} from "./call-resolution-signatures-raw.js";

export {
  computeReceiverSubstitution,
  tryResolveCallFromUnifiedCatalog,
} from "./call-resolution-signatures-catalog.js";
