/**
 * Static Safety Validation
 *
 * Detects patterns that violate static typing requirements:
 * - TSN7401: 'any' type usage
 * - TSN7402: 'unknown' type usage outside erased overload stubs
 * - TSN7403: Object literal without contextual nominal type
 * - TSN7405: Untyped function/arrow/lambda parameter
 * - TSN7406: Mapped types not supported (retired)
 * - TSN7407: Conditional types not supported (retired)
 * - TSN7408: Mixed variadic tuples not supported (retired)
 * - TSN7409: 'infer' keyword not supported (retired)
 * - TSN7410: Intersection types not supported (retired)
 * - TSN7413: Dictionary key must be string, number, or symbol
 * - TSN7430: Arrow function requires explicit types (escape hatch)
 *
 * This ensures NativeAOT-compatible, predictable-performance output.
 *
 * Note: We intentionally do NOT validate JS built-in usage (arr.map, str.length)
 * or dictionary dot-access patterns. These will fail naturally in C# if used
 * incorrectly, which is an acceptable failure mode.
 *
 * Facade: re-exports from sub-modules.
 */

export { validateStaticSafety } from "./static-safety-rules.js";
