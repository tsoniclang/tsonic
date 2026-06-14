/**
 * Binding Layer — Call & Constructor Signature Resolution — Facade
 *
 * Re-exports from sub-modules:
 * - binding-call-resolution-calls: resolveCallSignature
 * - binding-call-resolution-candidates: resolveConstructorSignature
 */

export { resolveCallSignature } from "./binding-call-resolution-calls.js";
export { resolveConstructorSignature } from "./binding-call-resolution-candidates.js";
