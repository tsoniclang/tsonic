import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceAdmissionFacts, SourceApplicationFacts, SourceDescriptorView, SourceEnumFacts, SourceIntegerFacts, SourceNavigationFacts, SourcePresence, SourcePropertyName, SourceRefusal, SourceResult, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "./navigation.js";
import type { SourceMemoryQueries } from "./memory.js";
import type { SourceJsApiFacts } from "./profile.js";
import type { SourceMemberCorrespondenceQueries } from "./members.js";
import type { SourceMemberUse } from "./member-use.js";
import type { SourcePointerFacts } from "./pointers.js";
import type { SourceMarkerFacts } from "./markers.js";
import type { SourceSafetyFacts } from "./safety.js";
import type { SourceAttributeFacts } from "./attributes.js";
import type { SourceControlFlowQueries } from "./control-flow.js";
import type { SourceIteration, SourceGenerator, SourceYield, SourceCallableCompletion, SourceStoragePlace, SourceArgumentPassing } from "./protocols.js";
import type { SourceResourceManagement } from "./resources.js";
import type { SourceStorageAnalysisOptions, SourceStorageSubject, SourceStorageBoundary, SourceStorageBindings, SourceStorageProjection, SourceStorageSubjectSelection, SourceStorageWriteSelection, SourceStorageMemberWritesSelection, SourceStorageFormalMemberWriteDemandSelection, SourceStorageTypeSelection, SourceStorageSubjectsSelection, SourceStorageOriginsSelection, SourceStorageClosedOriginsSelection, SourceStorageProducersSelection, SourceStorageNodesSelection, SourceStorageArgumentTransport, SourceStorageImplementationsSelection, SourceStorageBindingsSelection, SourceStorageProducer, SourceStorageUnresolved, SourceStorageActivationsSelection, SourceStorageArgumentsSelection, SourceStorageValueFrontierSelection, SourceStorageConstructionSelection, SourceStorageInstanceRegionsSelection } from "./storage.js";

export interface SourceDocument {
  readonly identity: string;
  readonly fileName: string;
  readonly text: string;
  readonly sourceFile: SourceFile;
}

export interface SourceAuthoredOccurrence {
  readonly kind: "authored";
  readonly document: SourceDocument;
  readonly start: number;
  readonly end: number;
  readonly syntaxKind: string;
}

export interface SourceSyntheticOccurrence {
  readonly kind: "synthetic";
  readonly syntaxKind: string;
}

export type SourceOccurrence = SourceAuthoredOccurrence | SourceSyntheticOccurrence;

export type SourceOccurrenceLookup =
  | { readonly kind: "available"; readonly node: Node }
  | { readonly kind: "foreign-document" }
  | { readonly kind: "missing" }
  | { readonly kind: "ambiguous"; readonly matchCount: number };

export interface SourceProgramDocuments {
  readonly all: readonly SourceDocument[];
  includes(document: SourceDocument): boolean;
  forFile(sourceFile: SourceFile): SourceDocument;
  forNode(node: Node): SourceDocument;
  occurrenceFor(node: Node): SourceOccurrence;
  lookupAuthored(occurrence: SourceAuthoredOccurrence): SourceOccurrenceLookup;
}

export interface SourceObjectFacts extends SourceMemberCorrespondenceQueries {
  use(occurrence: Node): SourceResult<SourceMemberUse>;
  propertyName(name: Node): SourceResult<SourcePropertyName>;
}

export interface SourceProgramFacts {
  readonly admission: SourceAdmissionFacts;
  readonly descriptors: SourceDescriptorView;
  readonly values: SourceValueFacts;
  readonly applications: SourceApplicationFacts;
  readonly integers: SourceIntegerFacts;
  readonly enums: SourceEnumFacts;
  readonly navigation: SourceNavigationFacts & SourceNodeNavigationFacts;
  readonly objects: SourceObjectFacts;
  readonly profile: SourcePresence<SourceJsApiFacts>;
  readonly protocols: SourceAnalysisFacts;
  refusals(): readonly SourceRefusal[];
}

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly facts: SourceProgramFacts;
}

export interface SourceAnalysisFacts extends SourcePointerFacts, SourceMarkerFacts, SourceSafetyFacts, SourceAttributeFacts {
  readonly controlFlow: SourceControlFlowQueries;
  storageAnalysis(options: SourceStorageAnalysisOptions): SourceStorageAnalysisSelection;
  iteration(occurrence: Node): SourceResult<SourcePresence<SourceIteration>>;
  generator(declaration: Node): SourceResult<SourcePresence<SourceGenerator>>;
  yield(occurrence: Node): SourceResult<SourcePresence<SourceYield>>;
  resourceManagement(declaration: Node): SourceResult<SourcePresence<SourceResourceManagement>>;
  callableCompletion(declaration: Node): SourceResult<SourcePresence<SourceCallableCompletion>>;
  storage(occurrence: Node): SourceResult<SourcePresence<SourceStoragePlace>>;
  argumentPassing(occurrence: Node): SourceResult<SourcePresence<SourceArgumentPassing>>;
}

export interface SourceStorageQueries {
  readonly memory: SourceMemoryQueries;
  readonly source: TargetSourceProgram;
  readonly sourceFiles: readonly SourceFile[];
  readonly nodes: readonly Node[];
  readonly subjects: readonly SourceStorageSubject[];
  readonly boundaries: readonly SourceStorageBoundary[];
  readonly invocations: readonly Node[];
  readonly accessorInvocations: readonly Node[];
  readonly emptyBindings: SourceStorageBindings;
  failureReason(): string | undefined;
  subject(node: Node, kind?: SourceStorageSubject["kind"], projection?: readonly SourceStorageProjection[]): SourceStorageSubjectSelection;
  subjectFor(node: Node): SourceStorageSubjectSelection;
  memberSubjectFor(node: Node): SourceStorageSubjectSelection;
  storageSubjectFor(node: Node, projection?: readonly SourceStorageProjection[]): SourceStorageSubjectSelection;
  writeAt(reference: Node, bindings: SourceStorageBindings): SourceStorageWriteSelection;
  memberWritesFor(subject: SourceStorageSubject): SourceStorageMemberWritesSelection;
  formalMemberWriteDemand(declaration: Node, parameter: Node): SourceStorageFormalMemberWriteDemandSelection;
  sealFormalMemberWriteDemands(): void;
  typeFor(subject: SourceStorageSubject): SourceStorageTypeSelection;
  incomingFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  ancestorsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originSubjectsFor(subject: SourceStorageSubject): SourceStorageSubjectsSelection;
  originsFor(subject: SourceStorageSubject): SourceStorageOriginsSelection;
  closedOriginsFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageClosedOriginsSelection;
  storageProducersFor(subject: SourceStorageSubject, bindings?: SourceStorageBindings): SourceStorageProducersSelection;
  localCallableCreationsFor(expression: Node): SourceStorageNodesSelection;
  unresolvedFor(subject: SourceStorageSubject): string | undefined;
  invocationImplementationsFor(invocation: Node, bindings?: SourceStorageBindings,
    callback?: SourceStorageArgumentTransport): SourceStorageImplementationsSelection;
  invocationOriginsFor(subject: SourceStorageSubject, candidate: Node, invocation: Node): SourceStorageSubjectsSelection;
  bindingsForDeclaration(declaration: Node, parent?: SourceStorageBindings): SourceStorageBindingsSelection;
  bindingsForLexicalOwner(node: Node): SourceStorageBindingsSelection;
  bindingsForInvocation(candidate: Node, invocation: Node, parent?: SourceStorageBindings,
    capture?: Pick<SourceStorageProducer, "subject" | "bindings">): SourceStorageBindingsSelection;
  invocationContextKeyFor(invocation: Node, bindings: SourceStorageBindings):
    { readonly kind: "resolved"; readonly key: string } | SourceStorageUnresolved;
  contextKeyFor(subjects: readonly SourceStorageSubject[], bindings: SourceStorageBindings):
    { readonly kind: "resolved"; readonly key: string } | SourceStorageUnresolved;
  boundOriginsFor(subject: SourceStorageSubject, bindings: SourceStorageBindings): SourceStorageSubjectsSelection;
  boundActivationsFor(declaration: Node, bindings: SourceStorageBindings): SourceStorageActivationsSelection;
  contributingExecutionsFor(subject: SourceStorageSubject, declaration: Node,
    entry: Pick<SourceStorageProducer, "subject" | "bindings">): SourceStorageProducersSelection;
  nativeCallbackArgumentsFor(invocation: Node): SourceStorageArgumentsSelection;
  boundValueFrontierFor(subject: SourceStorageSubject, bindings: SourceStorageBindings,
    boundaries: readonly SourceStorageSubject[], position?: "value" | "input"): SourceStorageValueFrontierSelection;
  invocationArgumentsFor(invocation: Node): SourceStorageNodesSelection;
  argumentTransportsFor(invocation: Node): SourceStorageArgumentsSelection;
  mutationOwnerFor(node: Node): SourceStorageSubject | undefined;
  isAccessorInvocation(node: Node): boolean;
  executionRegionsFor(candidate: Node, invocation?: Node, callerBindings?: SourceStorageBindings): SourceStorageNodesSelection;
  constructionFor(invocation: Node, callerBindings?: SourceStorageBindings): SourceStorageConstructionSelection;
  instanceRegionsFor(invocation: Node): SourceStorageInstanceRegionsSelection;
  enclosingRegionFor(node: Node): Node | undefined;
}

export type SourceStorageAnalysisSelection =
  | { readonly kind: "resolved"; readonly queries: SourceStorageQueries }
  | SourceStorageUnresolved;
