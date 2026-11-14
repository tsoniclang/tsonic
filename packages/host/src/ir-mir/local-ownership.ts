import type { LocalOwnershipOfMir } from "./contract.js";

export const ownershipOfMode: LocalOwnershipOfMir = mode => {
  switch (mode) {
    case null: return "undecided";
    case "local": case "by-value": case "move": case "captured-value": return "body";
    case "byref-readonly": case "byref-readwrite": case "byref-writeonly-must-init":
    case "borrow-shared": case "borrow-mut": case "captured-location": return "external";
  }
};
