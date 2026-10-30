import { providerVirtualDeclarationFactKey, type Node, type Type } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import { isTsonicSourceProfileDeclarationPath } from "../../source-profile.js";
import {
  Node_Expression, Node_Initializer,
  sourceCallableDefinitionIsDiscarded, sourceEnclosingCallable, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees,
} from "../../source-navigation/index.js";
import type { ResolvedSourceCallInfo } from "../../source-semantics/call-result-selection.js";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/types.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import { createSourceGenericAdoptionDiagnostics } from "./generic-adoption-diagnostics.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export const sourceGenericAdoptionDiagnosticCode = "TSONIC_GENERIC_ASYNC_ADOPTION_UNSUPPORTED";
export const sourceGenericAdoptionDiagnosticMessage = "A generic async declaration would adopt this Promise-valued type argument (through an await, an async return or a Promise resolution). Generic Promise adoption is outside the approved native payload representation (capability C15, frozen). Await the Promise before passing it, or use a non-generic async function.";

export interface SourceGenericAdoptionIssue {
  readonly site: Node;
  readonly parameter: Node;
  readonly declaration: Node;
  readonly operation: Node;
  readonly sourceSpan: TargetDiagnosticSourceSpan;
  readonly evidence: readonly string[];
}

function sourceGenericAdoptionPromiseOwner(source: TargetSourceProgram, declaration: Node,
  semantics: SourceFileSemantics): "Promise" | "PromiseLike" | "PromiseConstructor" | undefined {
  const fact = source.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
  if (fact?.providerId === "tsonic.js.source-virtual-modules" &&
    (fact.exportName === "Promise" || fact.exportName === "PromiseLike" || fact.exportName === "PromiseConstructor"))
    return fact.exportName;
  const { ast } = source;
  const file = ast.getSourceFile(declaration);
  if (file === undefined || !ast.isDeclarationFile(file) || source.navigation.isProjectDeclaration(declaration) ||
    !(isTsonicSourceProfileDeclarationPath(ast.getFileName(file)) ||
      semantics.declarations.isDefaultLibraryDeclaration(declaration))) return undefined;
  const owner = ast.is.IsInterfaceDeclaration(declaration) || ast.is.IsClassDeclaration(declaration)
    ? declaration : ast.parent(declaration);
  const ownerName = ast.text(ast.name(owner));
  if (ownerName !== "Promise" && ownerName !== "PromiseLike" && ownerName !== "PromiseConstructor") return undefined;
  return ownerName;
}

function sourceGenericAdoptionPromiseMember(source: TargetSourceProgram, declaration: Node,
  semantics: SourceFileSemantics): string | undefined {
  if (sourceGenericAdoptionPromiseOwner(source, declaration, semantics) === undefined) return undefined;
  const fact = source.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
  if (fact?.providerId === "tsonic.js.source-virtual-modules")
    return fact.memberKey?.kind === "property-key" ? fact.memberKey.name : fact.memberName ?? "construct";
  const { ast } = source;
  return ast.is.IsConstructSignatureDeclaration(declaration) ? "construct" : ast.text(ast.name(declaration));
}

export function analyzeSourceDeclarationGenericAdoption(input: {
  readonly source: TargetSourceProgram;
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "completionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] }
  | SourceDeclarationOwnershipUnresolved {
  const { source, budget } = input;
  const { ast } = source;
  const root = input.nodes[0] ?? source.sourceFiles[0];
  if (root === undefined) return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
  const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node =>
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
      ? sourceCallableDefinitionIsDiscarded(node, ast, source.navigation)
      : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
  if (domain.kind === "unresolved") return sourceDeclarationOwnershipUnresolved(root, domain.reason);
  const rows = budget.createRows(root);
  const parameters = new Map<Node, { readonly owner: Node; readonly neighbours: Set<Node>; operation: Node | undefined }>();
  const calls: { readonly node: Node; readonly selected: ResolvedSourceCallInfo; readonly declaration: Node }[] = [];
  const instances: { readonly site: Node; readonly parameter: Node; readonly actual: Type; readonly operation?: Node }[] = [];
  const resolverParameters = new Set<Node>();
  const callbackRelations = new Map<Node, Map<Node, Node>>();
  const instanceSites = new Map<Node, Map<Node, Map<Type, Set<Node | undefined>>>>();
  const parameterTypes = new Map<Type, ReadonlySet<Node>>();
  let failure: SourceDeclarationOwnershipUnresolved | undefined;
  const step = (node: Node): boolean => {
    if (budget.step(node)) return true;
    failure ??= budget.failure();
    return false;
  };
  const parametersIn = (type: Type, semantics: SourceFileSemantics): ReadonlySet<Node> => {
    const existing = parameterTypes.get(type);
    if (existing !== undefined) return existing;
    const found = new Set<Node>();
    const pending = [type];
    const visited = new Set<Type>();
    while (pending.length !== 0) {
      if (!step(semantics.sourceFile)) break;
      const selected = pending.pop()!;
      if (visited.has(selected)) continue;
      if (!rows.add(1)) { failure ??= budget.failure(); break; }
      visited.add(selected);
      const symbol = semantics.declarations.typeSymbol(selected);
      const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
      for (const declaration of declarations) if (parameters.has(declaration)) found.add(declaration);
      if (declarations.some(declaration => ast.is.IsTypeParameterDeclaration(declaration))) continue;
      if (semantics.types.isUnion(selected) || semantics.types.isIntersection(selected)) {
        pending.push(...semantics.types.unionOrIntersectionTypes(selected));
        continue;
      }
      const awaited = semantics.types.awaitedType(selected);
      if (awaited === undefined) {
        failure ??= sourceDeclarationOwnershipUnresolved(semantics.sourceFile,
          "A declared generic relation requires its completed checked Awaited component.");
        break;
      }
      if (awaited !== undefined && !semantics.types.isIdentical(awaited, selected)) pending.push(awaited);
    }
    if (failure === undefined && rows.add(1)) parameterTypes.set(type, found);
    else failure ??= budget.failure();
    return found;
  };
  const mark = (operation: Node, type: Type, semantics: SourceFileSemantics): void => {
    for (const declaration of parametersIn(type, semantics)) parameters.get(declaration)!.operation ??= operation;
  };
  const referenceDeclaration = (node: Node): Node | undefined => {
    if (ast.is.IsParameterDeclaration(node)) return node;
    const direct = source.navigation.sourceReferenceFor(node)?.declaration;
    if (direct === undefined || !ast.is.IsVariableDeclaration(direct) || ast.variableDeclarationKind(direct) !== "const")
      return direct;
    const initializer = Node_Initializer(ast, direct);
    return initializer === undefined ? direct : source.navigation.sourceReferenceFor(initializer)?.declaration ?? direct;
  };
  const relation = (callback: Node, parameter: Node, operation: Node): boolean => {
    const previous = callbackRelations.get(callback);
    if (previous?.has(parameter)) return false;
    if (!rows.add(previous === undefined ? 2 : 1)) { failure ??= budget.failure(); return false; }
    const selected = previous ?? new Map<Node, Node>();
    selected.set(parameter, operation);
    callbackRelations.set(callback, selected);
    return true;
  };
  const instance = (site: Node, parameter: Node, actual: Type, operation?: Node): void => {
    if (!parameters.has(parameter)) return;
    const byParameter = instanceSites.get(site);
    const byActual = byParameter?.get(parameter);
    const operations = byActual?.get(actual);
    if (operations?.has(operation)) return;
    if (!rows.add(1 + (byParameter === undefined ? 1 : 0) + (byActual === undefined ? 1 : 0) +
      (operations === undefined ? 1 : 0))) { failure ??= budget.failure(); return; }
    const parameterSites = byParameter ?? new Map<Node, Map<Type, Set<Node | undefined>>>();
    const actualSites = byActual ?? new Map<Type, Set<Node | undefined>>();
    const operationSites = operations ?? new Set<Node | undefined>();
    operationSites.add(operation);
    actualSites.set(actual, operationSites);
    parameterSites.set(parameter, actualSites);
    instanceSites.set(site, parameterSites);
    instances.push(Object.freeze({ site, parameter, actual, ...(operation === undefined ? {} : { operation }) }));
    for (const forwarded of parametersIn(actual, source.semantics.forNode(site))) {
      const selected = parameters.get(forwarded)!;
      if (operation !== undefined) selected.operation ??= operation;
      else if (!selected.neighbours.has(parameter)) {
        if (!rows.add(1)) { failure ??= budget.failure(); return; }
        selected.neighbours.add(parameter);
      }
    }
  };
  try {
    for (const node of domain.nodes) {
      if (!step(node)) break;
      if (!ast.is.IsTypeParameterDeclaration(node) || !source.navigation.isProjectDeclaration(node) ||
        input.exemptTypeParameter?.(node) === true) continue;
      const owner = ast.parent(node);
      const semantics = source.semantics.forNode(node);
      const type = semantics.declarations.declaredType(node);
      if (owner === undefined || type === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "Generic adoption requires the exact checked formal declaration.");
      const result = ast.body(owner) === undefined ? undefined : semantics.types.declarationSignatureInfo(owner)?.returnType;
      const resultSymbol = result === undefined ? undefined : semantics.declarations.typeSymbol(result);
      const promise = resultSymbol !== undefined && semantics.declarations.symbolDeclarations(resultSymbol)
        .some(declaration => sourceGenericAdoptionPromiseOwner(source, declaration, semantics) === "Promise");
      const adopting = result !== undefined && (promise && semantics.types.typeArguments(result)
        .some(argument => semantics.types.isIdentical(argument, type)) ||
        ast.hasModifierKind(owner, "async") && semantics.types.isIdentical(result, type));
      if (!rows.add(2)) return budget.failure()!;
      parameters.set(node, { owner, neighbours: new Set(), operation: adopting ? owner : undefined });
    }
    for (const node of domain.nodes) {
      if (!step(node)) break;
      const semantics = source.semantics.forNode(node);
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        const selected = semantics.operations.call(node);
        const declaration = selected?.sourceSelectedSignatureKind === "resolved"
          ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
        if (selected === undefined || declaration === undefined) continue;
        if (!rows.add(1)) return budget.failure()!;
        calls.push(Object.freeze({ node, selected, declaration }));
        const completion = input.premises.completionFor(node, selected);
        if (completion.kind === "unresolved") return completion;
        if (completion.kind === "async") {
          const problem = sourceDeclarationOwnershipContractProblem(source, node,
            { selectedType: selected.sourceResultType }, completion.contract);
          if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(node, problem);
        }
        const member = sourceGenericAdoptionPromiseMember(source, declaration, semantics);
        const argument = ast.arguments(node)[0];
        if (member === "resolve" && argument !== undefined) {
          const type = semantics.types.expressionType(argument);
          if (type === undefined) return sourceDeclarationOwnershipUnresolved(argument, "A native resolver requires its completed checked input component.");
          mark(node, type, semantics);
        }
        if (member === "construct" && argument !== undefined) {
          const executor = semantics.types.expressionType(argument);
          const signatures = executor === undefined ? [] : semantics.types.signatureInfos(executor, "call");
          const resolver = signatures.length === 1 ? signatures[0]!.parameters[0]?.declaration : undefined;
          if (resolver === undefined)
            return sourceDeclarationOwnershipUnresolved(argument, "A native Promise executor requires its exact checked resolver parameter contract.");
          if (!rows.add(1)) return budget.failure()!;
          resolverParameters.add(resolver);
        } else if (member === "then" || member === "catch" || member === "finally") {
          for (const callback of ast.arguments(node)) {
            if (callback === undefined) continue;
            if (!step(callback)) break;
            const type = semantics.types.expressionType(callback);
            if (type === undefined)
              return sourceDeclarationOwnershipUnresolved(callback, "A native reaction requires its exact checked callback result contract.");
            for (const signature of semantics.types.signatureInfos(type, "call")) {
              if (!step(callback)) break;
              if (signature.returnType !== undefined) mark(node, signature.returnType, semantics);
            }
          }
        }
        for (const argument of selected.sourceSelectedMethodTypeArguments ?? []) {
          const symbol = semantics.declarations.typeSymbol(argument.typeParameter);
          const parameter = symbol === undefined ? undefined : semantics.declarations.symbolDeclarations(symbol)
            .find(candidate => parameters.has(candidate));
          if (parameter !== undefined) instance(node, parameter, argument.selectedType);
        }
        for (const type of [selected.sourceReceiver?.type,
          ...(ast.is.IsNewExpression(node) ? [selected.sourceResultType] : [])]) {
          if (type === undefined) continue;
          for (const binding of semantics.types.typeArgumentBindings(type) ?? [])
            instance(node, binding.declaration, binding.argumentType);
        }
      }
      const expression = ast.is.IsAwaitExpression(node) || ast.is.IsReturnStatement(node) ? Node_Expression(ast, node)
        : ast.is.IsArrowFunction(node) && ast.body(node) !== undefined && !ast.is.IsBlock(ast.body(node)) ? ast.body(node) : undefined;
      if (expression === undefined) continue;
      const owner = ast.is.IsArrowFunction(node) ? node : sourceEnclosingCallable(node, ast);
      if (!ast.is.IsAwaitExpression(node) && (owner === undefined || !ast.hasModifierKind(owner, "async"))) continue;
      const type = semantics.types.expressionType(expression);
      if (type === undefined) return sourceDeclarationOwnershipUnresolved(expression, "Generic completion requires its exact checked result component.");
      mark(node, type, semantics);
    }
    for (const { node, selected } of calls) {
      if (!step(node)) break;
      const callback = referenceDeclaration(selected.sourceCallee.expression);
      const argument = ast.arguments(node)[0];
      if (callback === undefined || argument === undefined || !ast.is.IsParameterDeclaration(callback)) continue;
      const semantics = source.semantics.forNode(argument);
      const type = semantics.types.expressionType(argument);
      if (type === undefined) return sourceDeclarationOwnershipUnresolved(argument, "A declared callback relation requires its checked input type.");
      if (resolverParameters.has(callback)) mark(node, type, semantics);
      else for (const parameter of parametersIn(type, semantics)) relation(callback, parameter, node);
    }
    let changed = true;
    while (changed && failure === undefined) {
      changed = false;
      for (const { node, selected, declaration } of calls) {
        if (!step(node)) break;
        const semantics = source.semantics.forNode(node);
        for (const binding of selected.sourceArgumentBindings) {
          if (!step(node)) break;
          const formal = ast.parameters(declaration)[binding.sourceParameterIndex];
          const actual = ast.arguments(node)[binding.sourceArgumentIndex];
          if (formal === undefined || actual === undefined) continue;
          const constraints = callbackRelations.get(formal);
          if (constraints === undefined) continue;
          const callback = referenceDeclaration(actual);
          if (callback === undefined) continue;
          for (const [parameter, operation] of constraints) {
            const selectedArgument = selected.sourceSelectedMethodTypeArguments?.find(argument => {
              const symbol = semantics.declarations.typeSymbol(argument.typeParameter);
              return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(parameter);
            });
            const receiverArgument = selected.sourceReceiver === undefined ? undefined
              : semantics.types.typeArgumentBindings(selected.sourceReceiver.type)?.find(argument => argument.declaration === parameter);
            const parameterOwner = parameters.get(parameter)!.owner;
            let lexical: Node | undefined = declaration;
            const visited = new Set<Node>();
            while (lexical !== undefined && lexical !== parameterOwner) {
              if (!step(node)) break;
              if (visited.has(lexical))
                return sourceDeclarationOwnershipUnresolved(node, "A declared callback binding has cyclic checked ancestry.");
              visited.add(lexical);
              lexical = ast.parent(lexical);
            }
            const lexicalType = lexical === parameterOwner && declaration !== parameterOwner &&
                !ast.is.IsClassDeclaration(parameterOwner) && !ast.is.IsClassExpression(parameterOwner)
              ? semantics.declarations.declaredType(parameter) : undefined;
            const argumentType = selectedArgument?.selectedType ?? receiverArgument?.argumentType ?? lexicalType;
            if (argumentType === undefined) continue;
            if (resolverParameters.has(callback)) instance(node, parameter, argumentType, operation);
            else if (ast.is.IsParameterDeclaration(callback)) for (const forwarded of parametersIn(argumentType, semantics))
              changed = relation(callback, forwarded, operation) || changed;
          }
        }
      }
    }
    if (failure !== undefined) return failure;
    const sensitive = createTargetGraphComponentQuery<Node, Node | undefined, Node | null>(parameter => {
      if (!step(parameter)) return undefined;
      const selected = parameters.get(parameter);
      return selected === undefined ? undefined : { data: selected.operation, neighbours: selected.neighbours };
    }, members => members.find(member => member.data !== undefined)?.data ??
      members.flatMap(member => member.successors).find(operation => operation !== null) ?? null,
    { step: () => step(root), createRows: () => budget.createRows(root) });
    const format = createSourceGenericAdoptionDiagnostics(source, input.projectRoot);
    const issues: SourceGenericAdoptionIssue[] = [];
    const issuedSites = new Set<Node>();
    for (let index = 0; index < instances.length; index += 1) {
      const entry = instances[index]!;
      if (!step(entry.site)) break;
      const semantics = source.semantics.forNode(entry.site);
      if (semantics.types.isAny(entry.actual) || semantics.types.isUnknown(entry.actual)) continue;
      const actualSymbol = semantics.declarations.typeSymbol(entry.actual);
      if (actualSymbol !== undefined && semantics.declarations.symbolDeclarations(actualSymbol)
        .some(declaration => parameters.has(declaration))) continue;
      if (semantics.types.isUnion(entry.actual) || semantics.types.isIntersection(entry.actual)) {
        for (const part of semantics.types.unionOrIntersectionTypes(entry.actual)) instance(entry.site, entry.parameter, part, entry.operation);
        continue;
      }
      const awaited = semantics.types.awaitedType(entry.actual);
      if (awaited === undefined) return sourceDeclarationOwnershipUnresolved(entry.site, "Generic completion requires its exact checked native result relation.");
      if (semantics.types.isIdentical(awaited, entry.actual)) continue;
      const operation = entry.operation ?? sensitive(entry.parameter);
      if (operation === undefined) return failure ?? budget.failure() ??
        sourceDeclarationOwnershipUnresolved(entry.site, "The finite declared generic relation is incomplete.");
      if (operation === null || issuedSites.has(entry.site)) continue;
      const declaration = parameters.get(entry.parameter)!.owner;
      const formatted = format(entry.site, declaration, operation);
      if (formatted === undefined) return sourceDeclarationOwnershipUnresolved(entry.site, "Generic diagnostics require their original checked spans.");
      if (!rows.add(1)) return budget.failure()!;
      issuedSites.add(entry.site);
      issues.push(Object.freeze({ site: entry.site, parameter: entry.parameter, declaration, operation, ...formatted }));
    }
    return failure ?? Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
  } finally { rows.release(); }
}
