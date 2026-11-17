import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node, SourceCallMarkerKind, SourceFileQueries } from "@tsonic/tsts";
import type { SourceInputSafetyQueries, SourceInputSafetyReceipt } from "@tsonic/target-api/host";
import type { SourcePresence } from "@tsonic/target-api/source";
import type { TargetSourceSafetyProvider } from "@tsonic/target-api/provider";
import { selectInlineSourceMember } from "./selected-source-member.js";
import { selectedProviderCallMatches, unwrapParenthesizedExpression } from "./provider-calls.js";
import type { SelectedProviderSourceCall } from "./provider-calls.js";
import { tsonicCoreSourceSemanticsModules } from "../extension/source-modules.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { pointerFlowOperand } from "../pointers/backing/source-forms.js";
import { sourceSafetySignatureIds, tsonicCoreSafetyProviderNames } from "../safety/declarations.js";

const erasedValueMarkers: ReadonlySet<SourceCallMarkerKind> = new Set([
  "write-only-reference", "read-write-reference", "read-only-reference", "shared-borrow", "mutable-borrow", "move", "struct",
]);
const erasedMarkers = tsonicCoreSourceSemanticsModules().flatMap(module => module.exports.flatMap(declaration =>
  declaration.kind === "call-marker" && erasedValueMarkers.has(declaration.marker)
    ? [{ module: module.moduleSpecifier, exportName: declaration.exportName }] : []));

export function createSourceCoreSafetyInput(input: {
  readonly checked: CheckedSourceProgram;
  readonly assertNode: (node: Node) => void;
  readonly safetyProviders: readonly TargetSourceSafetyProvider[];
}): SourceInputSafetyQueries {
  const { checked, assertNode } = input;
  const { ast, sourceFacts } = checked;
  const retained = new WeakMap<Node, SourcePresence<SourceInputSafetyReceipt>>();
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const providers = Object.freeze([{
    providerId: tsonicCoreVirtualModulesProviderId, providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreLangModule, names: tsonicCoreSafetyProviderNames,
  }, ...input.safetyProviders].map(provider => Object.freeze({ providerId: provider.providerId,
    providerVersion: provider.providerVersion, providerModuleId: provider.providerModuleId,
    names: Object.freeze({ ...provider.names }) })));
  const identities = new Set<string>();
  for (const provider of providers) {
    const identity = JSON.stringify([provider.providerId, provider.providerVersion, provider.providerModuleId]);
    if (identities.has(identity)) throw new Error("Safety providers require one canonical registration per provider module.");
    identities.add(identity);
  }
  const firstDirectStatement = (call: Node): boolean => {
    let expression = call;
    let parent = ast.parent(expression);
    while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) {
      expression = parent;
      parent = ast.parent(expression);
    }
    if (parent === undefined || !ast.is.IsExpressionStatement(parent) ||
      ast.as.AsExpressionStatement(parent)?.Expression !== expression) return false;
    const owner = ast.parent(parent);
    return owner !== undefined && ast.statements(owner).find(statement => statement !== undefined) === parent;
  };
  const valueTarget = (original: Node, queries: SourceFileQueries): Node | undefined => {
    const { checker } = queries;
    const visited = new Set<Node>();
    const declaration = (expression: Node): Node | undefined => {
      assertNode(expression);
      if (visited.has(expression)) throw new Error("Safety roots require acyclic original expression identities.");
      visited.add(expression);
      const operand = pointerFlowOperand(ast, expression);
      if (operand !== undefined) return declaration(operand);
      if (ast.is.IsCallExpression(expression)) {
        const selection = checker.getResolvedCallInfo(expression);
        if (selection?.kind !== "applicable" || selection.selection.argumentValues.length !== 1) return undefined;
        const owner = checker.getSignatureDeclaration(selection.selection.application.signature);
        const identity = owner === undefined ? undefined : sourceFacts.getFact(owner, providerVirtualDeclarationFactKey);
        if (identity?.providerId !== tsonicCoreVirtualModulesProviderId ||
          identity.providerVersion !== tsonicCoreProviderVersion || identity.memberId !== undefined ||
          !erasedMarkers.some(marker => marker.module === identity.providerModuleId && marker.exportName === identity.exportId)) return undefined;
        const argument = selection.selection.argumentValues[0]?.expression;
        return argument === undefined ? undefined : declaration(argument);
      }
      if (ast.is.IsFunctionExpression(expression) || ast.is.IsArrowFunction(expression)) return expression;
      if (ast.is.IsPropertyAccessExpression(expression)) {
        const receiver = ast.as.AsPropertyAccessExpression(expression)?.Expression;
        if (receiver === undefined || declaration(receiver) === undefined) return undefined;
      } else if (!ast.is.IsIdentifier(expression)) return undefined;
      let symbol = checker.getSymbolAtLocation(expression);
      if (checker.getSymbolDeclarations(symbol).some(node => node !== undefined &&
        (ast.is.IsImportSpecifier(node) || ast.is.IsImportClause(node) || ast.is.IsNamespaceImport(node))))
        symbol = checker.getAliasedSymbol(symbol);
      const declarations = checker.getSymbolDeclarations(symbol).filter((node): node is Node => node !== undefined);
      if (declarations.some(node => ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node))) return undefined;
      const implementations = declarations.filter(node => ast.body(node) !== undefined);
      return implementations.length === 1 ? implementations[0] : declarations.length === 1 ? declarations[0] : undefined;
    };
    return declaration(original);
  };
  const receipt = (selected: SelectedProviderSourceCall, provider: TargetSourceSafetyProvider,
    queries: SourceFileQueries): SourceInputSafetyReceipt | undefined => {
    const { selection, call } = selected;
    const base = { occurrence: call, provider: Object.freeze({ providerId: provider.providerId,
      providerVersion: provider.providerVersion, providerModuleId: provider.providerModuleId,
      signatureId: selected.declaration.signatureId! }) };
    const matches = (exportId: string, signatureId: string, member: boolean): boolean => selectedProviderCallMatches(selected,
      member ? { kind: "member-signature", providerId: provider.providerId, providerVersion: provider.providerVersion,
        providerModuleId: provider.providerModuleId, exportId, signatureId, memberId: signatureId, memberStatic: false }
        : { kind: "export-signature", providerId: provider.providerId, providerVersion: provider.providerVersion,
          providerModuleId: provider.providerModuleId, exportId, signatureId }, queries);
    if (matches(provider.names.unsafeContextExport, sourceSafetySignatureIds.unsafeContextExpression, false)) {
      const expression = selection.selection.argumentValues[0]?.expression;
      if (expression === undefined) throw new Error("The selected unsafe expression signature requires its original argument.");
      assertNode(expression);
      return Object.freeze({ ...base, family: "unsafe-context", operation: "expression", expression });
    }
    if (matches(provider.names.unsafeContextExport, sourceSafetySignatureIds.unsafeContextBlock, false))
      return Object.freeze({ ...base, family: "unsafe-context", operation: "remaining-block", firstDirectStatement: firstDirectStatement(call) });
    for (const form of ["type", "value"] as const) {
      if (!matches(provider.names.safetyExport, form === "type" ? sourceSafetySignatureIds.safetyTypeRoot : sourceSafetySignatureIds.safetyValueRoot, false)) continue;
      const argument = selection.selection.argumentValues[0]?.expression;
      const target = form === "type" ? selection.selection.application.signatureTypeArguments?.[0]?.explicitTypeNode
        : argument === undefined ? undefined : valueTarget(argument, queries);
      if (target !== undefined) assertNode(target);
      return Object.freeze({ ...base, family: "safety", operation: "root", form, target: target === undefined ? none : present(target) });
    }
    const originalReceiver = selection.selection.application.receiver?.expression;
    const receiver = unwrapParenthesizedExpression(originalReceiver, queries);
    if (receiver !== undefined) assertNode(receiver);
    const predecessor = receiver === undefined ? none : present(receiver);
    for (const memberKind of ["method", "property", "indexer"] as const) {
      if (!matches(provider.names.safetyBuilderExport, sourceSafetySignatureIds[memberKind], true)) continue;
      const selectedMember = selectInlineSourceMember(selection.selection.argumentValues[0]?.expression, queries,
        memberKind === "indexer" ? "element" : "property");
      if (selectedMember.kind === "rejected") return Object.freeze({ ...base, family: "safety", operation: "select-member",
        predecessor, memberKind, selection: Object.freeze({ kind: "unavailable", reason: selectedMember.reason }) });
      assertNode(selectedMember.expression);
      selectedMember.selectedDeclarations.forEach(assertNode);
      if (selectedMember.selectedDeclaration !== undefined) assertNode(selectedMember.selectedDeclaration);
      return Object.freeze({ ...base, family: "safety", operation: "select-member", predecessor, memberKind,
        selection: Object.freeze({ kind: "selected", expression: selectedMember.expression,
          declaration: selectedMember.selectedDeclaration === undefined ? none : present(selectedMember.selectedDeclaration),
          declarations: Object.freeze([...selectedMember.selectedDeclarations]) }) });
    }
    if (matches(provider.names.safetyBuilderExport, sourceSafetySignatureIds.constructor, true))
      return Object.freeze({ ...base, family: "safety", operation: "placement", predecessor, placement: "constructor" });
    for (const placement of ["getter", "setter"] as const) if (matches(provider.names.safetyMemberBuilderExport, sourceSafetySignatureIds[placement], true))
      return Object.freeze({ ...base, family: "safety", operation: "placement", predecessor, placement });
    for (const [signature, owner, contract] of [
      [sourceSafetySignatureIds.requiresUnsafe, provider.names.safetyBuilderExport, "requires-unsafe"],
      [sourceSafetySignatureIds.safe, provider.names.safetyBuilderExport, "safe"],
      [sourceSafetySignatureIds.memberRequiresUnsafe, provider.names.safetyMemberBuilderExport, "requires-unsafe"],
      [sourceSafetySignatureIds.memberSafe, provider.names.safetyMemberBuilderExport, "safe"],
    ] as const) if (matches(owner, signature, true)) return Object.freeze({ ...base, family: "safety", operation: "apply", predecessor, contract });
    return undefined;
  };
  return Object.freeze({ safety(occurrence: Node) {
    assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    if (!ast.is.IsCallExpression(occurrence) && !ast.is.IsNewExpression(occurrence)) {
      retained.set(occurrence, none);
      return none;
    }
    const file = ast.getSourceFile(occurrence);
    if (file === undefined) throw new Error("Safety operations require their actual original source file.");
    const queries = checked.getSourceFileQueries(file);
    const selection = queries.checker.getResolvedCallInfo(occurrence);
    if (selection?.kind !== "applicable") { retained.set(occurrence, none); return none; }
    const declaration = queries.checker.getSignatureDeclaration(selection.selection.application.signature);
    const provider = declaration === undefined ? undefined : sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
    if (provider === undefined) { retained.set(occurrence, none); return none; }
    const selected = { call: occurrence, selection, declaration: provider };
    let value: SourceInputSafetyReceipt | undefined;
    for (const registration of providers) {
      const actual = receipt(selected, registration, queries);
      if (actual === undefined) continue;
      if (value !== undefined) throw new Error("A safety operation requires one configured original provider identity.");
      value = actual;
    }
    const result = value === undefined ? none : present(value);
    retained.set(occurrence, result);
    return result;
  } });
}
