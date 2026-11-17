import type {
  ParseDependencyInventory, ParseFacts, ParseMetadata, ParseSummary, PrintDependencyInventory, PrintFacts, PrintMetadata, PrintSummary,
  VerifyDependencyInventory, VerifyFacts, VerifyLiveness, VerifyMetadata, VerifySummary, SummaryIdentity, PrintObservations, ParseObservations, VerifyObservations,
} from "./contract.js";
import { parseDependencyInventory as readInventory, parseFacts as readFacts, parseMetadata as readMetadata, parseObservations as readObservations, parseSummary as readSummary } from "./parse.js";
import { printDependencyInventory as writeInventory, printFacts as writeFacts, printMetadata as writeMetadata, printObservations as writeObservations, printSummary as writeSummary } from "./print.js";
import { verifyDependencyInventory as checkInventory } from "./verify-dependencies.js";
import { verifyFacts as checkFacts } from "./verify-facts.js";
import { verifyLiveness as checkLiveness } from "./verify-liveness.js";
import { verifyMetadata as checkMetadata } from "./verify-metadata.js";
import { verifySummary as checkSummary } from "./verify-summary.js";
import { admitSummaryIdentity as admitIdentity, summaryKey as identifySummary, summaryPositionKey as identifyPosition } from "./summary-key.js";
import { verifyObservations as checkObservations } from "./verify-observations.js";
import { conditionAnd as andConditions, conditionOr as orConditions, conditionEquals as equalConditions, conditionSubstitute as substituteConditions } from "./conditions.js";
import type { ConditionAnd, ConditionOr, ConditionEquals, ConditionSubstitute } from "./contract.js";
import type { ApplySummary, SummaryEquals } from "./contract.js";
import type { AdmitSummaryIdentity, EscapeTargetKey, SummaryPositionKey } from "./contract.js";
import { escapeTargetKey as identifyEscapeTarget } from "./escape-key.js";
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
export const summaryPositionKey: SummaryPositionKey = identifyPosition;
export const escapeTargetKey: EscapeTargetKey = identifyEscapeTarget;
export const admitSummaryIdentity: AdmitSummaryIdentity = admitIdentity;
export const applySummary: ApplySummary = apply;
export const summaryEquals: SummaryEquals = equalSummaries;
export const printMetadata: PrintMetadata = writeMetadata;
export const parseMetadata: ParseMetadata = readMetadata;
export const verifyMetadata: VerifyMetadata = checkMetadata;
export const printDependencyInventory: PrintDependencyInventory = writeInventory;
export const parseDependencyInventory: ParseDependencyInventory = readInventory;
export const verifyDependencyInventory: VerifyDependencyInventory = checkInventory;
