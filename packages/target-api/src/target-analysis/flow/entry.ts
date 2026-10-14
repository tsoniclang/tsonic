import type { Node } from "@tsonic/tsts";
import { Node_Initializer, sourceClassFieldIsTypeOnly } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { sourceStorageClassValue, sourceStorageConstructedClass, sourceStorageSuperConstructor } from "../source-storage/model/construction.js";
import type { SourceStorageBindings, SourceStorageQueries } from "../source-storage/model/types.js";
import type { SourceControlFlowOptions, SourceFlowExecutionRegion } from "./model.js";
import { SourceFlowFailure } from "./resources.js";

interface SourceFlowEntry {
  readonly body: Node | undefined;
  readonly parameterInitializers: ReadonlySet<Node> | undefined;
  readonly executionRegions: ReadonlyMap<Node, SourceFlowExecutionRegion>;
  readonly entryInitializers: readonly Node[];
  readonly superInitializers: readonly Node[];
}

export function sourceFlowEntry(source: TargetSourceProgram, declaration: Node,
  invocation: SourceControlFlowOptions["invocation"], step: (node?: Node) => void): SourceFlowEntry {
  const { ast } = source;
  const body = ast.body(declaration);
  const implicit = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
  const constructorClass = implicit ? declaration : ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined;
  const executionRegions = new Map<Node, SourceFlowExecutionRegion>();
  let parameterInitializers: ReadonlySet<Node> | undefined;
  let callerBindings: SourceStorageBindings | undefined;
  if (invocation !== undefined) {
    if (invocation === null || typeof invocation !== "object" ||
      Object.keys(invocation).some(key => key !== "storage" && key !== "call" && key !== "callerBindings")) {
      throw new SourceFlowFailure("Source flow invocation entry requires checked storage and its actual call, not a region list.", declaration);
    }
    const { storage, call } = invocation;
    if (storage === undefined || storage.source !== source) {
      throw new SourceFlowFailure("Source flow invocation entry requires storage from the identical checked source program.", call);
    }
    callerBindings = invocation.callerBindings ?? storage.emptyBindings;
    const implementations = storage.invocationImplementationsFor(call, callerBindings);
    if (implementations.kind === "unresolved") throw new SourceFlowFailure(implementations.reason, call);
    if (!implicit && !implementations.nodes.includes(declaration) || implicit &&
      sourceStorageConstructedClass(call, source, () => { step(call); return true; }) !== declaration) {
      throw new SourceFlowFailure("Source flow invocation entry requires the actual selected callable implementation.", call);
    }
    const regions = storage.executionRegionsFor(declaration, call, callerBindings);
    if (regions.kind === "unresolved") throw new SourceFlowFailure(regions.reason, call);
    const bound = storage.bindingsForInvocation(declaration, call, callerBindings);
    const allowed = new Set<Node>(body === undefined ? [] : [body]);
    for (const parameter of implicit ? [] : ast.parameters(declaration)) {
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
  if (constructorClass === undefined) {
    if (body === undefined) throw new SourceFlowFailure("Source flow requires an implemented checked callable body.", declaration);
    return { body, parameterInitializers, executionRegions, entryInitializers: [], superInitializers: [] };
  }
  if (!ast.is.IsClassDeclaration(constructorClass) && !ast.is.IsClassExpression(constructorClass)) {
    throw new SourceFlowFailure("Constructor flow requires its actual checked class owner.", declaration);
  }
  const heritage = source.navigation.declaredHeritage(constructorClass);
  if (heritage.kind !== "resolved") throw new SourceFlowFailure(heritage.reason, constructorClass);
  const bases = heritage.edges.filter(edge => edge.kind === "extends");
  if (implicit) {
    const constructors = source.navigation.classConstructors(declaration);
    if (invocation === undefined || constructors.kind !== "resolved" || !constructors.implicit) {
      throw new SourceFlowFailure("An implicit constructor flow requires its exact checked allocation and constructor selection.", declaration);
    }
    if (bases.length !== 0) {
      throw new SourceFlowFailure("Implicit heritage construction requires checked inherited execution-region and argument correspondence.", declaration);
    }
  } else if (body === undefined) {
    throw new SourceFlowFailure("Source flow requires an implemented checked constructor body.", declaration);
  }
  const initializers: Node[] = [];
  for (const member of ast.members(constructorClass)) {
    step(member);
    if (member === undefined || !ast.is.IsPropertyDeclaration(member) || ast.hasModifierKind(member, "static") ||
      sourceClassFieldIsTypeOnly(ast, member)) continue;
    const initializer = Node_Initializer(ast, member);
    if (initializer !== undefined) initializers.push(initializer);
  }
  if (invocation !== undefined) {
    const { storage, call } = invocation;
    const allocation = sourceFlowAllocation(source, storage, call, callerBindings!, step);
    const constructed = sourceStorageConstructedClass(allocation.call, source, () => { step(call); return true; });
    const entered = ast.is.IsNewExpression(call) ? constructed
      : sourceStorageClassValue(sourceStorageSuperConstructor(call, source, () => { step(call); return true; })?.callee,
        source, () => { step(call); return true; });
    if (entered !== constructorClass) {
      throw new SourceFlowFailure("Inherited construction requires checked intermediate constructor execution-region correspondence.", call);
    }
    const inventory = storage.instanceRegionsFor(allocation.call);
    if (inventory.kind === "unresolved") throw new SourceFlowFailure(inventory.reason, call);
    const owned = inventory.regions.filter(region => region.owner === constructorClass);
    const identities = new Set(owned.map(region => region.node));
    if (identities.size !== owned.length || identities.size !== initializers.length || initializers.some(node => !identities.has(node))) {
      throw new SourceFlowFailure("Constructor flow requires its exact class-owned instance initializer identities.", call);
    }
    if (initializers.length !== 0) {
      const bound = storage.bindingsForInvocation(constructorClass, allocation.call, allocation.callerBindings);
      for (const initializer of initializers) {
        executionRegions.set(initializer, Object.freeze({ owner: constructorClass, selection: bound }));
      }
    }
  }
  return { body, parameterInitializers, executionRegions,
    entryInitializers: bases.length === 0 ? initializers : [],
    superInitializers: bases.length === 0 ? [] : initializers };
}

function sourceFlowAllocation(source: TargetSourceProgram, storage: SourceStorageQueries, invocation: Node,
  bindings: SourceStorageBindings, step: (node?: Node) => void): { readonly call: Node; readonly callerBindings: SourceStorageBindings } {
  const seen = new Set<SourceStorageBindings>();
  let call = invocation;
  let callerBindings = bindings;
  while (!source.ast.is.IsNewExpression(call)) {
    step(call);
    const base = sourceStorageSuperConstructor(call, source, () => { step(call); return true; });
    if (base === undefined || seen.has(callerBindings)) {
      throw new SourceFlowFailure("Constructor flow requires the actual checked allocation activation, not a guessed heritage order.", call);
    }
    seen.add(callerBindings);
    const selected = storage.boundActivationsFor(base.owner, callerBindings);
    if (selected.kind === "unresolved") throw new SourceFlowFailure(selected.reason, call);
    const activation = selected.activations.length === 1 ? selected.activations[0] : undefined;
    if (activation === undefined || activation.kind !== "invocation") {
      throw new SourceFlowFailure("Constructor flow requires one exact owning allocation activation.", call);
    }
    call = activation.invocation;
    callerBindings = activation.callerBindings;
  }
  return { call, callerBindings };
}
