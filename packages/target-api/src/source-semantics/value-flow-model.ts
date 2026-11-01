import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceFileSemantics } from "./types.js";

export interface SourceValueFlowQueryContext {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly sourceFacts?: ReadonlySourceFactResolver;
  semanticsFor(node: Node): SourceFileSemantics;
}

export interface SourceNativeGuard<Predicate> {
  readonly sourceOperand: Node;
  readonly predicate: Predicate;
}
