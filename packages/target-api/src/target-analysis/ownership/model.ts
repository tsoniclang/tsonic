import type { Node, Type } from "@tsonic/tsts";
import type { SourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";
import type { ResolvedSourceCallInfo } from "../../source-semantics/call-result-selection.js";
import type { SourceTypeArgumentBinding } from "../../source-semantics/type-arguments.js";
import type { SourceStorageBudget } from "../source-storage/model/resource-budget.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings } from "../source-storage/model/types.js";

export interface SourceOwnershipUnresolved {
  readonly kind: "unresolved";
  readonly at: Node;
  readonly reason: string;
}

export type SourceCallableRetentionSelection = SourceOwnershipUnresolved | {
  readonly kind: "resolved";
  readonly retention: "scoped" | "retained";
  readonly witnesses: readonly Node[];
};

export interface SourceOwnershipContractEvidence {
  readonly contractDeclaration: Node;
  readonly checkedType: Type;
}

export type SourceFormalBorrowRegion =
  | { readonly kind: "type-argument"; readonly binding: SourceTypeArgumentBinding; readonly declaration: Node }
  | { readonly kind: "input-duration"; readonly parameter: Node };

export type SourceRetentionPremise = SourceOwnershipContractEvidence & (
  | { readonly kind: "retained"; readonly value: SourceStorageSubject;
      readonly reason: "owned-value" | "module-owner" }
  | { readonly kind: "retained"; readonly value: SourceStorageSubject;
      readonly reason: "retained-owner"; readonly owner: SourceStorageSubject }
  | { readonly kind: "transferred"; readonly value: SourceStorageSubject; readonly operation: Node }
  | { readonly kind: "scoped-borrowed"; readonly value: SourceStorageSubject;
      readonly owner: SourceStorageSubject; readonly region: Node; readonly mode: "shared" | "mutable" }
  | { readonly kind: "formal-borrowed"; readonly value: SourceStorageSubject;
      readonly executionOwner: Node; readonly region: SourceFormalBorrowRegion; readonly mode: "shared" | "mutable" }
);

export type SourceRetentionSelection =
  | { readonly kind: "resolved"; readonly premises: readonly SourceRetentionPremise[] }
  | SourceOwnershipUnresolved;

export type SourceSuspensionSelection =
  | (SourceOwnershipContractEvidence & { readonly kind: "never" | "may-suspend"; readonly value: SourceStorageSubject })
  | SourceOwnershipUnresolved;

export type SourceAsyncCompletionSelection =
  | { readonly kind: "not-async" }
  | (SourceOwnershipContractEvidence & { readonly kind: "async";
      readonly resultPolicy: "must-observe" | "observe-rejection" })
  | SourceOwnershipUnresolved;

export interface SourceOwnershipPremises {
  completionFor(call: Node, selected: ResolvedSourceCallInfo,
    bindings: SourceStorageBindings): SourceAsyncCompletionSelection;
  retentionFor(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceRetentionSelection | undefined;
  suspensionFor(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceSuspensionSelection | undefined;
}

export interface SourcePendingOperation {
  readonly operation: Node;
  readonly expression: Node;
  readonly bindings: SourceStorageBindings;
  readonly contracts: readonly (SourceOwnershipContractEvidence & { readonly value: SourceStorageSubject })[];
}

export interface SourceContinuationDependency {
  readonly candidate: Node;
  readonly reference: Node;
  readonly actual: SourceStorageSubject;
  readonly suspension: SourcePendingOperation;
  readonly retention: SourceRetentionPremise;
}

export type SourceAsyncResultDisposition =
  | (Extract<SourceExpressionResultDisposition, { readonly kind: "awaited-in-scope" }> & { readonly region: Node })
  | Exclude<SourceExpressionResultDisposition, { readonly kind: "awaited-in-scope" }>;

export interface SourceAsyncOwnershipDiagnostic {
  readonly code: "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED" | "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES";
  readonly at: Node;
  readonly message: string;
}

export type SourceAsyncOwnershipSelection =
  | { readonly kind: "not-async" }
  | ({ readonly kind: "resolved"; readonly call: Node; readonly disposition: SourceAsyncResultDisposition;
      readonly dependencies: readonly SourceContinuationDependency[] } & (
        | { readonly decision: "admitted" | "observe-discarded-rejection"; readonly diagnostic?: never }
        | { readonly decision: "rejected"; readonly diagnostic: SourceAsyncOwnershipDiagnostic }
      ))
  | SourceOwnershipUnresolved;

export type SourceOwnershipBudget = Pick<SourceStorageBudget, "step" | "createRows" | "failure">;

export type SourceRetentionReadSelection =
  | { readonly kind: "resolved"; readonly reference: Node; readonly premises: readonly SourceRetentionPremise[] }
  | SourceOwnershipUnresolved;

export interface SourceRetentionQueries {
  forReference(reference: Node, bindings: SourceStorageBindings): SourceRetentionReadSelection;
}

export type SourceContinuationDependenciesSelection =
  | { readonly kind: "resolved"; readonly dependencies: readonly SourceContinuationDependency[] }
  | SourceOwnershipUnresolved;

export type SourcePendingSelection =
  | { readonly kind: "never" }
  | { readonly kind: "resolved"; readonly pending: SourcePendingOperation }
  | SourceOwnershipUnresolved;
