import type { Node, ResolvedSourceElementAccessInfo, ResolvedSourcePropertyAccessInfo } from "@tsonic/tsts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import { pointerFlowOperand, pointerFlowParent } from "./source-forms.js";

export type PointerContainerValues =
  | { readonly kind: "values"; readonly values: readonly Node[]; readonly includesUndefined: boolean }
  | { readonly kind: "unproven"; readonly reason: string };

export function createPointerContainerQueries(source: TargetSourceProgram, maximumValues: number) {
  const { ast, navigation, semantics } = source;
  const cached = new WeakMap<Node, PointerContainerValues>();
  return Object.freeze({ resolve });

  function resolve(access: Node): PointerContainerValues {
    const prior = cached.get(access);
    if (prior !== undefined) return prior;
    const result = inspect(access);
    cached.set(access, result);
    return result;
  }

  function inspect(access: Node): PointerContainerValues {
    const selection = selectedRead(access);
    const reject = (reason: string): PointerContainerValues => Object.freeze({ kind: "unproven", reason });
    if (selection === undefined) return reject("Pointer container access has no exact selected read.");
    const queue: Node[] = [selection.receiver.expression];
    const seen = new Set<Node>();
    const literals = new Set<Node>();
    const values = new Set<Node>();
    let includesUndefined = selection.optionalChain;
    let inspected = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (queue.length > maximumValues || ++inspected > maximumValues) return reject("Pointer container source-value budget exceeded.");
      const node = queue[cursor]!;
      if (seen.has(node)) continue;
      seen.add(node);
      const operand = pointerFlowOperand(ast, node);
      if (operand !== undefined) queue.push(operand);
      else if (ast.is.IsIdentifier(node)) {
        const declaration = navigation.sourceReferenceFor(node)?.declaration;
        if (declaration === undefined) return reject("Pointer container has no exact binding declaration.");
        queue.push(declaration);
      } else if (ast.is.IsVariableDeclaration(node)) {
        const initial = ast.as.AsVariableDeclaration(node)?.Initializer;
        const uses = navigation.declarationUseSummary(node);
        if (initial === undefined || uses.bindingWritten || uses.exported || !ast.is.IsIdentifier(ast.name(node))) {
          return reject("Pointer container bindings must have one unmodified non-exported origin.");
        }
        queue.push(initial);
        for (const use of uses.uses) {
          if (++inspected > maximumValues) return reject("Pointer container source-value budget exceeded.");
          if (use.kind === "type-only" || use.kind === "source-linkage") continue;
          const { value, parent } = pointerFlowParent(ast, use.reference);
          if (parent !== undefined && ast.is.IsVariableDeclaration(parent) &&
            ast.as.AsVariableDeclaration(parent)?.Initializer === value) {
            queue.push(parent);
            continue;
          }
          const read = parent === undefined ? undefined : selectedRead(parent);
          if (read === undefined || read.receiver.expression !== value) {
            return reject("Pointer container escapes or has an unproved mutation through an exact alias.");
          }
        }
      } else if (ast.is.IsArrayLiteralExpression(node)) {
        if (!ast.is.IsElementAccessExpression(access)) return reject("An array pointer read requires selected element evidence.");
        literals.add(node);
        includesUndefined = true;
        for (const element of ast.elements(node)) {
          if (++inspected > maximumValues) return reject("Pointer container source-value budget exceeded.");
          if (element === undefined || ast.is.IsOmittedExpression(element) || ast.is.IsSpreadElement(element)) {
            return reject("Pointer container elements require exact initialized non-spread values.");
          }
          values.add(element);
        }
      } else if (ast.is.IsObjectLiteralExpression(node)) {
        literals.add(node);
        const matches: Node[] = [];
        for (const element of ast.properties(node)) {
          if (++inspected > maximumValues) return reject("Pointer container source-value budget exceeded.");
          if (element === undefined) return reject("Pointer container has an undefined property slot.");
          const info = semantics.forNode(element).operations.objectLiteralElement(element);
          if (info === undefined || info.objectLiteral !== node || info.element !== element ||
            (info.elementKind !== "property" && info.elementKind !== "shorthand")) {
            return reject("Pointer object containers require closed checked data properties.");
          }
          const sameDeclaration = selection.selectedDeclaration !== undefined &&
            (selection.selectedDeclaration === element || info.sourceSelectedDeclarations.includes(selection.selectedDeclaration));
          const sameSymbol = selection.selectedSymbol !== undefined &&
            (selection.selectedSymbol === info.sourceElementSymbol || selection.selectedSymbol === info.sourceSelectedSymbol);
          if (!sameDeclaration && !sameSymbol) continue;
          const initial = info.elementKind === "property" ? ast.as.AsPropertyAssignment(element)?.Initializer : ast.name(element);
          if (initial === undefined) return reject("The selected pointer property has no exact initialized value.");
          matches.push(initial);
        }
        if (matches.length !== 1) return reject("Pointer property selection is missing or ambiguous at its literal origin.");
        values.add(matches[0]!);
      } else return reject("Pointer container requires a closed local literal origin.");
    }
    if (literals.size === 0) return reject("Pointer container aliases have no initialized literal origin.");
    return Object.freeze({ kind: "values", values: Object.freeze([...values]), includesUndefined });
  }

  function selectedRead(node: Node): ResolvedSourceElementAccessInfo | ResolvedSourcePropertyAccessInfo | undefined {
    const element = ast.is.IsElementAccessExpression(node) ? ast.as.AsElementAccessExpression(node) : undefined;
    const property = ast.is.IsPropertyAccessExpression(node) ? ast.as.AsPropertyAccessExpression(node) : undefined;
    const selected = element !== undefined
      ? semantics.forNode(node).operations.elementAccess(node)
      : property !== undefined ? semantics.forNode(node).operations.propertyAccess(node) : undefined;
    return selected?.expression === node && selected.receiver.expression === (element?.Expression ?? property?.Expression) &&
      selected.accessMode === "read" && !selected.callCallee ? selected : undefined;
  }
}
