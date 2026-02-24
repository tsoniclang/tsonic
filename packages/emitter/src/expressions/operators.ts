/**
 * Operator expression emitters (binary, logical, unary, update, assignment, conditional)
 *
 * NEW NUMERIC SPEC:
 * - Literals use raw lexeme (no contextual widening)
 * - Integer casts only from IrCastExpression (not inferred from expectedType)
 * - Binary ops: int op int = int, double op anything = double (C# semantics)
 */

export { emitBinary } from "./operators/binary-emitter.js";
export { emitLogical } from "./operators/logical-emitter.js";
export { emitUnary, emitUpdate } from "./operators/unary-emitter.js";
export { emitAssignment } from "./operators/assignment-emitter.js";
export { emitConditional } from "./operators/conditional-emitter.js";
