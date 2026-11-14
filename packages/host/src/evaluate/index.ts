import type { Evaluate, ResumeEvaluate } from "./contract.js";
import { evaluate as start, resumeEvaluate as resume } from "./machine.js";

export const evaluate: Evaluate = start;
export const resumeEvaluate: ResumeEvaluate = resume;
