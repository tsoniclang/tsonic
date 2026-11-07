import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram, SourceNavigationMemberAccess } from "@tsonic/target-api/host";
import { sourceTypeDescriptorsEqual } from "@tsonic/target-api/source";
import { pointerFlowOperand, pointerFlowParent } from "./source-forms.js";

export type PointerContainerValues =
  | { readonly kind: "values"; readonly values: readonly Node[]; readonly includesUndefined: boolean }
  | { readonly kind: "unproven"; readonly reason: string };

export function createPointerContainerQueries(source: HostSourceProgram, maximumValues: number) {
  const { ast, navigation, facts } = source;
  // The member entity an access selects: its declarations with their merged declarations (navigation witness).
  const entity = (selected: SourceNavigationMemberAccess): ReadonlySet<Node> => new Set(
    (selected.declaration === undefined ? selected.declarations : [selected.declaration])
      .flatMap(declaration => navigation.mergedDeclarations(declaration)));
  const receiverType = (selected: SourceNavigationMemberAccess) => {
    const outcome = facts.values.type(selected.receiver);
    return outcome.kind === "refused" ? undefined : outcome.type;
  };
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
    const selection = selectedAccess(access);
    const reject = (reason: string): PointerContainerValues => Object.freeze({ kind: "unproven", reason });
    if (selection === undefined || selection.accessMode !== "read") return reject("Pointer container access has no exact selected read.");
    const queue: Node[] = [selection.receiver];
    const selectionEntity = entity(selection);
    const seen = new Set<Node>();
    const literals = new Set<Node>();
    const values = new Set<Node>();
    const assignments: {
      readonly access: Node;
      readonly selected: SourceNavigationMemberAccess;
      readonly value: Node;
    }[] = [];
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
        if (initial === undefined || uses.exported || !ast.is.IsIdentifier(ast.name(node))) {
          return reject("Pointer container bindings require exact initialized non-exported origins.");
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
          const rebinding = parent !== undefined && ast.is.IsBinaryExpression(parent)
            ? ast.as.AsBinaryExpression(parent) : undefined;
          if (rebinding?.Left === value && ast.operatorKindName(parent!) === "KindEqualsToken" &&
            rebinding.Right !== undefined) {
            queue.push(rebinding.Right);
            continue;
          }
          const selected = parent === undefined ? undefined : selectedAccess(parent);
          if (selected === undefined || selected.receiver !== value) {
            return reject("Pointer container escapes or has an unproved mutation through an exact alias.");
          }
          if (ast.is.IsDeleteExpression(pointerFlowParent(ast, parent!).parent)) {
            return reject("Pointer container deletion is not a proved stored-value assignment.");
          }
          if (selected.accessMode !== "read") {
            const assignment = ast.parent(parent);
            const binary = assignment !== undefined && ast.is.IsBinaryExpression(assignment)
              ? ast.as.AsBinaryExpression(assignment) : undefined;
            if (binary?.Left !== parent || binary?.Right === undefined ||
              ast.operatorKindName(assignment!) !== "KindEqualsToken") {
              return reject("Pointer container mutation requires an exact simple assignment.");
            }
            assignments.push({ access: parent!, selected, value: binary.Right });
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
          const info = facts.selections.objectLiteralElement(element);
          if (info === undefined || info.objectLiteral !== node || info.element !== element ||
            (info.elementKind !== "property" && info.elementKind !== "shorthand")) {
            return reject("Pointer object containers require closed checked data properties.");
          }
          // The read selects this property: its own declaration or the destination member it fills.
          const filled = [element, ...(info.destination?.declarations ?? [])]
            .flatMap(declaration => navigation.mergedDeclarations(declaration));
          if (!filled.some(declaration => selectionEntity.has(declaration))) continue;
          const initial = info.elementKind === "property" ? ast.as.AsPropertyAssignment(element)?.Initializer : ast.name(element);
          if (initial === undefined) return reject("The selected pointer property has no exact initialized value.");
          matches.push(initial);
        }
        if (matches.length !== 1) return reject("Pointer property selection is missing or ambiguous at its literal origin.");
        values.add(matches[0]!);
      } else return reject("Pointer container requires a closed local literal origin.");
    }
    if (literals.size === 0) return reject("Pointer container aliases have no initialized literal origin.");
    const array = [...literals].every(node => ast.is.IsArrayLiteralExpression(node));
    for (const assignment of assignments) {
      if ((array && ast.is.IsElementAccessExpression(access) && ast.is.IsElementAccessExpression(assignment.access)) ||
        sameSelectedProperty(selection, assignment.selected)) {
        values.add(assignment.value);
      } else if (!sameReceiverType(selection, assignment.selected) || selectionEntity.size === 0 ||
        entity(assignment.selected).size === 0) {
        return reject("Pointer container mutation has no exact field correspondence with the selected read.");
      }
    }
    return Object.freeze({ kind: "values", values: Object.freeze([...values]), includesUndefined });
  }

  function selectedAccess(node: Node): SourceNavigationMemberAccess | undefined {
    const element = ast.is.IsElementAccessExpression(node) ? ast.as.AsElementAccessExpression(node) : undefined;
    const property = ast.is.IsPropertyAccessExpression(node) ? ast.as.AsPropertyAccessExpression(node) : undefined;
    if (element === undefined && property === undefined) return undefined;
    const selected = navigation.memberAccess(node);
    const parent = ast.parent(node);
    const callCallee = parent !== undefined && ast.is.IsCallExpression(parent) && ast.as.AsCallExpression(parent)?.Expression === node;
    return selected?.access === node && selected.receiver === (element?.Expression ?? property?.Expression) && !callCallee
      ? selected : undefined;
  }

  // Two accesses select the same member: the same selected declaration, or overlapping member entities.
  function sameSelectedProperty(left: SourceNavigationMemberAccess, right: SourceNavigationMemberAccess): boolean {
    if (left.declaration !== undefined && left.declaration === right.declaration) return true;
    const selected = entity(left);
    return [...entity(right)].some(declaration => selected.has(declaration));
  }

  // The two receivers have the same Host type (was checker Type identity).
  function sameReceiverType(left: SourceNavigationMemberAccess, right: SourceNavigationMemberAccess): boolean {
    const leftType = receiverType(left);
    const rightType = receiverType(right);
    return leftType !== undefined && rightType !== undefined && sourceTypeDescriptorsEqual(leftType, rightType);
  }
}
