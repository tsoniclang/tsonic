import { fieldFactKey, structFactKey } from "@tsonic/tsts";
import type { AstReader, ExtensionEvidence, FieldFact, Node, SourceAnalysisFactAccess } from "@tsonic/tsts";

import { tsonicCoreSourceExtensionId } from "../identity.js";

import type { ExtensionDiagnosticWriter } from "@tsonic/tsts";

const structFieldDiagnostics = {
  duplicateField: {
    extensionCode: "SOURCE_SEMANTICS_STRUCT_DUPLICATE_FIELD",
    numericCode: 9901107,
    message: "struct(...) field shape contains a duplicate static field name.",
  },
  structMember: {
    extensionCode: "SOURCE_SEMANTICS_STRUCT_FIELD_NOT_PROVEN",
    numericCode: 9901109,
    message: "struct(...) field shape members require finalized field<T>() facts.",
  },
} as const;

export function validateTsonicStructFacts(
  sourceFile: Node,
  ast: AstReader,
  facts: SourceAnalysisFactAccess,
  diagnostics: ExtensionDiagnosticWriter,
): void {
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node) || facts.get(node, structFactKey) === undefined) {
      return;
    }
    validateSourceCoreStructShape(node, ast, facts, diagnostics);
  });
}

function validateSourceCoreStructShape(
  callExpression: Node,
  ast: AstReader,
  facts: SourceAnalysisFactAccess,
  diagnostics: ExtensionDiagnosticWriter,
): void {
  const shape = ast.arguments(callExpression)[0];
  if (shape === undefined || !ast.is.IsObjectLiteralExpression(shape)) {
    return;
  }
  const seenFields = new Map<string, Node>();
  for (const property of ast.properties(shape)) {
    if (property === undefined || !ast.is.IsPropertyAssignment(property)) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property ?? shape, ast, [
        { message: "Struct shape member is not a property assignment with a field<T>() initializer." },
      ]);
      continue;
    }
    const field = facts.get<FieldFact>(property, fieldFactKey);
    const name = field?.name;
    if (name === undefined || field === undefined) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property, ast, [
        { message: "Struct shape property lacks finalized field name/type evidence.", details: { hasStaticName: name !== undefined, hasFieldFact: field !== undefined } },
      ]);
      continue;
    }
    const previous = seenFields.get(name);
    if (previous !== undefined) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.duplicateField, property, ast, [
        { message: "Duplicate static struct field name.", details: { name } },
      ]);
      continue;
    }
    seenFields.set(name, property);
  }
}

function appendStructFieldDiagnostic(
  diagnostics: ExtensionDiagnosticWriter,
  diagnostic: typeof structFieldDiagnostics[keyof typeof structFieldDiagnostics],
  node: Node,
  ast: AstReader,
  evidence: readonly ExtensionEvidence[],
): void {
  diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode: diagnostic.extensionCode,
    numericCode: diagnostic.numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${diagnostic.numericCode}`,
    category: "error",
    message: diagnostic.message,
    nodeOrSpan: node,
    evidence,
    identity: `source-core-struct-field:${diagnostic.extensionCode}:${ast.getPath(ast.getSourceFile(node))}:${ast.pos(node)}:${ast.end(node)}`,
  });
}

function visitSourceFile(
  node: Node | undefined,
  ast: AstReader,
  visitor: (node: Node) => void,
  seen: Set<Node> = new Set(),
): void {
  if (node === undefined) {
    return;
  }
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  visitor(node);
  for (const child of ast.children(node)) {
    visitSourceFile(child ?? undefined, ast, visitor, seen);
  }
}
