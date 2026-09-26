import type { Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";
import { memoryDiagnostic } from "./analysis-context.js";
import type { MemorySourceCall } from "./analysis-context.js";

export function readMemoryDescriptor<Key extends string>(
  call: MemorySourceCall,
  keys: readonly Key[],
): ReadonlyMap<Key, Node> | undefined {
  const { ast } = call.context;
  const args = call.selected.selection.sourceArguments;
  const descriptor = unwrapParentheses(args[0]?.expression, call.context);
  const values = new Map<Key, Node>();
  if (args.length === 1 && descriptor !== undefined && ast.is.IsObjectLiteralExpression(descriptor)) {
    for (const property of ast.properties(descriptor)) {
      if (property === undefined) break;
      const name = ast.name(property);
      const key = name !== undefined && (ast.is.IsIdentifier(name) || ast.is.IsStringLiteral(name))
        ? keys.find(candidate => candidate === ast.text(name)) : undefined;
      const value = ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer
        : ast.is.IsShorthandPropertyAssignment(property) &&
          ast.as.AsShorthandPropertyAssignment(property)?.ObjectAssignmentInitializer === undefined ? name : undefined;
      if (key === undefined || value === undefined || values.has(key)) break;
      values.set(key, value);
    }
    if (values.size === keys.length && ast.properties(descriptor).length === keys.length) return values;
  }
  memoryDiagnostic(call, "DESCRIPTOR_NOT_PROVEN",
    `${call.name} requires one inline named descriptor with exactly these data properties: ${keys.join(", ")}.`);
  return undefined;
}

export function readMemoryDescriptorFields(expression: Node, call: MemorySourceCall): readonly Node[] | undefined {
  const { ast } = call.context;
  const array = unwrapParentheses(expression, call.context);
  if (array !== undefined && ast.is.IsArrayLiteralExpression(array)) {
    const elements = ast.elements(array);
    if (elements.every(element => element !== undefined && !ast.is.IsSpreadElement(element) &&
        !ast.is.IsOmittedExpression(element))) return elements.filter(element => element !== undefined);
  }
  memoryDiagnostic(call, "DESCRIPTOR_FIELDS_NOT_PROVEN",
    "memorylayout fields requires an inline array of exact field metadata without holes or spreads.");
  return undefined;
}

function unwrapParentheses(expression: Node | undefined, context: TsonicSourceFileAnalysisContext): Node | undefined {
  let current = expression;
  while (current !== undefined && context.ast.is.IsParenthesizedExpression(current)) {
    current = context.ast.as.AsParenthesizedExpression(current)?.Expression;
  }
  return current;
}
