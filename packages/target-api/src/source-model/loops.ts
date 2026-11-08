import type { Node } from "@tsonic/tsts";

export interface SourceNodeCountedLoop {
  readonly statement: Node;
  readonly counterDeclaration: Node;
  readonly start: Node;
  readonly bound: Node;
  readonly body: Node;
  readonly direction: "ascending";
  readonly comparison: "exclusive-upper-bound";
  readonly step: 1;
}
