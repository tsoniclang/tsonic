import type { CaptureRequiresLocation, SameCaptureSource } from "./contract.js";

// A binding that can be reassigned, a parameter that denotes its argument's storage, and a captured location of the
// creating body are storage another party can still write. A closure that captured the value held there would stop
// following it, so such a capture is a captured location. A by-value or moved parameter is the body's own cell.
export const requiresLocation: CaptureRequiresLocation = (reassignable, incoming) => {
  if (reassignable) return true;
  switch (incoming.kind) {
    case "binding": return false;
    case "parameter": return incoming.passing !== "by-value" && incoming.passing !== "move";
    case "capture": return incoming.capture === "captured-location";
  }
};

export const sameSource: SameCaptureSource = (left, right) => {
  switch (left.kind) {
    case "binding": return right.kind === "binding";
    case "parameter": return right.kind === "parameter" && right.passing === left.passing;
    case "capture": return right.kind === "capture" && right.capture === left.capture;
  }
};
