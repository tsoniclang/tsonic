import type { LowerToMir } from "./contract.js";
import { lowerBody } from "./lower.js";

export const lowerToMir: LowerToMir = (deps, body, internal) => lowerBody(deps, body, internal);
