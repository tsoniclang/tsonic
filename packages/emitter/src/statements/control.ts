/**
 * Control flow statement emitters (if, while, for, switch, try, throw)
 * Main dispatcher - re-exports from control/ subdirectory
 */

export {
  emitIfStatement,
  emitWhileStatement,
  emitForStatement,
  emitForOfStatement,
  emitForInStatement,
  emitSwitchStatement,
  emitTryStatement,
  emitThrowStatement,
} from "./control/index.js";
