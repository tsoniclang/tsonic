import type { AstReader, Node } from "@tsonic/tsts";
import { sourceBindingWriteAtReference } from "../../source-navigation/references-usage.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject } from "./subjects.js";

export function createSourceStorageStoredValues(ast: AstReader, budget: SourceStorageBudget) {
  const values = new Map<SourceStorageSubject, Set<SourceStorageSubject>>();
  const unresolved = new Map<SourceStorageSubject, string>();
  const record = (storage: SourceStorageSubject | undefined, value?: SourceStorageSubject): void => {
    if (storage === undefined || storage.kind !== "value" || storage.projection.length !== 0 ||
      !budget.step()) return;
    let selected = values.get(storage);
    if (selected === undefined) {
      const declaration = storage.node;
      if (ast.getSourceFile(declaration)?.IsDeclarationFile) return;
      if (!ast.is.IsVariableDeclaration(declaration) && !ast.is.IsPropertyDeclaration(declaration) &&
        !ast.is.IsPropertyAssignment(declaration) && !ast.is.IsShorthandPropertyAssignment(declaration)) return;
      for (let owner: Node | undefined = declaration; owner !== undefined && budget.step(); owner = ast.parent(owner)) {
        if (ast.hasModifierKind(owner, "ambient")) return;
        if (ast.is.IsSourceFile(owner)) break;
      }
      if (!budget.row()) return;
      selected = new Set();
      values.set(storage, selected);
    }
    if (value === undefined || selected.has(value) || !budget.row()) return;
    selected.add(value);
  };
  const writeFor = (reference: Node, subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined) => {
    const write = sourceBindingWriteAtReference(ast, reference);
    if (write === undefined) return undefined;
    if (write.kind === "update") return { value: subjectFor(write.operation) };
    if (write.kind !== "assignment") return { reason: "Source storage iteration writes require their exact selected element producer." };
    const binary = ast.as.AsBinaryExpression(write.operation);
    if (binary === undefined || subjectFor(binary.Left) !== subjectFor(reference))
      return { reason: "Source storage destructuring writes require their exact selected component producer." };
    const operator = ast.operatorKindName(write.operation);
    return { value: subjectFor(operator === "KindEqualsToken" || operator === "KindBarBarEqualsToken" ||
      operator === "KindAmpersandAmpersandEqualsToken" || operator === "KindQuestionQuestionEqualsToken"
      ? binary.Right : write.operation) };
  };
  const recordWrite = (storage: SourceStorageSubject | undefined, write: ReturnType<typeof writeFor>): void => {
    record(storage, write?.value);
    if (storage !== undefined && values.has(storage) && !unresolved.has(storage) && write?.reason !== undefined && budget.row())
      unresolved.set(storage, write.reason);
  };
  return Object.freeze({ record, recordWrite, writeFor,
    inputsFor: (storage: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined => values.get(storage),
    unresolvedFor: (storage: SourceStorageSubject): string | undefined => unresolved.get(storage) });
}
