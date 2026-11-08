import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../../host-input/descriptor-input.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceNodeNavigationFacts } from "../../source-model/navigation.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder, SourceDescriptorReader } from "../descriptor-contracts.js";
import type { SourceMemberCorrespondenceProduction } from "../member-correspondence.js";
import type { SourceTypeFlowAnalysisContext } from "./types.js";

export interface SourceSemanticProduction {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly reader: SourceDescriptorReader;
  readonly objects: SourceMemberCorrespondenceProduction;
}

export interface SourceSyntaxProduction extends SourceSemanticProduction {
  readonly component: SourceInputComponent;
  readonly syntax: Node;
  readonly bindings: readonly SourceTypeBinding[];
}

export interface SourceCallableProduction extends SourceSemanticProduction {
  readonly navigation: SourceNodeNavigationFacts;
  value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  parameter(component: SourceInputComponent, declaration: Node | undefined, signature: SourceSignatureIdentity, index: number,
    bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  completion(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  observeSignature(signature: SourceSignatureIdentity, result: SourceTypeEvidence, bindings: readonly SourceTypeBinding[], root: Node): void;
}

export interface SourceDeclarationProduction extends SourceCallableProduction {
  readonly context: SourceTypeFlowAnalysisContext;
  callableHead(declaration: Node, role: "body" | "signature", bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  inferred(node: Node): SourceProductionResult<SourceTypeEvidence>;
  iteration(declaration: Node): SourceProductionResult<SourceTypeEvidence | undefined>;
  enumValue(component: SourceInputComponent, declaration: Node): SourceProductionResult<SourceTypeEvidence>;
}
