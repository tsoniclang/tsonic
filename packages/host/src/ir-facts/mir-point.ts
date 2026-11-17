import type { MirTerminator } from "../ir-mir/contract.js";
import type { StoreEdge } from "./relations-data.js";

export const hasStoreEdge = (terminator: MirTerminator, edge: StoreEdge): boolean => {
  switch (terminator.kind) {
    case "check": case "call": case "invoke": return edge === "continue" || edge === "unwind" && terminator.unwind.kind === "handler";
    case "await": return edge === "resume" || edge === "unwind" && terminator.unwind.kind === "handler";
    case "yield": case "delegate": return edge === "resume" || edge === "return" || edge === "unwind" && terminator.unwind.kind === "handler";
    case "throw": return edge === "unwind" && terminator.unwind.kind === "handler";
    case "goto": case "switch": case "return": case "unreachable": return false;
  }
};
