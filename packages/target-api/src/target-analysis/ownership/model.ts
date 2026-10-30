import type { Node, Type } from "@tsonic/tsts";
import type { SourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";
import type { ResolvedSourceCallInfo } from "../../source-semantics/call-result-selection.js";
import type { SourceTypeArgumentBinding } from "../../source-semantics/type-arguments.js";
import type { SourceStorageBudget } from "../source-storage/model/resource-budget.js";
import type { SourceStorageSubject } from "../source-storage/model/subjects.js";
import type { SourceStorageBindings } from "../source-storage/model/types.js";
import type { SourceTypeComponentEvidence } from "../../source-semantics/types.js";
import type { SourceDeclarationFlowExecutionRegion } from "../flow/model.js";
import type { SourceFlowLimits } from "../flow/model.js";

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
      readonly resultPolicy: "must-observe" | "native-discard" | "observe-rejection" })
  | SourceOwnershipUnresolved;

export interface SourceOwnershipPremises {
  completionFor(call: Node, selected: ResolvedSourceCallInfo,
    bindings: SourceStorageBindings): SourceAsyncCompletionSelection;
  retentionFor(request:
    | { readonly kind: "origin"; readonly value: SourceStorageSubject; readonly bindings: SourceStorageBindings }
    | { readonly kind: "read-value"; readonly reference: Node; readonly value: SourceStorageSubject;
        readonly bindings: SourceStorageBindings }): SourceRetentionSelection | undefined;
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
        | { readonly decision: "admitted" | "discard-native-result" | "observe-discarded-rejection"; readonly diagnostic?: never }
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

export type SourceDeclarationOwnershipCause =
  | { readonly kind: "required-fact" }
  | { readonly kind: "invalid-input" }
  | { readonly kind: "resource-limit"; readonly subject: Node;
      readonly category: "step" | "row" | keyof SourceFlowLimits; readonly limit: number };

export interface SourceDeclarationOwnershipUnresolved {
  readonly kind: "unresolved";
  readonly at: Node;
  readonly reason: string;
  readonly cause: SourceDeclarationOwnershipCause;
}

export type SourceDeclarationOwnershipContract =
  | { readonly kind: "declaration"; readonly declaration: Node; readonly component: SourceTypeComponentEvidence }
  | { readonly kind: "expression"; readonly expression: Node; readonly component: SourceTypeComponentEvidence };

export interface SourceDeclarationOwnershipEvidence {
  readonly contract: SourceDeclarationOwnershipContract;
}

export interface SourceDeclarationOwnershipValue {
  readonly node: Node;
  readonly component: SourceTypeComponentEvidence;
  readonly region: SourceDeclarationFlowExecutionRegion;
}

export type SourceDeclarationRetentionPremise = SourceDeclarationOwnershipEvidence & (
  | { readonly kind: "retained"; readonly value: SourceDeclarationOwnershipValue;
      readonly reason: "owned-value" | "module-owner" }
  | { readonly kind: "retained"; readonly value: SourceDeclarationOwnershipValue;
      readonly reason: "retained-owner"; readonly owner: SourceDeclarationOwnershipValue }
  | { readonly kind: "transferred"; readonly value: SourceDeclarationOwnershipValue; readonly operation: Node }
  | { readonly kind: "scoped-borrowed"; readonly value: SourceDeclarationOwnershipValue;
      readonly owner: SourceDeclarationOwnershipValue; readonly region: Node; readonly mode: "shared" | "mutable" }
  | { readonly kind: "formal-borrowed"; readonly value: SourceDeclarationOwnershipValue;
      readonly executionOwner: Node; readonly region: SourceFormalBorrowRegion; readonly mode: "shared" | "mutable" }
);

export type SourceDeclarationRetentionSelection =
  | { readonly kind: "resolved"; readonly premises: readonly SourceDeclarationRetentionPremise[] }
  | SourceDeclarationOwnershipUnresolved;

export type SourceDeclarationSuspensionSelection =
  | (SourceDeclarationOwnershipEvidence & {
      readonly kind: "never" | "may-suspend"; readonly value: SourceDeclarationOwnershipValue })
  | SourceDeclarationOwnershipUnresolved;

export type SourceDeclarationAsyncCompletionSelection =
  | { readonly kind: "not-async" }
  | (SourceDeclarationOwnershipEvidence & { readonly kind: "async";
      readonly resultPolicy: "must-observe" | "native-discard" | "observe-rejection" })
  | SourceDeclarationOwnershipUnresolved;

export interface SourceDeclarationOwnershipPremises {
  completionFor(call: Node, selected: ResolvedSourceCallInfo): SourceDeclarationAsyncCompletionSelection;
  retentionFor(request:
    | { readonly kind: "value"; readonly value: SourceDeclarationOwnershipValue }
    | { readonly kind: "read-value"; readonly reference: Node; readonly value: SourceDeclarationOwnershipValue }
  ): SourceDeclarationRetentionSelection | undefined;
  suspensionFor(value: SourceDeclarationOwnershipValue): SourceDeclarationSuspensionSelection | undefined;
}

export interface SourceDeclarationPendingOperation {
  readonly operation: Node;
  readonly expression: Node;
  readonly region: SourceDeclarationFlowExecutionRegion;
  readonly contracts: readonly (SourceDeclarationOwnershipEvidence & { readonly value: SourceDeclarationOwnershipValue })[];
}

export interface SourceDeclarationContinuationDependency {
  readonly candidate: Node;
  readonly reference: Node;
  readonly actual: SourceDeclarationOwnershipValue;
  readonly suspension: SourceDeclarationPendingOperation;
  readonly retention: SourceDeclarationRetentionPremise;
}

export type SourceDeclarationContinuationSelection =
  | { readonly kind: "resolved"; readonly dependencies: readonly SourceDeclarationContinuationDependency[] }
  | SourceDeclarationOwnershipUnresolved;

export type SourceDeclarationRetentionReadSelection =
  | { readonly kind: "resolved"; readonly reference: Node; readonly premises: readonly SourceDeclarationRetentionPremise[] }
  | SourceDeclarationOwnershipUnresolved;

export type SourceDeclarationPendingSelection =
  | { readonly kind: "never" }
  | { readonly kind: "resolved"; readonly pending: SourceDeclarationPendingOperation }
  | SourceDeclarationOwnershipUnresolved;

export type SourceDeclarationAsyncResultDisposition =
  | (Extract<SourceExpressionResultDisposition, { readonly kind: "awaited-in-scope" }> & {
      readonly region: SourceDeclarationFlowExecutionRegion })
  | Exclude<SourceExpressionResultDisposition, { readonly kind: "awaited-in-scope" }>;

export type SourceDeclarationAsyncOwnershipSelection =
  | { readonly kind: "not-async" }
  | ({ readonly kind: "resolved"; readonly call: Node; readonly disposition: SourceDeclarationAsyncResultDisposition;
      readonly dependencies: readonly SourceDeclarationContinuationDependency[] } & (
        | { readonly decision: "admitted" | "discard-native-result" | "observe-discarded-rejection";
            readonly diagnostic?: never }
        | { readonly decision: "rejected"; readonly diagnostic: SourceAsyncOwnershipDiagnostic }
      ))
  | SourceDeclarationOwnershipUnresolved;

export interface SourceDeclarationOwnershipRows {
  add(cost: number): boolean;
  release(): void;
}

export interface SourceDeclarationOwnershipBudget {
  step(subject: Node): boolean;
  createRows(subject: Node): SourceDeclarationOwnershipRows;
  failure(): SourceDeclarationOwnershipUnresolved | undefined;
}

export interface SourceDeclarationOwnershipValues {
  forNode(node: Node): SourceDeclarationOwnershipValue | SourceDeclarationOwnershipUnresolved;
  regionFor(node: Node): SourceDeclarationFlowExecutionRegion | SourceDeclarationOwnershipUnresolved;
  owns(value: SourceDeclarationOwnershipValue): boolean;
}
