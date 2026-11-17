import type { AnalyzeBodyRound, ProveInitialization } from "./contract.js";
import { analyzeRound } from "./round.js";
import { proveModuleInitialization } from "./proof.js";

export const analyzeBodyRound: AnalyzeBodyRound = analyzeRound;
export const proveInitialization: ProveInitialization = proveModuleInitialization;
