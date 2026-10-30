import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceNodeDomain } from "../../source-navigation/lexical-captures.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/callable-boundaries.js";
import { sourceNodesOutsideErasedSubtrees } from "../../source-navigation/callable-invocations.js";
import { sourceFlowPattern } from "./bindings.js";
import { createSourceFlowCaptureQuery } from "./captures.js";
import { createSourceFlowConstruction, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { sourceDeclarationFlowEntry, sourceFlowEntry, type SourceFlowEntry, type SourceFlowInitializer } from "./entry.js";
import { sourceFlowExpression } from "./expressions.js";
import type { SourceControlFlowOptions, SourceControlFlowSelectedDomain, SourceControlFlowSelection,
  SourceDeclarationControlFlowOptions, SourceDeclarationFlowExecutionRegion, SourceFlowUnresolved } from "./model.js";
import { SourceFlowFailure, sourceFlowLimits } from "./resources.js";
import { sourceFlowStatement } from "./statements.js";

const sourceControlFlowDomains = new WeakMap<SourceControlFlowSelectedDomain, {
  readonly domain: SourceControlFlowSelectedDomain;
  readonly source: TargetSourceProgram;
  readonly members: ReadonlySet<Node>;
}>();

export function createSourceControlFlowDomain(source: TargetSourceProgram, nodes: readonly Node[]):
  | { readonly kind: "resolved"; readonly domain: SourceControlFlowSelectedDomain }
  | SourceFlowUnresolved {
  const fail = (reason: string, node?: Node): SourceFlowUnresolved => Object.freeze({ kind: "unresolved", reason, source: node });
  if (!Array.isArray(nodes)) return fail("Source flow requires an explicit dense checked selected-node inventory.");
  for (let index = 0; index < nodes.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(nodes, index) || nodes[index] === undefined || nodes[index] === null)
      return fail("Source flow requires an explicit dense checked selected-node inventory.");
  }
  const selected = sourceNodesOutsideErasedSubtrees(source.ast, nodes, () => false);
  if (selected.kind === "unresolved") return fail(selected.reason);
  const files = new Set<Node>(source.sourceFiles);
  const children = new Map<Node, ReadonlySet<Node>>();
  for (const node of selected.nodes) {
    const parent = source.ast.parent(node);
    if (parent === undefined) {
      if (!files.has(node)) return fail("Source flow selected nodes must belong to the identical checked source program.", node);
      continue;
    }
    let actual = children.get(parent);
    if (actual === undefined) {
      actual = new Set(source.ast.children(parent).filter((child): child is Node => child !== undefined));
      children.set(parent, actual);
    }
    if (!actual.has(node)) return fail("Source flow requires each original checked parent/child identity in its selected domain.", node);
  }
  const domain = Object.freeze({ kind: "selected", source, nodes: selected.nodes } satisfies SourceControlFlowSelectedDomain);
  sourceControlFlowDomains.set(domain, Object.freeze({ domain, source, members: new Set(selected.nodes) }));
  return Object.freeze({ kind: "resolved", domain });
}

type PatternKey = Node | string | number | boolean | undefined;
interface PatternContinuation {
  readonly children: Map<PatternKey, PatternContinuation>;
  entry: number | undefined;
}

export function createSourceControlFlow(source: TargetSourceProgram, declaration: Node,
  options: SourceControlFlowOptions): SourceControlFlowSelection {
  return createControlFlow(source, declaration, options, ["domain", "limits", "invocation"],
    step => sourceFlowEntry(source, declaration, options.invocation, step));
}

export function createSourceDeclarationControlFlow(source: TargetSourceProgram, declaration: Node,
  options: SourceDeclarationControlFlowOptions): SourceControlFlowSelection<SourceDeclarationFlowExecutionRegion> {
  return createControlFlow(source, declaration, options, ["domain", "limits"],
    step => sourceDeclarationFlowEntry(source, declaration, step));
}

function createControlFlow<Region>(source: TargetSourceProgram, declaration: Node,
  options: SourceDeclarationControlFlowOptions, allowedOptions: readonly string[],
  entryFor: (step: (node?: Node) => void) => SourceFlowEntry<Region>): SourceControlFlowSelection<Region> {
  try {
    const { ast } = source;
    const propertyRoot = ast.is.IsPropertyDeclaration(declaration);
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !source.sourceFiles.includes(file) ||
      !isSourceCallableBodyBoundary(ast, declaration) && !propertyRoot &&
      !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration) && !ast.is.IsSourceFile(declaration)) {
      throw new SourceFlowFailure("Source flow requires a callable from the exact checked source program.", declaration);
    }
    if (options === null || typeof options !== "object" ||
      Reflect.ownKeys(options).some(key => typeof key !== "string" || !allowedOptions.includes(key)) ||
      !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(options, "domain") ?? {}, "value")) {
      throw new SourceFlowFailure("Source flow requires explicit limits, checked invocation options and an explicit source domain.", declaration);
    }
    const domain = options.domain;
    if (domain === undefined || domain === null || typeof domain !== "object" ||
      !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(domain, "kind") ?? {}, "value"))
      throw new SourceFlowFailure("Source flow requires an explicit checked source or canonical selected domain.", declaration);
    let included: SourceNodeDomain;
    if (domain.kind === "source" && Reflect.ownKeys(domain).length === 1) included = "source";
    else if (domain.kind === "selected") {
      const selected = sourceControlFlowDomains.get(domain);
      if (selected === undefined || selected.domain !== domain || selected.source !== source)
        throw new SourceFlowFailure("Source flow selected domain must come from its original checked inventory boundary.", declaration);
      included = selected.members;
      if (!included.has(declaration)) throw new SourceFlowFailure("Source flow requires its requested root in the canonical selected domain.", declaration);
    } else throw new SourceFlowFailure("Source flow selected domain must come from its original checked inventory boundary.", declaration);
    const includes = (node: Node): boolean => included === "source" || included.has(node);
    const selectedLimits = sourceFlowLimits(options.limits ?? {});
    const owner = createSourceFlowConstruction<Region>(declaration, selectedLimits);
    const selectedEntry = entryFor(owner.step);
    for (const root of selectedEntry.rootExecutions.keys()) {
      owner.step(root);
      if (!includes(root)) throw new SourceFlowFailure("Declaration flow requires each exact region root in its checked source domain.", root);
    }
    const { body, parameterInitializers, superInitializers, bodyExecution } = selectedEntry;
    const pending = (propertyRoot ? selectedEntry.syntaxRoots : [declaration, ...selectedEntry.syntaxRoots])
      .map(node => ({ node, depth: 0 }));
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (!includes(current.node)) {
        if (propertyRoot) throw new SourceFlowFailure("Property initializer flow requires its complete initializer in the checked source domain.", current.node);
        continue;
      }
      owner.step(current.node);
      if (current.depth >= selectedLimits.maximumDepth) {
        throw new SourceFlowFailure("Source flow exceeds its finite syntax depth budget.", current.node,
          { subject: declaration, dimension: "maximumDepth", limit: selectedLimits.maximumDepth });
      }
      for (const child of ast.children(current.node)) {
        if (child !== undefined) pending.push({ node: child, depth: current.depth + 1 });
      }
    }
    const initialize = (initializers: readonly SourceFlowInitializer<Region>[], next: number, context: SourceFlowContext): number => {
      let entry = next;
      for (let index = initializers.length - 1; index >= 0; index -= 1) {
        const selected = initializers[index]!;
        entry = owner.withExecution(selected.execution, () => build.expression(selected.node, entry, context));
      }
      return entry;
    };
    let patternWave: { readonly context: SourceFlowContext; readonly root: PatternContinuation } | undefined;
    const withinRoot = <Result>(node: Node, visit: () => Result): Result => {
      const execution = selectedEntry.rootExecutions.get(node);
      return execution === undefined ? visit() : owner.withExecution(execution, visit);
    };
    const build: SourceFlowConstruction = { source, parameterInitializers, includes,
      initializeSuper: (next, context) => initialize(superInitializers, next, context),
      captures: createSourceFlowCaptureQuery(source, owner.step, included),
      point: owner.point, edge: owner.edge, emit: owner.emit, step: owner.step,
      expression: (node, next, context) => includes(node) ? withinRoot(node, () => owner.nested(node, () => sourceFlowExpression(build, node, next, context))) : next,
      statement: (node, next, context) => includes(node) ? withinRoot(node, () => owner.nested(node, () => sourceFlowStatement(build, node, next, context))) : next,
      pattern: (node, next, context, initialization, value) => includes(node) ? withinRoot(node, () => owner.nested(node, () => {
        const previous = patternWave;
        const wave = previous?.context === context ? previous : {
          context, root: { children: new Map<PatternKey, PatternContinuation>(), entry: undefined },
        };
        patternWave = wave;
        try {
          let selected = wave.root;
          const select = (key: PatternKey): void => {
            owner.step(node);
            let child = selected.children.get(key);
            if (child === undefined) {
              child = { children: new Map(), entry: undefined };
              selected.children.set(key, child);
            }
            selected = child;
          };
          select(node);
          select(value?.kind);
          select(value?.expression);
          for (const part of value?.projection ?? []) select(part);
          select(next);
          select(initialization);
          if (selected.entry !== undefined) return selected.entry;
          const entry = sourceFlowPattern(build, node, next, context, initialization, value);
          selected.entry = entry;
          return entry;
        } finally {
          patternWave = previous;
        }
      })) : next,
    };
    const exit = build.point(declaration, { kind: "exit" });
    const exceptionExit = build.point(declaration, { kind: "exception-exit" });
    const context: SourceFlowContext = { returnTo: exit, throwTo: exceptionExit, breaks: new Map(), continues: new Map() };
    const completion = initialize(selectedEntry.completionInitializers, exit, context);
    const bodyContext = { ...context, returnTo: completion };
    let entry = owner.withExecution(bodyExecution, () => {
      let entry = body === undefined ? completion : ast.is.IsBlock(body) || ast.is.IsSourceFile(body) ? build.statement(body, completion, bodyContext)
        : build.expression(body, build.emit(body, { kind: "return" }, completion, bodyContext, false, "return"), bodyContext);
      const implicit = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
      const parameters = selectedEntry.parameters;
      const receiver = implicit || propertyRoot || ast.is.IsSourceFile(declaration) ? undefined : source.semantics.forFile(file).types.declarationSignatureInfo(declaration)?.thisParameter?.declaration;
      for (let index = parameters.length - 1; index >= 0; index -= 1) {
        const parameter = parameters[index];
        if (parameter !== undefined && parameter !== receiver) entry = build.pattern(parameter, entry, context, true, undefined);
      }
      return entry;
    });
    entry = initialize(selectedEntry.entryInitializers, entry, context);
    const root = build.point(declaration, { kind: "entry" });
    build.edge(root, entry);
    return Object.freeze({ kind: "resolved", graph: owner.finish(root, exit, exceptionExit) });
  } catch (error) {
    if (!(error instanceof SourceFlowFailure)) throw error;
    return Object.freeze({ kind: "unresolved", reason: error.message, source: error.source,
      ...(error.resource === undefined ? {} : { resource: error.resource }) });
  }
}
