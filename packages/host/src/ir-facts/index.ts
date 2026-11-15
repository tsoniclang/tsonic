import type {
  ParseCallGraph, ParseFacts, ParseMetadata, ParseSummary, PrintCallGraph, PrintFacts, PrintMetadata, PrintSummary,
  VerifyCallGraph, VerifyFacts, VerifyLiveness, VerifyMetadata, VerifySummary, SummaryIdentity, PrintObservations, ParseObservations, VerifyObservations,
} from "./contract.js";
import { parseCallGraph as readCallGraph, parseFacts as readFacts, parseMetadata as readMetadata, parseObservations as readObservations, parseSummary as readSummary } from "./parse.js";
import { printCallGraph as writeCallGraph, printFacts as writeFacts, printMetadata as writeMetadata, printObservations as writeObservations, printSummary as writeSummary } from "./print.js";
import { verifyCallGraph as checkCallGraph } from "./verify-call-graph.js";
import { verifyFacts as checkFacts } from "./verify-facts.js";
import { verifyLiveness as checkLiveness } from "./verify-liveness.js";
import { verifyMetadata as checkMetadata } from "./verify-metadata.js";
import { verifySummary as checkSummary } from "./verify-summary.js";
import { summaryKey as identifySummary } from "./summary-key.js";
import { verifyObservations as checkObservations } from "./verify-observations.js";
import { conditionAnd as andConditions, conditionOr as orConditions, conditionEquals as equalConditions, conditionSubstitute as substituteConditions } from "./conditions.js";
import type { ConditionAnd, ConditionOr, ConditionEquals, ConditionSubstitute } from "./contract.js";
import type { ApplySummary, SummaryEquals } from "./contract.js";
import { applySummary as apply } from "./apply-summary.js";
import { summaryEquals as equalSummaries } from "./summary-equals.js";

export const conditionAnd: ConditionAnd = andConditions;
export const conditionOr: ConditionOr = orConditions;
export const conditionEquals: ConditionEquals = equalConditions;
export const conditionSubstitute: ConditionSubstitute = substituteConditions;

export const printFacts: PrintFacts = writeFacts;
export const parseFacts: ParseFacts = readFacts;
export const verifyFacts: VerifyFacts = checkFacts;
export const verifyLiveness: VerifyLiveness = checkLiveness;
export const printObservations: PrintObservations = writeObservations;
export const parseObservations: ParseObservations = readObservations;
export const verifyObservations: VerifyObservations = checkObservations;
export const printSummary: PrintSummary = writeSummary;
export const parseSummary: ParseSummary = readSummary;
export const verifySummary: VerifySummary = checkSummary;
export const summaryKey: SummaryIdentity = identifySummary;
export const applySummary: ApplySummary = apply;
export const summaryEquals: SummaryEquals = equalSummaries;
export const printMetadata: PrintMetadata = writeMetadata;
export const parseMetadata: ParseMetadata = readMetadata;
export const verifyMetadata: VerifyMetadata = checkMetadata;
export const printCallGraph: PrintCallGraph = writeCallGraph;
export const parseCallGraph: ParseCallGraph = readCallGraph;
export const verifyCallGraph: VerifyCallGraph = checkCallGraph;
