import type { LowerToMir } from "./contract.js";
import { lowerBody } from "./lower.js";

// The initializer bodies supplied with a typed body are not read yet: no construct this lowering admits executes one.
export const lowerToMir: LowerToMir = (deps, body) => lowerBody(deps, body);
