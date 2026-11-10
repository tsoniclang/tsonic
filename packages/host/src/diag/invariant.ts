import type { ThrowInvariant } from "./contract.js";

export const failInvariant: ThrowInvariant = failure => {
  throw failure;
};
