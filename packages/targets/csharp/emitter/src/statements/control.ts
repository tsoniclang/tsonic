/**
 * Control flow statement emitters (if, while, for, switch, try, throw)
 * Main dispatcher - re-exports from control/ subdirectory
 */

export {
  emitIfStatementAst,
  emitWhileStatementAst,
  emitForStatementAst,
  emitForOfStatementAst,
  emitForInStatementAst,
  emitSwitchStatementAst,
  emitTryStatementAst,
  emitThrowStatementAst,
} from "./control/index.js";
