import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceDeclaredSlot, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import type { SourceCorrespondenceMember } from "./member-correspondence.js";

export interface SourceObjectProductionQueries {
  value(occurrence: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  place(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  declared(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceDeclaredSlot>;
  memberDestination(occurrence: Node, receiver: SourceTypeEvidence, member: SourceCorrespondenceMember): SourceProductionResult<SourceUseDestination>;
  memberValue(occurrence: Node, receiver: SourceTypeEvidence, purpose: "read" | "write",
    values: readonly SourceTypeEvidence[], optionalChain: boolean): SourceProductionResult<SourceTypeEvidence>;
}
