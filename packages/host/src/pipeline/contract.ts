import type { Result } from "../diag/contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { HostProgram, InstantiationLimits } from "../ir-program/contract.js";
import type { AnalysisLimits } from "../ir-facts/contract.js";
import type { QueryLimits } from "../query/contract.js";
import type { ImportPreparation, PackageSnapshot, ProjectSnapshot } from "../snapshot/contract.js";
import type { CheckerExtensions, NavigationCaptureLimits, PreparationDeps } from "../front/contract.js";
import type { InferenceLimits } from "../infer/contract.js";
import type { EvaluatorLimits } from "../evaluate/contract.js";
import type { DataflowLimits } from "../dataflow/contract.js";
import type { SummaryLimits } from "../summaries/contract.js";
import type { MetadataLimits } from "../metadata/contract.js";
import type { LowerMirLimits } from "../lower-mir/contract.js";
import type { MirVerificationLimits } from "../ir-mir/contract.js";

export type { CheckerExtensions } from "../front/contract.js";

export type SemanticCycleErrorData = DeclaredSignatureErrorData;

export interface CompilerLimits {
  readonly query: QueryLimits;
  readonly navigationCapture: NavigationCaptureLimits;
  readonly inference: InferenceLimits;
  readonly evaluation: EvaluatorLimits;
  readonly dataflow: DataflowLimits;
  readonly analyses: AnalysisLimits;
  readonly summaries: SummaryLimits;
  readonly metadata: MetadataLimits;
  readonly instantiation: InstantiationLimits;
  readonly lowering: LowerMirLimits;
  readonly mirVerification: MirVerificationLimits;
}

export type PrepareImports = (
  deps: PreparationDeps,
  packages: PackageSnapshot,
) => Result<ImportPreparation>;

export interface HostAnalysisInputs {
  readonly snapshot: ProjectSnapshot;
  readonly preparation: ImportPreparation;
  readonly extensions: CheckerExtensions;
  readonly limits: CompilerLimits;
}

export type HostAnalysisResult = Result<HostProgram>;
export type AnalyzeHostProgram = (inputs: HostAnalysisInputs) => HostAnalysisResult;
