import type {
  ParseCallGraph, ParseFacts, ParseObservations, PrintObservations, VerifyObservations, ParseMetadata, ParseSummary, PrintCallGraph, PrintFacts, PrintMetadata, PrintSummary,
  VerifyCallGraph, VerifyFacts, VerifyLiveness, VerifyMetadata, VerifySummary,
} from "./contract.js";
import { parseCallGraph as readCallGraph, parseFacts as readFacts, parseObservations as readObservations, parseMetadata as readMetadata, parseSummary as readSummary } from "./parse.js";
import { printCallGraph as writeCallGraph, printFacts as writeFacts, printObservations as writeObservations, printMetadata as writeMetadata, printSummary as writeSummary } from "./print.js";
import { verifyCallGraph as checkCallGraph } from "./verify-call-graph.js";
import { verifyFacts as checkFacts, verifyLiveness as checkLiveness } from "./verify-facts.js";
import { verifyMetadata as checkMetadata } from "./verify-metadata.js";
import { verifySummary as checkSummary } from "./verify-summary.js";

import { verifyObservations as checkObservations } from "./verify-observations.js";

export const printObservations: PrintObservations = writeObservations;
export const parseObservations: ParseObservations = readObservations;
export const verifyObservations: VerifyObservations = checkObservations;
export const printFacts: PrintFacts = writeFacts;
export const parseFacts: ParseFacts = readFacts;
export const verifyFacts: VerifyFacts = checkFacts;
export const verifyLiveness: VerifyLiveness = checkLiveness;
export const printSummary: PrintSummary = writeSummary;
export const parseSummary: ParseSummary = readSummary;
export const verifySummary: VerifySummary = checkSummary;
export const printMetadata: PrintMetadata = writeMetadata;
export const parseMetadata: ParseMetadata = readMetadata;
export const verifyMetadata: VerifyMetadata = checkMetadata;
export const printCallGraph: PrintCallGraph = writeCallGraph;
export const parseCallGraph: ParseCallGraph = readCallGraph;
export const verifyCallGraph: VerifyCallGraph = checkCallGraph;
