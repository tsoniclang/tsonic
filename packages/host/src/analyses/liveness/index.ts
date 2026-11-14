import type { AnalyzeStorageUse } from "./contract.js";
import { analyzeBodyStorageUse } from "./storage-use.js";

export const analyzeStorageUse: AnalyzeStorageUse = analyzeBodyStorageUse;
