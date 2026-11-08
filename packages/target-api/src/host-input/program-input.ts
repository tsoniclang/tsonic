import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceApplication, SourceApplicationFacts, SourceDeclaredSlot, SourceDescriptorView, SourcePresence, SourcePropertyName, SourceRefusal, SourceResult, SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceJsApiFacts } from "../target-analysis/source-profile.js";
import type { SourceAnalysisFacts } from "../target-analysis/source-protocols.js";
import type { SourceProductionResult } from "../source-semantics/descriptor-contracts.js";
import type { SourceCorrespondenceMember } from "../source-semantics/member-correspondence.js";
import type { SourceObjectProduction } from "../source-semantics/member-use.js";
import type { SourceOriginSubjects } from "../source-semantics/member-inventory.js";
import type { SourceObjectFacts } from "../source-semantics/types.js";
import type { SourceDescriptorInput } from "./descriptor-input.js";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";
import type { SourceInputDiagnosticIdentity } from "./call-input.js";
import type { SourceInputMemberUseSelection } from "./member-input.js";
import type { SourceInputProtocolQueries } from "./protocol-input.js";

export type { SourceObjectProduction } from "../source-semantics/member-use.js";

export interface SourceOriginalNodeInventory {
  readonly nodes: readonly Node[];
  contains(node: Node): boolean;
  nodesForFiles(files: readonly SourceFile[]): readonly Node[];
}

export interface SourceFactProduction {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly inventory: SourceOriginalNodeInventory;
  readonly input: SourceDescriptorInput;
  readonly view: SourceDescriptorView;
  readonly values: SourceValueFacts;
  readonly applications: SourceApplicationFacts;
  readonly solvedProtocols: Pick<SourceAnalysisFacts, "iteration" | "generator" | "yield">;
  assertNode(node: Node): void;
  assertApplication(application: SourceApplication): void;
  originalComponent(value: SourceTypeEvidence): SourcePresence<SourceInputComponent>;
  sourceOriginSubjects(value: SourceTypeEvidence): SourceOriginSubjects;
  publish(component: SourceInputComponent, receiver?: SourceTypeEvidence): SourceResult<SourceTypeEvidence>;
  signature(original: SourceInputSignature): SourceSignatureIdentity;
  unavailable(node: Node, reason: string): SourceRefusal;
  literalDomain(node: Node): SourceResult<SourceLiteralDomain>;
  syntaxDomain(node: Node): SourceResult<SourceLiteralDomain>;
}

export interface SourceObjectProductionQueries {
  value(occurrence: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  declared(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceDeclaredSlot>;
  memberDestination(occurrence: Node, receiver: SourceTypeEvidence, member: SourceCorrespondenceMember): SourceProductionResult<SourceUseDestination>;
  memberValue(occurrence: Node, receiver: SourceTypeEvidence, purpose: "read" | "write",
    values: readonly SourceTypeEvidence[], optionalChain: boolean): SourceProductionResult<SourceTypeEvidence>;
}

export interface SourceProgramInput {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly programSourceFiles: readonly SourceFile[];
  readonly inventory: SourceOriginalNodeInventory;
  readonly input: SourceDescriptorInput;
  readonly protocolInput: SourceInputProtocolQueries;
  navigation(production: SourceFactProduction): SourceNodeNavigationFacts;
  propertyName(queries: {
    literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
    syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  }): (node: Node) => SourceProductionResult<SourcePropertyName>;
  memberUse(occurrence: Node): SourceInputMemberUseSelection;
  profile(production: SourceFactProduction): SourcePresence<SourceJsApiFacts>;
  protocols(production: SourceFactProduction, navigation: SourceNodeNavigationFacts, objects: SourceObjectFacts): SourceAnalysisFacts;
  discharge(diagnostics: readonly SourceInputDiagnosticIdentity[]): void;
}
