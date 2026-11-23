import type { FormDiagnostics, IndexFormDiagnostics, SafetyDiagnostics } from "./contract.js";
import { checkForms, checkSafety, indexForms } from "./production.js";

export const formDiagnostics: FormDiagnostics = checkForms;
export const indexFormDiagnostics: IndexFormDiagnostics = indexForms;
export const safetyDiagnostics: SafetyDiagnostics = checkSafety;
