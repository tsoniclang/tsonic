import { providerVirtualDeclarationFactKey, type Node, type Type } from "@tsonic/tsts";
import { isAbsolute, relative } from "node:path";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import { isTsonicSourceProfileDeclarationPath } from "../../source-profile.js";
import { sourceCallableDefinitionIsDiscarded, sourceEnclosingCallable, sourceLexicalFunctionIsUnused,
  sourceNodesOutsideErasedSubtrees } from "../../source-navigation/index.js";
import type { ResolvedSourceCallInfo, SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceDiagnosticSpanReader } from "../../source-semantics/diagnostic-spans.js";
import { createTargetGraphComponentQuery } from "../graph-component-query.js";
import type { SourceOwnershipBudget, SourceOwnershipUnresolved } from "./model.js";

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

interface Parameter {
  readonly declaration: Node;
  readonly type: Type;
  readonly owner: Node;
  readonly neighbours: Set<Node>;
  operation: Node | undefined;
}

interface Instantiation {
  readonly site: Node;
  readonly parameter: Node;
  readonly actual: Type;
}

export function analyzeSourceGenericAdoption(input: {
  readonly source: TargetSourceProgram;
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly budget: SourceOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] } | SourceOwnershipUnresolved {
  const { source, budget } = input;
  const { ast } = source;
  const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node =>
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
      ? sourceCallableDefinitionIsDiscarded(node, ast) : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
  if (domain.kind === "unresolved") {
    const at = input.nodes[0] ?? source.sourceFiles[0];
    if (at === undefined) return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
    return Object.freeze({ kind: "unresolved", at, reason: domain.reason });
  }
  const nodes = domain.nodes;
  const parameters = new Map<Node, Parameter>();
  const instances: Instantiation[] = [];
  const sites = new Map<Node, Set<Node>>();
  const rows = budget.createRows();
  let failure: SourceOwnershipUnresolved | undefined;
  const refuse = (at: Node, reason: string): undefined => {
    failure ??= Object.freeze({ kind: "unresolved", at, reason });
    return undefined;
  };
  const step = (at: Node): boolean => budget.step() ||
    refuse(at, budget.failure() ?? "Generic adoption requires its complete bounded source summary.") !== undefined;
  const primitive = (type: Type, semantics: SourceFileSemantics, active = new Set<Type>()): boolean => {
    if (!step(semantics.sourceFile) || active.has(type)) return false;
    if (semantics.types.isStringLike(type) || semantics.types.isNumberLike(type) || semantics.types.isBooleanLike(type) ||
      semantics.types.isBigIntLike(type) || semantics.types.isSymbolLike(type) || semantics.types.isNullish(type) ||
      semantics.types.isVoidLike(type) || semantics.types.isNever(type)) return true;
    if (!semantics.types.isUnion(type)) return false;
    active.add(type);
    const parts = semantics.types.unionOrIntersectionTypes(type);
    const selected = parts.length > 0 && parts.every(part => primitive(part, semantics, active));
    active.delete(type);
    return selected;
  };
  for (const node of nodes) {
    if (!step(node)) break;
    if (!ast.is.IsTypeParameterDeclaration(node) || !source.navigation.isProjectDeclaration(node) ||
      input.exemptTypeParameter?.(node) === true) continue;
    const owner = ast.parent(node);
    const semantics = source.semantics.forNode(node);
    const constraint = ast.as.AsTypeParameterDeclaration(node)?.Constraint;
    const constraintType = constraint === undefined ? undefined : semantics.types.authoredType(constraint);
    if (constraintType !== undefined && primitive(constraintType, semantics)) continue;
    const type = semantics.declarations.declaredType(node);
    if (owner === undefined || type === undefined) {
      refuse(node, "A generic adoption summary requires the actual checked parameter and its declaration.");
      break;
    }
    if (!rows.add(2)) { refuse(node, budget.failure()!); break; }
    parameters.set(node, { declaration: node, owner, type, neighbours: new Set(), operation: undefined });
  }
  if (failure !== undefined) { rows.release(); return failure; }
  if (parameters.size === 0) { rows.release(); return Object.freeze({ kind: "resolved", issues: Object.freeze([]) }); }
  const topLevelParameters = (type: Type, semantics: SourceFileSemantics): ReadonlySet<Node> | undefined => {
    const found = new Set<Node>();
    const active = new Set<Type>();
    const visit = (selected: Type): void => {
      if (!step(semantics.sourceFile) || active.has(selected)) return;
      active.add(selected);
      const symbol = semantics.declarations.typeSymbol(selected);
      const declarations = symbol === undefined ? [] : semantics.declarations.symbolDeclarations(symbol);
      for (const declaration of declarations) if (parameters.has(declaration)) found.add(declaration);
      if (declarations.some(declaration => ast.is.IsTypeParameterDeclaration(declaration))) return;
      if (semantics.types.isUnion(selected)) {
        for (const part of semantics.types.unionOrIntersectionTypes(selected)) visit(part);
        return;
      }
      const awaited = semantics.types.awaitedType(selected);
      if (awaited === undefined) {
        refuse(semantics.sourceFile, "Generic adoption requires the checker's completed Awaited type.");
        return;
      }
      if (semantics.types.isIdentical(awaited, selected)) return;
      visit(awaited);
      const arguments_ = semantics.types.aliasApplication(selected)?.bindings.map(binding => binding.argument) ??
        semantics.types.typeArguments(selected);
      for (const argument of arguments_) {
        if (!step(semantics.sourceFile)) return;
        const awaitedArgument = semantics.types.awaitedType(argument);
        if (awaitedArgument !== undefined && semantics.types.isIdentical(awaitedArgument, awaited)) visit(argument);
      }
    };
    visit(type);
    return failure === undefined ? found : undefined;
  };
  const markType = (operation: Node, type: Type, semantics: SourceFileSemantics): void => {
    for (const parameter of topLevelParameters(type, semantics) ?? []) {
      const selected = parameters.get(parameter)!;
      selected.operation ??= operation;
    }
  };
  const mark = (operation: Node, expression: Node): void => {
    const semantics = source.semantics.forNode(expression);
    const type = semantics.types.expressionType(expression);
    if (type === undefined) { refuse(expression, "A generic adoption operation requires its checked value type."); return; }
    markType(operation, type, semantics);
  };
  const sourceParameter = (type: Type, semantics: SourceFileSemantics): Node | undefined => {
    const symbol = semantics.declarations.typeSymbol(type);
    return symbol === undefined ? undefined : semantics.declarations.symbolDeclarations(symbol).find(node => parameters.has(node));
  };
  const addInstance = (site: Node, parameter: Node, actual: Type): void => {
    if (!parameters.has(parameter) || sites.get(site)?.has(parameter)) return;
    if (!rows.add(1)) { refuse(site, budget.failure()!); return; }
    const selected = sites.get(site) ?? new Set<Node>();
    selected.add(parameter);
    sites.set(site, selected);
    instances.push(Object.freeze({ site, parameter, actual }));
    const semantics = source.semantics.forNode(site);
    for (const forwarded of topLevelParameters(actual, semantics) ?? []) {
      const origin = parameters.get(forwarded)!;
      if (!origin.neighbours.has(parameter) && !rows.add(1)) { refuse(site, budget.failure()!); return; }
      origin.neighbours.add(parameter);
    }
  };
  const canonicalPromiseMember = (declaration: Node): string | undefined => {
    const fact = source.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
    if (fact?.providerId === "tsonic.js.source-virtual-modules" &&
      (fact.exportName === "Promise" || fact.exportName === "PromiseConstructor")) {
      return fact.memberKey?.kind === "property-key" ? fact.memberKey.name : fact.memberName ?? "construct";
    }
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !ast.isDeclarationFile(file) || source.navigation.isProjectDeclaration(declaration) ||
      !(isTsonicSourceProfileDeclarationPath(ast.getFileName(file)) ||
        source.semantics.forNode(declaration).declarations.isDefaultLibraryDeclaration(declaration))) return undefined;
    const owner = ast.parent(declaration);
    const ownerName = ast.text(ast.name(owner));
    if (ownerName !== "Promise" && ownerName !== "PromiseConstructor") return undefined;
    return ast.is.IsConstructSignatureDeclaration(declaration) ? "construct" : ast.text(ast.name(declaration));
  };
  const reactionBodies = new Set<Node>();
  const resolvers = new Set<Node>();
  const calls: { readonly node: Node; readonly selected: ResolvedSourceCallInfo; readonly declaration: Node }[] = [];
  for (const node of nodes) {
    if (!step(node)) break;
    if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) continue;
    const semantics = source.semantics.forNode(node);
    const selected = semantics.operations.call(node);
    const declaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (selected === undefined || declaration === undefined) continue;
    calls.push({ node, selected, declaration });
    const member = canonicalPromiseMember(declaration);
    if (member === "resolve") {
      const value = ast.arguments(node)[0];
      if (value !== undefined) mark(node, value);
    } else if (member === "construct") {
      const executor = ast.arguments(node)[0];
      if (executor !== undefined) {
        const type = semantics.types.expressionType(executor);
        if (type === undefined) { refuse(executor, "A Promise executor requires its actual checked callable signature."); continue; }
        for (const signature of semantics.types.signatureInfos(type, "call")) {
          const declaration = semantics.declarations.signatureDeclaration(signature.signature);
          if (declaration === undefined) continue;
          const implementation = source.navigation.callableImplementation(declaration);
          const owner = implementation.kind === "resolved" ? implementation.implementation.declaration : declaration;
          const resolve = ast.parameters(owner)[0];
          if (resolve !== undefined) resolvers.add(resolve);
        }
      }
    } else if (member === "then" || member === "catch" || member === "finally") {
      for (const callback of ast.arguments(node)) {
        if (callback === undefined) continue;
        if (ast.body(callback) !== undefined) reactionBodies.add(callback);
        const type = semantics.types.expressionType(callback);
        if (type !== undefined) for (const signature of semantics.types.signatureInfos(type, "call"))
          if (signature.returnType !== undefined) markType(node, signature.returnType, semantics);
      }
    }
  }
  for (const node of nodes) {
    if (!step(node)) break;
    if (ast.is.IsAwaitExpression(node)) {
      const value = ast.as.AsAwaitExpression(node)?.Expression;
      if (value !== undefined) mark(node, value);
    } else if (ast.is.IsReturnStatement(node)) {
      const owner = sourceEnclosingCallable(node, ast);
      const value = ast.as.AsReturnStatement(node)?.Expression;
      if (owner !== undefined && value !== undefined && (ast.hasModifierKind(owner, "async") || reactionBodies.has(owner)))
        mark(node, value);
    } else if (ast.is.IsArrowFunction(node)) {
      const body = ast.body(node);
      if (body !== undefined && !ast.is.IsBlock(body) && (ast.hasModifierKind(node, "async") || reactionBodies.has(node)))
        mark(body, body);
    }
  }
  for (const { node, selected, declaration } of calls) {
    if (!step(node)) break;
    const semantics = source.semantics.forNode(node);
    const callee = selected.sourceCallee.expression;
    let reference = callee;
    const aliases = new Set<Node>();
    let resolver = false;
    while (!aliases.has(reference) && step(reference)) {
      aliases.add(reference);
      if (ast.is.IsParenthesizedExpression(reference)) {
        const expression = ast.as.AsParenthesizedExpression(reference)?.Expression;
        if (expression === undefined) break;
        reference = expression;
        continue;
      }
      const referenced = source.navigation.sourceReferenceFor(reference)?.declaration;
      if (referenced === undefined) break;
      if (resolvers.has(referenced)) { resolver = true; break; }
      const initializer = ast.is.IsVariableDeclaration(referenced)
        ? ast.as.AsVariableDeclaration(referenced)?.Initializer : undefined;
      if (initializer === undefined || source.navigation.declarationUseSummary(referenced).bindingWritten) break;
      reference = initializer;
    }
    if (resolver) {
      const argument = ast.arguments(node)[0];
      if (argument !== undefined) mark(node, argument);
    }
    for (const argument of selected.sourceSelectedMethodTypeArguments ?? []) {
      const parameter = sourceParameter(argument.typeParameter, semantics);
      if (parameter !== undefined) addInstance(node, parameter, argument.selectedType);
    }
    if (ast.is.IsNewExpression(node)) for (const binding of semantics.types.typeArgumentBindings(selected.sourceResultType) ?? [])
      addInstance(node, binding.declaration, binding.argumentType);
    if (!source.navigation.isProjectDeclaration(declaration)) continue;
    const implementation = source.navigation.callableImplementation(declaration);
    if (implementation.kind !== "resolved") continue;
    const formals = ast.typeParameters(declaration);
    const targets = ast.typeParameters(implementation.implementation.declaration);
    for (const [index, formal] of formals.entries()) {
      const target = targets[index];
      if (formal !== undefined && target !== undefined && formal !== target && parameters.has(formal) && parameters.has(target)) {
        const neighbours = parameters.get(formal)!.neighbours;
        if (!neighbours.has(target) && !rows.add(1)) { refuse(node, budget.failure()!); break; }
        neighbours.add(target);
      }
    }
  }
  const sensitive = createTargetGraphComponentQuery<Node, Node | undefined, Node | null>(parameter => {
    const selected = parameters.get(parameter);
    if (selected === undefined || !step(parameter)) return undefined;
    const owner = selected.owner;
    const implementation = source.navigation.callableImplementation(owner);
    const bodyOwner = implementation.kind === "resolved" ? implementation.implementation.declaration : owner;
    const known = ast.body(bodyOwner) !== undefined || ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner);
    return { data: selected.operation ?? (known ? undefined : owner), neighbours: selected.neighbours };
  }, members => members.find(member => member.data !== undefined)?.data ??
    members.flatMap(member => member.successors).find(operation => operation !== null) ?? null, budget);
  const readSpan = createSourceDiagnosticSpanReader(ast);
  const sourceSpanFor = (node: Node): TargetDiagnosticSourceSpan | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !source.semantics.includes(file)) return undefined;
    const span = readSpan(file, ast.pos(node), ast.end(node));
    if (span === undefined) return undefined;
    const fileName = (isAbsolute(span.fileName) ? relative(input.projectRoot, span.fileName) : span.fileName)
      .split("\\").join("/");
    return Object.freeze({ ...span, fileName });
  };
  const formatDiagnostic = (site: Node, declaration: Node, operation: Node) => {
    const sourceSpan = sourceSpanFor(site);
    const declarationSpan = sourceSpanFor(declaration);
    const operationSpan = sourceSpanFor(operation);
    if (sourceSpan === undefined || declarationSpan === undefined || operationSpan === undefined) return undefined;
    return Object.freeze({ sourceSpan, evidence: Object.freeze([
      `declaration ${declarationSpan.fileName}:${declarationSpan.line}:${declarationSpan.column}`,
      `first-sensitive-operation ${operationSpan.fileName}:${operationSpan.line}:${operationSpan.column}`,
    ]) });
  };
  const issues: SourceGenericAdoptionIssue[] = [];
  for (const instance of instances) {
    if (!step(instance.site)) break;
    const semantics = source.semantics.forNode(instance.site);
    if (semantics.types.isAny(instance.actual) || semantics.types.isUnknown(instance.actual)) continue;
    const open = topLevelParameters(instance.actual, semantics);
    if (open === undefined || open.size !== 0) continue;
    const awaited = semantics.types.awaitedType(instance.actual);
    if (awaited === undefined) { refuse(instance.site, "Generic instantiation requires its completed native Awaited selection."); break; }
    if (semantics.types.isIdentical(awaited, instance.actual)) continue;
    const operation = sensitive(instance.parameter);
    if (operation === undefined) { refuse(instance.site, budget.failure() ?? "The bounded generic adoption summary is incomplete."); break; }
    if (operation === null || issues.some(issue => issue.site === instance.site)) continue;
    const declaration = parameters.get(instance.parameter)!.owner;
    const formatted = formatDiagnostic(instance.site, declaration, operation);
    if (formatted === undefined) { refuse(instance.site, "Generic adoption diagnostics require their exact checked source spans."); break; }
    issues.push(Object.freeze({ site: instance.site, parameter: instance.parameter, declaration, operation,
      ...formatted }));
  }
  rows.release();
  return failure ?? Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
}
