/**
 * Promise and async call emission.
 *
 * Public surface barrel for Promise static-call lowering and then/catch/finally
 * chain lowering.
 */

export {
  buildCompletedTaskAst,
  buildDelegateType,
  buildTaskRunInvocation,
} from "./call-promise-task-types.js";
export { emitPromiseStaticCall } from "./call-promise-static.js";
export { emitPromiseThenCatchFinally } from "./call-promise-chains.js";
export { isPromiseChainMethod } from "./call-analysis.js";
