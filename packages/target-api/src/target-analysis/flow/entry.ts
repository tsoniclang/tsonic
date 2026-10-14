import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { sourceStorageInstanceInitializers } from "../source-storage/model/construction.js";
import type { SourceControlFlowOptions, SourceFlowExecutionRegion } from "./model.js";
import { SourceFlowFailure } from "./resources.js";

interface SourceFlowEntry {
  readonly body: Node | undefined;
  readonly parameters: readonly (Node | undefined)[];
  readonly parameterInitializers: ReadonlySet<Node> | undefined;
  readonly executionRegions: ReadonlyMap<Node, SourceFlowExecutionRegion>;
  readonly entryInitializers: readonly Node[];
  readonly superInitializers: readonly Node[];
  readonly completionInitializers: readonly Node[];
  readonly syntaxRoots: readonly Node[];
}

export function sourceFlowEntry(source: TargetSourceProgram, declaration: Node,
  invocation: SourceControlFlowOptions["invocation"], step: (node?: Node) => void): SourceFlowEntry {
  const { ast } = source;
  const body = ast.body(declaration);
  const classRoot = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
  const executionRegions = new Map<Node, SourceFlowExecutionRegion>();
  let parameterInitializers: ReadonlySet<Node> | undefined;
  if (invocation !== undefined) {
    if (invocation === null || typeof invocation !== "object" ||
      Object.keys(invocation).some(key => key !== "storage" && key !== "call" && key !== "callerBindings")) {
      throw new SourceFlowFailure("Source flow invocation entry requires checked storage and its actual call, not a region list.", declaration);
    }
    const { storage, call } = invocation;
    if (storage === undefined || storage.source !== source) {
      throw new SourceFlowFailure("Source flow invocation entry requires storage from the identical checked source program.", call);
    }
    if (classRoot || ast.is.IsConstructorDeclaration(declaration)) {
      const construction = storage.constructionFor(call, invocation.callerBindings);
      if (construction.kind === "unresolved") throw new SourceFlowFailure(construction.reason, call);
      const implementation = construction.implementation;
      if (declaration !== (implementation?.declaration ?? construction.root)) {
        throw new SourceFlowFailure("Constructor flow requires the actual checked construction implementation.", call);
      }
      for (const selected of construction.classes) for (const region of selected.regions) {
        step(region.node);
        executionRegions.set(region.node, Object.freeze({ owner: selected.owner, selection: region.selection }));
      }
      if (implementation !== undefined) for (const region of implementation.regions) {
        step(region);
        executionRegions.set(region, Object.freeze({ owner: implementation.declaration, selection: implementation.selection }));
      }
      const terminal = construction.classes[construction.classes.length - 1]!;
      const heritage = source.navigation.declaredHeritage(terminal.owner);
      if (heritage.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, terminal.owner);
      const derived = heritage.edges.some(edge => edge.kind === "extends");
      const fields = terminal.regions.map(region => region.node);
      return { body: implementation?.body, parameters: implementation === undefined ? [] : ast.parameters(implementation.declaration),
        parameterInitializers: new Set(implementation?.regions ?? []), executionRegions,
        entryInitializers: derived ? [] : fields, superInitializers: derived ? fields : [],
        completionInitializers: construction.classes.slice(0, -1).reverse().flatMap(selected => selected.regions.map(region => region.node)),
        syntaxRoots: construction.classes.flatMap(selected => selected.regions.map(region => region.node)) };
    }
    const callerBindings = invocation.callerBindings ?? storage.emptyBindings;
    const implementations = storage.invocationImplementationsFor(call, callerBindings);
    if (implementations.kind === "unresolved") throw new SourceFlowFailure(implementations.reason, call);
    if (!implementations.nodes.includes(declaration)) {
      throw new SourceFlowFailure("Source flow invocation entry requires the actual selected callable implementation.", call);
    }
    const regions = storage.executionRegionsFor(declaration, call, callerBindings);
    if (regions.kind === "unresolved") throw new SourceFlowFailure(regions.reason, call);
    const bound = storage.bindingsForInvocation(declaration, call, callerBindings);
    const allowed = new Set<Node>(body === undefined ? [] : [body]);
    for (const parameter of ast.parameters(declaration)) {
      step(parameter);
      const initializer = parameter === undefined ? undefined : Node_Initializer(ast, parameter);
      if (initializer !== undefined) allowed.add(initializer);
    }
    if (body !== undefined && !regions.nodes.includes(body)) {
      throw new SourceFlowFailure("Source flow invocation entry requires its checked callable body.", call);
    }
    for (const region of regions.nodes) {
      step(region);
      if (!allowed.has(region)) throw new SourceFlowFailure("Source flow invocation entry contains a foreign body or initializer region.", region);
      executionRegions.set(region, Object.freeze({ owner: declaration, selection: bound }));
    }
    parameterInitializers = new Set(regions.nodes);
  }
  if (body === undefined || classRoot) throw new SourceFlowFailure("Source flow requires an implemented checked callable body.", declaration);
  const owner = ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined;
  const fields = owner === undefined ? [] : sourceStorageInstanceInitializers(owner, source, () => { step(owner); return true; });
  const heritage = owner === undefined ? undefined : source.navigation.declaredHeritage(owner);
  if (heritage?.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, owner);
  const derived = heritage?.edges.some(edge => edge.kind === "extends") ?? false;
  return { body, parameters: ast.parameters(declaration), parameterInitializers, executionRegions,
    entryInitializers: derived ? [] : fields, superInitializers: derived ? fields : [], completionInitializers: [], syntaxRoots: fields };
}
