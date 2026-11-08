import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceMemberUse } from "../source-semantics/member-use.js";
import type { SourceNavigationQueryContext } from "./query-context.js";
import { sourceMayReadBeforeInitialization } from "./initialization-uses.js";
import { createSourceCallableValueQuery, sourceCallableValueExpression } from "./callable-values.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";

export interface SourceCallOnlyAlias {
  readonly expression: Node;
  readonly selectedDeclaration: Node;
  readonly member: SourcePresence<SourceMemberUse>;
  readonly receiverDeclaration?: Node;
  readonly declarations: readonly Node[];
  readonly calls: readonly Node[];
}

export function createSourceCallOnlyAliasQuery(source: SourceNavigationQueryContext):
  (declaration: Node) => SourceResult<SourcePresence<SourceCallOnlyAlias>> {
  const { ast } = source;
  const { navigation, values, descriptors, applications } = source.facts;
  const cache = new WeakMap<Node, SourceResult<SourcePresence<SourceCallOnlyAlias>>>();
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  const selectValue = createSourceCallableValueQuery(source);
  const unwrap = (node: Node | undefined): Node | undefined => sourceCallableValueExpression(ast, node);
  const initializer = (node: Node | undefined): Node | undefined =>
    node !== undefined && ast.is.IsVariableDeclaration(node) &&
      ast.variableDeclarationKind(node) === "const" && ast.is.IsIdentifier(ast.name(node))
      ? unwrap(ast.as.AsVariableDeclaration(node)?.Initializer) : undefined;
  const select = (declaration: Node): SourceResult<SourcePresence<SourceCallOnlyAlias>> => {
    navigation.callableRoles(declaration);
    const cached = cache.get(declaration);
    if (cached !== undefined) return cached;
    const produce = (): SourceResult<SourcePresence<SourceCallOnlyAlias>> => {
      const initial = initializer(declaration);
      if (initial === undefined) return none;
      const selectedResult = selectValue(initial);
      if (selectedResult.kind === "refused") return selectedResult;
      if (selectedResult.value.kind === "none") return none;
      const selected = selectedResult.value.value;
      const expression = selected.expression;
      if (!ast.is.IsIdentifier(expression) && !ast.is.IsPropertyAccessExpression(expression) &&
        !ast.is.IsElementAccessExpression(expression)) return none;
      const member = selected.member;
      const selectedDeclaration = selected.selectedDeclaration;
      if (member.kind === "present" && (member.value.optionalChain || member.value.chainContinuation) ||
        !ast.is.IsFunctionDeclaration(selectedDeclaration) &&
        !ast.is.IsMethodDeclaration(selectedDeclaration) &&
        ast.kindName(selectedDeclaration) !== "KindMethodSignature") return none;
      if (member.kind === "present" && selected.receiverDeclaration === undefined) return none;
      const flow = navigation.expressionValueFlow(expression);
      if (flow.aliasDeclarations.length > 1_024) failTargetCompilerResourceLimit("tsonic", "Call-only alias declarations", "declarations", 1_024, declaration);
      if (flow.uses.length > 131_072) failTargetCompilerResourceLimit("tsonic", "Call-only alias uses", "uses", 131_072, declaration);
      if (flow.aliasDeclarations.length === 0 || flow.memberWritten || flow.receiverUsed ||
        flow.identityCompared || flow.returned || flow.yielded || flow.passedAsArgument ||
        flow.storedOutsideBinding || flow.exported || flow.hasUnclassifiedUse) return none;
      const aliases = new Set(flow.aliasDeclarations);
      for (const alias of aliases) {
        const value = initializer(alias);
        const previous = value === undefined ? undefined : navigation.sourceReferenceFor(value)?.declaration;
        if (value === undefined || navigation.declarationUseSummary(alias).bindingWritten ||
          sourceMayReadBeforeInitialization(alias, ast, navigation) ||
          value !== expression && (!ast.is.IsIdentifier(value) || previous === undefined || !aliases.has(previous))) return none;
      }
      const value = values.type(expression);
      if (value.kind === "refused") return value;
      let callable = value.value;
      const seen = new Set<SourceTypeEvidence>();
      while (callable.type.kind === "declared" || callable.type.kind === "projection") {
        if (seen.has(callable)) return none;
        if (seen.size >= 1_024) failTargetCompilerResourceLimit("tsonic", "Call-only alias signatures", "declarations", 1_024, declaration);
        seen.add(callable);
        const definition = descriptors.definition(callable);
        if (definition.kind === "refused") return definition;
        callable = definition.value;
      }
      if (callable.type.kind !== "shape" && callable.type.kind !== "callable") return none;
      if (callable.type.calls.length > 1_024) failTargetCompilerResourceLimit("tsonic", "Call-only alias signatures", "declarations", 1_024, declaration);
      const overloads = new Set(callable.type.calls.map(signature => signature.identity));
      const calls = new Set<Node>();
      for (const use of flow.uses) {
        if (use.kind === "type-only" || use.role === "storage") continue;
        if (use.role !== "call-target") return none;
        let callee = use.reference;
        let call = ast.parent(callee);
        for (let depth = 0; call !== undefined && unwrap(call) === unwrap(callee); depth += 1) {
          if (depth >= 256) failTargetCompilerResourceLimit("tsonic", "Call-only alias callee", "depth", 256, declaration);
          callee = call;
          call = ast.parent(callee);
        }
        if (call === undefined || !ast.is.IsCallExpression(call) || ast.as.AsCallExpression(call)?.Expression !== callee) return none;
        const application = applications.application(call);
        if (application.kind === "refused") return application;
        if (!overloads.has(application.value.identity.signature)) return none;
        calls.add(call);
      }
      const result: SourceCallOnlyAlias = Object.freeze({
        expression, selectedDeclaration, member,
        ...(selected.receiverDeclaration === undefined ? {} : { receiverDeclaration: selected.receiverDeclaration }),
        declarations: Object.freeze([...aliases]), calls: Object.freeze([...calls]),
      });
      const published = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present", value: result }) } as const);
      for (const alias of aliases) cache.set(alias, published);
      return published;
    };
    const result = produce();
    cache.set(declaration, result);
    return result;
  };
  return select;
}
