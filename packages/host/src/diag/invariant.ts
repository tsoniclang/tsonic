import type { ThrowInvariant } from "./contract.js";

export const failInvariant: ThrowInvariant = failure => {
  throw new Error(failure.message, { cause: failure });
};
