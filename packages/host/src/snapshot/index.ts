import type { VerifyPreparedSource, VerifySnapshot } from "./contract.js";
import { verifyPreparedSource as verifyPrepared, verifyProjectSnapshot } from "./verify.js";

export const verifySnapshot: VerifySnapshot = verifyProjectSnapshot;
export const verifyPreparedSource: VerifyPreparedSource = verifyPrepared;
