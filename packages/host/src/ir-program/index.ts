import type {
  CanonicalizeProgram,
  Instantiate,
  ParseModuleBodies,
  ParseProgramIndex,
  PrintModuleBodies,
  PrintProgramIndex,
  VerifyModuleBodies,
  VerifyProgramIndex,
} from "./contract.js";
import { canonicalizeProgram as canonicalize } from "./canonical.js";
import { instantiate as instantiateArtifact } from "./instantiate.js";
import { parseModuleBodies as parseModule, parseProgramIndex as parseIndex } from "./parse.js";
import { printModuleBodies as printModule, printProgramIndex as printIndex } from "./print.js";
import { verifyProgramIndex as verifyIndex } from "./verify-index.js";
import { verifyModuleBodies as verifyModule } from "./verify-module.js";
export { createProgramVerificationWork } from "./verification-work.js";

export const canonicalizeProgram: CanonicalizeProgram = canonicalize;
export const printProgramIndex: PrintProgramIndex = printIndex;
export const parseProgramIndex: ParseProgramIndex = parseIndex;
export const printModuleBodies: PrintModuleBodies = printModule;
export const parseModuleBodies: ParseModuleBodies = parseModule;
export const verifyProgramIndex: VerifyProgramIndex = verifyIndex;
export const verifyModuleBodies: VerifyModuleBodies = verifyModule;
export const instantiate: Instantiate = instantiateArtifact;
