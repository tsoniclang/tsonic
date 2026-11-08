import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceJsApiFactsFactory } from "../target-analysis/source-profile.js";
import type { SourceProfileDeclarationIdentity } from "../target-analysis/source-profile-identity.js";
import type { SourceDescriptorInput } from "./descriptor-input.js";
import type { SourceInputDiagnosticIdentity } from "./call-input.js";
import type { SourceInputMemberUseSelection } from "./member-input.js";
import type { SourceInputProtocolQueries } from "./protocol-input.js";
import type { SourceInputNodeNavigationQueries } from "./navigation-input.js";
import type { SourceInputCoreQueries } from "./core-input.js";
import type { SourcePropertyNameFacts } from "./property-name-input.js";

export interface SourceOriginalNodeInventory {
  readonly nodes: readonly Node[];
  contains(node: Node): boolean;
  nodesForFiles(files: readonly SourceFile[]): readonly Node[];
}

export interface SourceProgramInput {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly programSourceFiles: readonly SourceFile[];
  readonly inventory: SourceOriginalNodeInventory;
  readonly input: SourceDescriptorInput;
  readonly protocolInput: SourceInputProtocolQueries;
  readonly navigation: SourceInputNodeNavigationQueries;
  readonly propertyNames: SourcePropertyNameFacts;
  memberUse(occurrence: Node): SourceInputMemberUseSelection;
  profileDeclaration(occurrence: Node): SourcePresence<SourceProfileDeclarationIdentity>;
  readonly apiFacts: SourcePresence<SourceJsApiFactsFactory>;
  readonly core: SourceInputCoreQueries;
  discharge(diagnostics: readonly SourceInputDiagnosticIdentity[]): void;
}
