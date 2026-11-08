import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceApplication, SourceApplicationFacts, SourceDescriptorView, SourcePresence, SourceRefusal, SourceResult, SourceSignatureIdentity, SourceTypeEvidence, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceJsApiFacts } from "../target-analysis/source-profile.js";
import type { SourceAnalysisFacts } from "../target-analysis/source-protocols.js";
import type { SourceOriginSubjects } from "../source-semantics/member-inventory.js";
import type { SourcePointerFacts } from "../target-analysis/source-pointers.js";
import type { SourceMarkerFacts } from "../target-analysis/source-markers.js";
import type { SourceDescriptorInput } from "./descriptor-input.js";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";
import type { SourceInputDiagnosticIdentity } from "./call-input.js";
import type { SourceInputMemberUseSelection } from "./member-input.js";
import type { SourceInputProtocolQueries } from "./protocol-input.js";
import type { SourcePropertyNameFacts } from "./property-name-input.js";

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
  readonly storage: SourceAnalysisFacts["storage"];
  assertNode(node: Node): void;
  assertApplication(application: SourceApplication): void;
  originalComponent(value: SourceTypeEvidence): SourcePresence<SourceInputComponent>;
  sourceOriginSubjects(value: SourceTypeEvidence): SourceOriginSubjects;
  publish(component: SourceInputComponent, receiver?: SourceTypeEvidence): SourceResult<SourceTypeEvidence>;
  signature(original: SourceInputSignature): SourceSignatureIdentity;
  unavailable(node: Node, reason: string): SourceRefusal;
}

export interface SourceProgramInput {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly programSourceFiles: readonly SourceFile[];
  readonly inventory: SourceOriginalNodeInventory;
  readonly input: SourceDescriptorInput;
  readonly protocolInput: SourceInputProtocolQueries;
  navigation(production: SourceFactProduction): SourceNodeNavigationFacts;
  readonly propertyNames: SourcePropertyNameFacts;
  memberUse(occurrence: Node): SourceInputMemberUseSelection;
  profile(production: SourceFactProduction): SourcePresence<SourceJsApiFacts>;
  pointers(production: SourceFactProduction): SourcePointerFacts & SourceMarkerFacts;
  discharge(diagnostics: readonly SourceInputDiagnosticIdentity[]): void;
}
