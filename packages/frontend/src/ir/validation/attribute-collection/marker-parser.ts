/**
 * Attribute Collection — API Detection & Pattern Matching — Facade
 *
 * Re-exports from sub-modules:
 * - marker-detection: parseAttributeTarget, getMemberName,
 *     looksLikeAttributesApiUsage, parseRootCall, parseSelector
 * - marker-chain-parser: tryDetectAttributeMarker
 */

export {
  parseAttributeTarget,
  getMemberName,
  looksLikeAttributesApiUsage,
  parseRootCall,
  parseSelector,
} from "./marker-detection.js";

export { tryDetectAttributeMarker } from "./marker-chain-parser.js";
