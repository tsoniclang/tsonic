import type { ArgumentPassingMode, AstReader, Node } from "@tsonic/tsts";
import type { SourceNodeUseSummary } from "../source-model/navigation.js";
import type { SourcePresence, SourceResult } from "../public/source/contracts.js";

export interface SourceBindingExposureQueries {
  argumentPassing(node: Node): SourceResult<SourcePresence<{ readonly mode: ArgumentPassingMode }>>;
  pointerOperation(node: Node): SourceResult<SourcePresence<{ readonly operation: string }>>;
}

export function sourceBindingHasMutableExposure(
  input: { readonly ast: AstReader; readonly protocols: SourceBindingExposureQueries },
  summary: SourceNodeUseSummary,
  enter: (node: Node) => boolean,
): SourceResult<boolean> {
  const resolved = (value: boolean): SourceResult<boolean> => Object.freeze({ kind: "resolved", value });
  for (const use of summary.uses) {
    if (!enter(use.reference)) return resolved(true);
    const visited = new Set<Node>();
    for (let node: Node | undefined = use.reference; node !== undefined; node = input.ast.parent(node)) {
      if (!enter(node) || visited.has(node)) return resolved(true);
      visited.add(node);
      const passing = input.protocols.argumentPassing(node);
      if (passing.kind === "refused") return passing;
      if (passing.value.kind === "present" && !immutablePassingModes.has(passing.value.value.mode)) return resolved(true);
      const pointer = input.protocols.pointerOperation(node);
      if (pointer.kind === "refused") return pointer;
      if (pointer.value.kind === "present" && pointer.value.value.operation === "address-of") return resolved(true);
      const kind = input.ast.kindName(node);
      if (kind.endsWith("Statement") || sourceBindingCallableKinds.has(kind)) break;
    }
  }
  return resolved(false);
}

export const sourceBindingCallableKinds: ReadonlySet<string> = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindConstructor", "KindGetAccessor", "KindSetAccessor"]);
const immutablePassingModes = new Set(["by-value", "byref-readonly", "borrow-shared"]);
