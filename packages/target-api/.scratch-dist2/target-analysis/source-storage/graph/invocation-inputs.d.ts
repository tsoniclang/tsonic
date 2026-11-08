import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceNavigationCall, SourceNavigationCallBinding } from "../../../source-model/navigation-records.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorSignature } from "../../../source-semantics/descriptor-model.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageArgumentTransport, SourceStorageCallbackEntry, SourceStorageCallableInputSlot, SourceStorageInvocationInputSlots } from "../model/types.js";
import type { SourceStorageClassValue } from "../model/construction.js";
import type { SourceStorageAccessorInvocation } from "./scoped-model.js";
import type { SourceArgumentCorrespondence } from "../../../public/source/selections.js";
/**
 * The call witness row of a published argument correspondence of the same call (one row per effective position).
 * undefined: the correspondence does not belong to this call witness.
 */
export declare function sourceStorageWitnessBinding(selected: SourceNavigationCall, binding: SourceArgumentCorrespondence): SourceNavigationCallBinding | undefined;
/**
 * The Host descriptor of the parameter a binding fills at a call: the instantiated parameter of the Host call selection,
 * else the declared parameter type. undefined when the Host refused it.
 */
export declare function sourceStorageBindingParameterType(source: SourceAnalysisProgram, selected: SourceNavigationCall, binding: SourceNavigationCallBinding): SourceTypeDescriptor | undefined;
/**
 * The Host descriptor of the value a binding supplies: the argument's type for a value argument; for a spread, the
 * tuple element (spread-element) or the array element (spread-sequence) of the spread operand's type.
 */
export declare function sourceStorageBindingArgumentType(source: SourceAnalysisProgram, selected: SourceNavigationCall, binding: SourceNavigationCallBinding): SourceTypeDescriptor | undefined;
export declare function sourceStorageInvocationActual(source: SourceAnalysisProgram, selected: SourceNavigationCall, binding: SourceNavigationCallBinding, subject: SourceStorageSubjectQuery, subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined): {
    readonly subject: SourceStorageSubject;
    readonly sourceType: SourceTypeDescriptor | undefined;
    readonly targetType: SourceTypeDescriptor | undefined;
} | undefined;
export declare function sourceStorageInvocationArgumentAbsence(source: SourceAnalysisProgram, selected: SourceNavigationCall, binding: SourceNavigationCallBinding): "absent" | "present" | "possible";
/** The selected signature declaration of a call or the callable's own declaration (source implementation). */
type SourceStorageCallableInputEvidence = {
    readonly kind: "selected-signature";
    readonly signature: Node;
    readonly use: Node | undefined;
} | {
    readonly kind: "source-implementation";
    readonly signature: Node | undefined;
};
export declare function sourceStorageCallableInputSlots(source: SourceAnalysisProgram, declaration: Node, evidence: SourceStorageCallableInputEvidence, step: () => boolean): readonly SourceStorageCallableInputSlot[] | undefined;
export type SourceStorageInvocationSelectionKey = Node | SourceStorageCallbackEntry | SourceStorageAccessorInvocation;
export type SourceStorageInvocationInputSelectionQuery = (declaration: Node, invocation: Node | undefined, callback?: SourceStorageCallbackEntry) => SourceStorageInvocationInputSlots | undefined;
export declare function sourceStorageSelectedInputSlots(selection: SourceStorageInvocationInputSlots | undefined, declaration: Node): readonly SourceStorageCallableInputSlot[] | undefined;
/**
 * The callable signature a native callback argument is invoked with: the single call signature of the present
 * instantiated parameter type of the callback binding. undefined when there is not exactly one.
 */
export declare function sourceStorageCallbackSignature(entry: SourceStorageCallbackEntry): SourceTypeDescriptorSignature | undefined;
export declare function sourceStorageInvocationInputSelection(source: SourceAnalysisProgram, key: SourceStorageInvocationSelectionKey, nodes: ReadonlySet<Node>, exact: boolean, step: () => boolean, retain: (cost: number) => boolean, read: (declaration: Node) => SourceStorageInvocationInputSlots | undefined): SourceStorageInvocationInputSlots | undefined;
export interface SourceStorageNativeInputSlot {
    readonly parameterIndex: number;
    readonly type: SourceTypeDescriptor | undefined;
    readonly absent: boolean;
    readonly acceptsOmission: boolean;
    readonly projection: readonly SourceStorageProjection[];
}
/** The native callback parameters a formal of the callback implementation receives (callback signature descriptors). */
export declare function sourceStorageNativeInputSlots(source: SourceAnalysisProgram, declaration: Node, formal: SourceStorageSubject, selection: SourceStorageInvocationInputSlots | undefined, step: () => boolean): readonly SourceStorageNativeInputSlot[] | undefined;
export declare function sourceStorageNativeCallablePayloads<Bindings>(source: SourceAnalysisProgram, budget: SourceStorageBudget, invocation: Node, bindings: Bindings, queries: {
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    valuesFor(subject: SourceStorageSubject, bindings: Bindings): {
        readonly values: readonly SourceStorageClassValue<Bindings>[];
        readonly complete: boolean;
    } | undefined;
    componentFor(value: SourceStorageClassValue<Bindings>, component: SourceStorageProjection): SourceStorageSubject | undefined;
    componentsFor(value: SourceStorageSubject): readonly SourceStorageProjection[] | undefined;
    callbackEntriesFor(invocation: Node): readonly SourceStorageCallbackEntry[];
    hasOnlySourceImplementations(invocation: Node): boolean;
}): {
    readonly values: readonly SourceStorageClassValue<Bindings>[];
    readonly uncertain: readonly SourceStorageClassValue<Bindings>[];
    readonly complete: boolean;
} | undefined;
export interface SourceStorageInvocationInputs {
    readonly subjects: ReadonlySet<SourceStorageSubject>;
    readonly context: "caller" | "callee";
    readonly omitted: boolean;
    readonly calleeSubjects?: readonly SourceStorageSubject[];
}
export type SourceStorageInvocationInputQuery = (formal: SourceStorageSubject, candidate: Node, invocation: Node, callback?: SourceStorageCallbackEntry) => SourceStorageInvocationInputs;
export declare function createSourceStorageInvocationOrigins(source: SourceAnalysisProgram, budget: SourceStorageBudget, queries: {
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly inputSlotsFor: SourceStorageInvocationInputSelectionQuery;
    incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
    isUnresolved(invocation: Node): boolean;
}): (origin: SourceStorageSubject, candidate: Node, invocation: Node) => ReadonlySet<SourceStorageSubject> | undefined;
export declare function createSourceStorageInvocationInputs(source: SourceAnalysisProgram, budget: SourceStorageBudget, subject: SourceStorageSubjectQuery, subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined, accessorTargets: ReadonlyMap<Node, readonly SourceStorageAccessorInvocation[]>, isUnresolved: (invocation: Node) => boolean, rejectionOriginsFor: (receiver: Node, formal: SourceStorageSubject) => readonly SourceStorageSubject[] | undefined, inputSlotsFor: SourceStorageInvocationInputSelectionQuery, argumentTransports: ReadonlyMap<Node, readonly SourceStorageArgumentTransport[]>): SourceStorageInvocationInputQuery;
export {};
//# sourceMappingURL=invocation-inputs.d.ts.map