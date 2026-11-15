import type { FormDiagnostics, SafetyDiagnostics } from "./contract.js";
import { checkForms, checkSafety } from "./production.js";

export const formDiagnostics: FormDiagnostics = checkForms;
export const safetyDiagnostics: SafetyDiagnostics = checkSafety;
