import type {
  AdmitProgramReadyRow,
  CanonicalizeProgram,
  CreateProgramVerificationWork,
  CreateTirReadyReadAdmission,
  Instantiate,
  ParseModuleBodies,
  ParseProgramIndex,
  PrintModuleBodies,
  PrintProgramIndex,
  ProjectProgramEvidence,
  VerifyModuleBodies,
  VerifyProgramIndex,
} from "./contract.js";
import { canonicalizeProgram as canonicalize, projectProgramEvidence as projectEvidence } from "./canonical.js";
import { instantiate as instantiateArtifact } from "./instantiate.js";
import { parseModuleBodies as parseModule, parseProgramIndex as parseIndex } from "./parse.js";
import { printModuleBodies as printModule, printProgramIndex as printIndex } from "./print.js";
import { verifyProgramIndex as verifyIndex } from "./verify-index.js";
import { verifyModuleBodies as verifyModule } from "./verify-module.js";
import { createProgramVerificationWork as createWork, tirReadyReadAdmission as createTirAdmission } from "./verification-work.js";
import { admitProgramReadyRow as admitReady } from "./work.js";

export const canonicalizeProgram: CanonicalizeProgram = canonicalize;
export const projectProgramEvidence: ProjectProgramEvidence = projectEvidence;
export const createProgramVerificationWork: CreateProgramVerificationWork = createWork;
export const tirReadyReadAdmission: CreateTirReadyReadAdmission = createTirAdmission;
export const admitProgramReadyRow: AdmitProgramReadyRow = admitReady;
export const printProgramIndex: PrintProgramIndex = printIndex;
export const parseProgramIndex: ParseProgramIndex = parseIndex;
export const printModuleBodies: PrintModuleBodies = printModule;
export const parseModuleBodies: ParseModuleBodies = parseModule;
export const verifyProgramIndex: VerifyProgramIndex = verifyIndex;
export const verifyModuleBodies: VerifyModuleBodies = verifyModule;
export const instantiate: Instantiate = instantiateArtifact;
