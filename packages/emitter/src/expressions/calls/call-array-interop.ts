/**
 * Native array wrapper interop for call expressions — facade re-exports.
 *
 * Implementations live in:
 *   - call-array-mutation.ts
 *   - call-array-wrapper.ts
 */

export {
  shouldPreferNativeArrayWrapperInterop,
  hasDirectNativeArrayLikeInteropShape,
  emitArrayMutationInteropCall,
} from "./call-array-mutation.js";

export {
  shouldNormalizeArrayLikeInteropResult,
  emitArrayWrapperInteropCall,
} from "./call-array-wrapper.js";
