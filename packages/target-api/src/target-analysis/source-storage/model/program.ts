import type { Node, ResolvedSourceFlowConditionInfo } from "@tsonic/tsts";
import type { SourceDeclaredSlot, SourceCallableRole, SourcePresence, SourceRefusal, SourceResult, SourceTypeBinding, SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { SourceProductionResult } from "../../../source-semantics/descriptor-contracts.js";
import type { SourceMemberInventoryQueries } from "../../../source-semantics/member-inventory.js";
import type { SourceMemberCorrespondenceProduction } from "../../../source-semantics/member-correspondence.js";
import type { TargetSourceProgram } from "../../../source-semantics/types.js";
import type { SourceLiteralDomain } from "../../../source-model/literals/domain.js";

export interface SourceStorageAnalysisInputs {
  readonly inventory: SourceMemberInventoryQueries;
  readonly objects: SourceMemberCorrespondenceProduction;
  readonly settle: <Value>(value: SourceProductionResult<Value>) => SourceResult<Value>;
  readonly callableHead: (declaration: Node, role: "body" | "signature", orderedBindings: readonly SourceTypeBinding[]) => SourceProductionResult<SourceTypeEvidence>;
  readonly declared: (declaration: Node, orderedBindings: readonly SourceTypeBinding[]) => SourceProductionResult<SourceDeclaredSlot>;
  readonly aggregate: (original: Node, values: readonly SourceTypeEvidence[]) => SourceResult<SourceTypeEvidence>;
  readonly literalDomain: (value: SourceTypeEvidence) => SourceLiteralDomain;
  readonly syntaxDomain: (original: Node) => SourceProductionResult<SourceLiteralDomain>;
  readonly flowConditions: (original: Node) => SourcePresence<ResolvedSourceFlowConditionInfo>;
  readonly enclosing: (original: Node | undefined, role: SourceCallableRole, visit: (node: Node) => boolean) => Node | undefined;
}

export interface SourceStorageProgram extends TargetSourceProgram {
  readonly program: TargetSourceProgram;
  readonly analysis: SourceStorageAnalysisInputs;
  readonly work: (original?: Node) => void;
}

export class SourceStorageRefusal extends Error {
  constructor(readonly refusal: SourceRefusal) {
    super(refusal.message);
  }
}

export class SourceStorageFailure extends Error {}

export function sourceStorageValue<Value>(result: SourceResult<Value>): Value {
  if (result.kind === "refused") throw new SourceStorageRefusal(result);
  return result.value;
}

export function sourceStorageOutcome<Arguments extends readonly unknown[], Value>(
  query: (...arguments_: Arguments) => Value,
): (...arguments_: Arguments) => Value | SourceRefusal | { readonly kind: "unresolved"; readonly reason: string } {
  return (...arguments_) => {
    try {
      return query(...arguments_);
    } catch (error) {
      if (error instanceof SourceStorageRefusal) return error.refusal;
      if (error instanceof SourceStorageFailure) return Object.freeze({ kind: "unresolved", reason: error.message });
      throw error;
    }
  };
}
