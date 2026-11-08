import type { AstReader, Node, ResolvedSourceFlowConditionInfo } from "@tsonic/tsts";
import type { SourceDescriptorView, SourcePresence } from "../public/source/contracts.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceBindingExposureQueries } from "../source-navigation/binding-mutation-exposure.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";

export interface SourceGuardContext {
  readonly ast: AstReader;
  readonly navigation: SourceNodeNavigationFacts;
  readonly protocols: SourceBindingExposureQueries;
  readonly view: SourceDescriptorView;
  flowConditions(reference: Node): SourcePresence<ResolvedSourceFlowConditionInfo>;
  syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
}

export interface SourceGuard<Predicate> {
  readonly sourceOperand: Node;
  readonly predicate: Predicate;
}
