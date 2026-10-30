import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { sourceInstanceInitializers } from "../../source-navigation/class-initialization.js";
import type { SourceControlFlowOptions, SourceDeclarationFlowExecutionRegion, SourceFlowExecutionRegion } from "./model.js";
import { SourceFlowFailure } from "./resources.js";

export interface SourceFlowEntry<Region = SourceFlowExecutionRegion> {
  readonly body: Node | undefined;
  readonly parameters: readonly (Node | undefined)[];
  readonly parameterInitializers: ReadonlySet<Node> | undefined;
  readonly bodyExecution: Region | undefined;
  readonly entryInitializers: readonly SourceFlowInitializer<Region>[];
  readonly superInitializers: readonly SourceFlowInitializer<Region>[];
  readonly completionInitializers: readonly SourceFlowInitializer<Region>[];
  readonly syntaxRoots: readonly Node[];
  readonly rootExecutions: ReadonlyMap<Node, Region>;
}

export interface SourceFlowInitializer<Region = SourceFlowExecutionRegion> {
  readonly node: Node;
  readonly execution: Region | undefined;
}

export function sourceFlowEntry(source: TargetSourceProgram, declaration: Node,
  invocation: SourceControlFlowOptions["invocation"], step: (node?: Node) => void): SourceFlowEntry {
  const { ast } = source;
  const rootExecutions = new Map<Node, SourceFlowExecutionRegion>();
  if (ast.is.IsSourceFile(declaration)) {
    if (!source.sourceFiles.some(file => file === declaration) || invocation !== undefined)
      throw new SourceFlowFailure("Source module flow requires its original checked source file and no callable invocation.", declaration);
    return { body: declaration, parameters: [], parameterInitializers: undefined, bodyExecution: undefined,
      entryInitializers: [], superInitializers: [], completionInitializers: [], syntaxRoots: [], rootExecutions };
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
        superInitializers: [], completionInitializers: [], syntaxRoots: [propertyInitializer], rootExecutions };
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
          entryInitializers: initializers, superInitializers: [], completionInitializers: [], syntaxRoots: [propertyInitializer], rootExecutions };
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
        syntaxRoots: construction.classes.flatMap(selected => selected.regions.map(region => region.node)), rootExecutions };
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
  const fields = owner === undefined ? [] : sourceInstanceInitializers(owner, source, () => { step(owner); return true; });
  if (fields === undefined) throw new SourceFlowFailure("Source flow requires completed instance initializer evidence.", owner);
  const heritage = owner === undefined ? undefined : source.navigation.declaredHeritage(owner);
  if (heritage?.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, owner);
  const derived = heritage?.edges.some(edge => edge.kind === "extends") ?? false;
  const initializers = fields.map(node => Object.freeze({ node, execution: undefined }));
  return { body, parameters: ast.parameters(declaration), parameterInitializers, bodyExecution,
    entryInitializers: derived ? [] : initializers, superInitializers: derived ? initializers : [], completionInitializers: [], syntaxRoots: fields, rootExecutions };
}

export function sourceDeclarationFlowEntry(source: TargetSourceProgram, declaration: Node,
  step: (node?: Node) => void): SourceFlowEntry<SourceDeclarationFlowExecutionRegion> {
  const { ast, navigation } = source;
  const rootExecutions = new Map<Node, SourceDeclarationFlowExecutionRegion>();
  const syntaxRoots: Node[] = [];
  const region = (owner: Node, root: Node, role: SourceDeclarationFlowExecutionRegion["role"]): SourceDeclarationFlowExecutionRegion => {
    step(root);
    if (!navigation.isProjectDeclaration(owner) || !navigation.isProjectDeclaration(root))
      throw new SourceFlowFailure("Declaration flow regions require their identical checked owner and root.", root);
    const selected = Object.freeze({ owner, root, role });
    rootExecutions.set(root, selected);
    syntaxRoots.push(root);
    return selected;
  };
  const empty = { parameters: [], parameterInitializers: undefined,
    superInitializers: [], completionInitializers: [], syntaxRoots, rootExecutions };
  if (ast.is.IsSourceFile(declaration)) return { ...empty, body: declaration,
    bodyExecution: region(declaration, declaration, "module"), entryInitializers: [] };
  if (ast.is.IsPropertyDeclaration(declaration)) {
    const owner = ast.parent(declaration);
    const initializer = Node_Initializer(ast, declaration);
    if (owner === undefined || !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner) ||
      !ast.members(owner).includes(declaration) || initializer === undefined)
      throw new SourceFlowFailure("Declaration field flow requires its original checked class, member and initializer.", declaration);
    const execution = region(owner, initializer, ast.hasModifierKind(declaration, "static") ? "static-initializer" : "instance-initializer");
    return { ...empty, body: undefined, bodyExecution: undefined,
      entryInitializers: [Object.freeze({ node: initializer, execution })] };
  }
  const classes: Node[] = [];
  let implementation: Node | undefined = declaration;
  if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) {
    const visited = new Set<Node>();
    let owner: Node | undefined = declaration;
    implementation = undefined;
    while (owner !== undefined) {
      step(owner);
      if (visited.has(owner)) throw new SourceFlowFailure("Declaration construction requires acyclic checked class heritage.", owner);
      visited.add(owner);
      if (!navigation.isProjectDeclaration(owner) || !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner))
        throw new SourceFlowFailure("Declaration construction requires its selected native contract when the base has no checked source class body.", owner);
      classes.push(owner);
      const constructors = navigation.classConstructors(owner);
      if (constructors.kind !== "resolved") throw new SourceFlowFailure(constructors.reason, owner);
      if (!constructors.implicit) {
        const bodies = ast.members(owner).filter((member): member is Node => member !== undefined &&
          ast.is.IsConstructorDeclaration(member) && ast.body(member) !== undefined);
        if (bodies.length !== 1) throw new SourceFlowFailure("Declaration construction requires one original checked constructor implementation.", owner);
        implementation = bodies[0];
        break;
      }
      const heritage = navigation.declaredHeritage(owner);
      if (heritage.kind !== "resolved") throw new SourceFlowFailure(heritage.reason, owner);
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      if (bases.length > 1) throw new SourceFlowFailure("Declaration construction requires one exact checked base declaration.", owner);
      owner = bases[0]?.target.declaration;
    }
  }
  const body = implementation === undefined ? undefined : ast.body(implementation);
  if (implementation !== undefined && body === undefined)
    throw new SourceFlowFailure("Declaration flow requires an implemented checked body or a completed selected native contract.", implementation);
  const bodyExecution = body === undefined || implementation === undefined ? undefined : region(implementation, body, "body");
  const parameters = implementation === undefined ? [] : ast.parameters(implementation);
  for (const parameter of parameters) {
    if (parameter === undefined) continue;
    step(parameter);
    const initializer = Node_Initializer(ast, parameter);
    if (initializer !== undefined) {
      const execution = region(implementation!, initializer, "parameter-initializer");
      rootExecutions.set(parameter, execution);
    }
  }
  const fields = (owner: Node): readonly SourceFlowInitializer<SourceDeclarationFlowExecutionRegion>[] => {
    const initializers = sourceInstanceInitializers(owner, source, () => { step(owner); return true; });
    if (initializers === undefined) throw new SourceFlowFailure("Declaration flow requires completed checked instance initializers.", owner);
    return initializers.map(node => Object.freeze({ node, execution: region(owner, node, "instance-initializer") }));
  };
  const owner = classes[classes.length - 1] ?? (ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined);
  const initializers = owner === undefined ? [] : fields(owner);
  const heritage = owner === undefined ? undefined : navigation.declaredHeritage(owner);
  if (heritage?.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, owner);
  const derived = heritage?.edges.some(edge => edge.kind === "extends") ?? false;
  const completionInitializers = classes.slice(0, -1).reverse().flatMap(fields);
  return { body, parameters, parameterInitializers: undefined, bodyExecution,
    entryInitializers: derived ? [] : initializers, superInitializers: derived ? initializers : [],
    completionInitializers, syntaxRoots, rootExecutions };
}
