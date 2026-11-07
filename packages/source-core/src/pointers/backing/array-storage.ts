import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram } from "@tsonic/target-api/host";
import { pointerFlowCallableBoundary, pointerFlowOperand, pointerFlowParent } from "./source-forms.js";

export type TsonicClosedArrayStorage =
  | { readonly kind: "unproven"; readonly reason: string }
  | { readonly kind: "closed"; readonly declarations: readonly Node[]; readonly references: readonly Node[];
      readonly literals: readonly Node[];
      /** The element access expressions of the closed array; their selections are facts.values.elementAccess(node). */
      readonly elements: readonly Node[] };

export function createTsonicClosedArrayStorageQueries(source: HostSourceProgram, maximumValues: number) {
  if (!Number.isSafeInteger(maximumValues) || maximumValues < 1) throw new Error("Array storage requires a finite source-value budget.");
  const { ast, navigation } = source;
  const cache = new WeakMap<Node, TsonicClosedArrayStorage>();
  return Object.freeze({ resolve });

  function owner(node: Node): Node | undefined {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (pointerFlowCallableBoundary(ast, parent)) return parent;
    }
    return undefined;
  }

  function resolve(access: Node): TsonicClosedArrayStorage {
    const cached = cache.get(access);
    if (cached !== undefined) return cached;
    const result = inspect(access);
    cache.set(access, result);
    if (result.kind === "closed") for (const element of result.elements) cache.set(element, result);
    return result;
  }

  function inspect(access: Node): TsonicClosedArrayStorage {
    const reject = (reason: string): TsonicClosedArrayStorage => Object.freeze({ kind: "unproven", reason });
    const selected = ast.is.IsElementAccessExpression(access) ? navigation.memberAccess(access) : undefined;
    const callable = owner(access);
    if (selected === undefined || selected.access !== access || selected.optionalChain || callable === undefined) {
      return reject("Native element storage requires an exact nonoptional local array access.");
    }
    const queue = [selected.receiver];
    const seen = new Set<Node>();
    const declarations = new Set<Node>();
    const references = new Set<Node>();
    const literals = new Set<Node>();
    const elements = new Set<Node>();
    let inspected = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (++inspected > maximumValues || queue.length > maximumValues) return reject("Native array source-value budget exceeded.");
      const node = queue[cursor]!;
      if (seen.has(node)) continue;
      seen.add(node);
      if (owner(node) !== callable) return reject("Native array storage cannot cross an unproved callable boundary.");
      const operand = pointerFlowOperand(ast, node);
      if (operand !== undefined) { queue.push(operand); continue; }
      if (ast.is.IsIdentifier(node)) {
        const declaration = navigation.sourceReferenceFor(node)?.declaration;
        if (declaration === undefined) return reject("Native array alias lacks an exact declaration.");
        references.add(node);
        queue.push(declaration);
        continue;
      }
      if (ast.is.IsArrayLiteralExpression(node)) {
        literals.add(node);
        for (const element of ast.elements(node)) {
          if (++inspected > maximumValues) return reject("Native array source-value budget exceeded.");
          if (element === undefined || ast.is.IsOmittedExpression(element) || ast.is.IsSpreadElement(element)) {
            return reject("Native array storage requires dense, non-spread literal origins.");
          }
        }
        continue;
      }
      if (!ast.is.IsVariableDeclaration(node) || !ast.is.IsIdentifier(ast.name(node))) return reject("Native array storage requires plain initialized local bindings.");
      const initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
      const statement = ast.parent(ast.parent(node));
      const uses = navigation.declarationUseSummary(node);
      if (initializer === undefined || uses.exported || !ast.is.IsVariableStatement(statement) || !ast.is.IsBlock(ast.parent(statement))) {
        return reject("Native array storage requires initialized block-local bindings.");
      }
      declarations.add(node);
      queue.push(initializer);
      for (const use of uses.uses) {
        if (++inspected > maximumValues) return reject("Native array source-value budget exceeded.");
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        if (owner(use.reference) !== callable) return reject("Native array storage has an unproved capture.");
        references.add(use.reference);
        const { value, parent } = pointerFlowParent(ast, use.reference);
        if (parent !== undefined && ast.is.IsVariableDeclaration(parent) && ast.as.AsVariableDeclaration(parent)?.Initializer === value) {
          queue.push(parent);
          continue;
        }
        const assignment = parent !== undefined && ast.is.IsBinaryExpression(parent) ? ast.as.AsBinaryExpression(parent) : undefined;
        if (assignment !== undefined && ast.operatorKindName(parent!) === "KindEqualsToken") {
          if (!ast.is.IsExpressionStatement(pointerFlowParent(ast, parent!).parent)) {
            return reject("Native array replacement cannot expose an unproved assignment result.");
          }
          const other = assignment.Left === value ? assignment.Right : assignment.Right === value ? assignment.Left : undefined;
          if (other !== undefined) { queue.push(other); continue; }
        }
        const element = parent !== undefined && ast.is.IsElementAccessExpression(parent) ? navigation.memberAccess(parent) : undefined;
        if (element === undefined || element.access !== parent || element.receiver !== value || element.optionalChain || element.callCallee ||
          ast.is.IsDeleteExpression(pointerFlowParent(ast, parent!).parent)) {
          return reject("Native array storage has an unproved escape, property operation, deletion or resize.");
        }
        elements.add(parent!);
      }
    }
    if (literals.size === 0 || declarations.size === 0) return reject("Native array storage has no initialized local allocation.");
    return Object.freeze({ kind: "closed", declarations: Object.freeze([...declarations]), references: Object.freeze([...references]),
      literals: Object.freeze([...literals]), elements: Object.freeze([...elements]) });
  }
}
