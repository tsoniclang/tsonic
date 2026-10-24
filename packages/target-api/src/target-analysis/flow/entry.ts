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
  readonly bodyExecution: SourceFlowExecutionRegion | undefined;
  readonly entryInitializers: readonly SourceFlowInitializer[];
  readonly superInitializers: readonly SourceFlowInitializer[];
  readonly completionInitializers: readonly SourceFlowInitializer[];
  readonly syntaxRoots: readonly Node[];
}

export interface SourceFlowInitializer {
  readonly node: Node;
  readonly execution: SourceFlowExecutionRegion | undefined;
}

export function sourceFlowEntry(source: TargetSourceProgram, declaration: Node,
  invocation: SourceControlFlowOptions["invocation"], step: (node?: Node) => void): SourceFlowEntry {
  const { ast } = source;
  if (ast.is.IsSourceFile(declaration)) {
    if (!source.sourceFiles.some(file => file === declaration) || invocation !== undefined)
      throw new SourceFlowFailure("Source module flow requires its original checked source file and no callable invocation.", declaration);
    return { body: declaration, parameters: [], parameterInitializers: undefined, bodyExecution: undefined,
      entryInitializers: [], superInitializers: [], completionInitializers: [], syntaxRoots: [] };
  }
  const propertyRoot = ast.is.IsPropertyDeclaration(declaration);
  const propertyOwner = propertyRoot ? ast.parent(declaration) : undefined;
  const propertyInitializer = propertyRoot ? Node_Initializer(ast, declaration) : undefined;
  if (propertyRoot) {
    step(declaration);
    if (propertyOwner === undefined ||
      !ast.is.IsClassDeclaration(propertyOwner) && !ast.is.IsClassExpression(propertyOwner) ||
      !ast.members(propertyOwner).includes(declaration) || ast.hasModifierKind(declaration, "static") || propertyInitializer === undefined)
      throw new SourceFlowFailure("Property initializer flow requires its original checked nonstatic class field and actual initializer.", declaration);
    if (invocation === undefined)
      return { body: undefined, parameters: [], parameterInitializers: undefined, bodyExecution: undefined,
        entryInitializers: [Object.freeze({ node: propertyInitializer, execution: undefined })],
        superInitializers: [], completionInitializers: [], syntaxRoots: [propertyInitializer] };
  }
  const body = ast.body(declaration);
  const classRoot = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
  let bodyExecution: SourceFlowExecutionRegion | undefined;
  let parameterInitializers: ReadonlySet<Node> | undefined;
  if (invocation !== undefined) {
    if (invocation === null || typeof invocation !== "object" ||
      Object.keys(invocation).some(key => key !== "storage" && key !== "call" && key !== "callerBindings" && key !== "construction")) {
      throw new SourceFlowFailure("Source flow invocation entry requires checked storage and its actual call, not a region list.", declaration);
    }
    const { storage, call } = invocation;
    if (storage === undefined || storage.source !== source) {
      throw new SourceFlowFailure("Source flow invocation entry requires storage from the identical checked source program.", call);
    }
    if (propertyRoot || classRoot || ast.is.IsConstructorDeclaration(declaration)) {
      const selected = storage.constructionFor(call, invocation.callerBindings);
      if (selected.kind === "unresolved") throw new SourceFlowFailure(selected.reason, call);
      const matches = selected.alternatives.filter(entry => propertyRoot ? entry.classes.some(selected => {
        step(selected.owner);
        return selected.owner === propertyOwner && selected.regions.some(region => {
          step(region.node);
          return region.node === propertyInitializer;
        });
      }) : declaration === entry.implementation?.declaration ||
        declaration === entry.root && (entry.implementation === undefined || invocation.construction !== undefined));
      const construction = invocation.construction ?? (matches.length === 1 ? matches[0] : undefined);
      if (construction === undefined || !matches.includes(construction))
        throw new SourceFlowFailure("Constructor flow requires its actual checked construction implementation and one actual cached construction alternative, not a merged or forged class execution.", call);
      const implementation = construction.implementation;
      const regionsFor = (selected: typeof construction.classes[number]): readonly SourceFlowInitializer[] =>
        selected.regions.map(region => {
          step(region.node);
          return Object.freeze({ node: region.node,
            execution: Object.freeze({ owner: selected.owner, selection: region.selection }) });
        });
      if (propertyRoot) {
        const initializers: SourceFlowInitializer[] = [];
        for (let index = construction.classes.length - 1; index >= 0; index -= 1) {
          const selected = construction.classes[index]!;
          step(selected.owner);
          if (selected.owner !== propertyOwner) continue;
          for (const region of regionsFor(selected)) {
            if (region.node === propertyInitializer) initializers.push(region);
          }
        }
        if (initializers.length === 0 || propertyInitializer === undefined)
          throw new SourceFlowFailure("Property initializer flow requires its actual checked class-entry region and execution bindings.", declaration);
        return { body: undefined, parameters: [], parameterInitializers: undefined, bodyExecution: undefined,
          entryInitializers: initializers, superInitializers: [], completionInitializers: [], syntaxRoots: [propertyInitializer] };
      }
      if (implementation !== undefined) for (const region of implementation.regions) {
        step(region);
      }
      bodyExecution = implementation === undefined ? undefined
        : Object.freeze({ owner: implementation.declaration, selection: implementation.selection });
      const terminal = construction.classes[construction.classes.length - 1]!;
      const heritage = source.navigation.declaredHeritage(terminal.owner);
      if (heritage.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, terminal.owner);
      const derived = heritage.edges.some(edge => edge.kind === "extends");
      const fields = regionsFor(terminal);
      return { body: implementation?.body, parameters: implementation === undefined ? [] : ast.parameters(implementation.declaration),
        parameterInitializers: new Set(implementation?.regions ?? []), bodyExecution,
        entryInitializers: derived ? [] : fields, superInitializers: derived ? fields : [],
        completionInitializers: construction.classes.slice(0, -1).reverse().flatMap(regionsFor),
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
    }
    bodyExecution = Object.freeze({ owner: declaration, selection: bound });
    parameterInitializers = new Set(regions.nodes);
  }
  if (body === undefined || classRoot) throw new SourceFlowFailure("Source flow requires an implemented checked callable body.", declaration);
  const owner = ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined;
  const fields = owner === undefined ? [] : sourceStorageInstanceInitializers(owner, source, () => { step(owner); return true; });
  const heritage = owner === undefined ? undefined : source.navigation.declaredHeritage(owner);
  if (heritage?.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, owner);
  const derived = heritage?.edges.some(edge => edge.kind === "extends") ?? false;
  const initializers = fields.map(node => Object.freeze({ node, execution: undefined }));
  return { body, parameters: ast.parameters(declaration), parameterInitializers, bodyExecution,
    entryInitializers: derived ? [] : initializers, superInitializers: derived ? initializers : [], completionInitializers: [], syntaxRoots: fields };
}
