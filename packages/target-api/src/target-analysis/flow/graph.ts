import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { sourceFlowPattern } from "./bindings.js";
import { createSourceFlowCaptureQuery } from "./captures.js";
import { createSourceFlowConstruction, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { sourceFlowExpression } from "./expressions.js";
import type { SourceControlFlowOptions, SourceControlFlowSelection } from "./model.js";
import { SourceFlowFailure, sourceFlowLimits } from "./resources.js";
import { sourceFlowStatement } from "./statements.js";

const callableKinds: ReadonlySet<string> = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindGetAccessor", "KindSetAccessor", "KindConstructor"]);

export function createSourceControlFlow(source: TargetSourceProgram, declaration: Node,
  options: SourceControlFlowOptions = {}): SourceControlFlowSelection {
  try {
    const { ast } = source;
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !source.sourceFiles.includes(file) || !callableKinds.has(ast.kindName(declaration))) {
      throw new SourceFlowFailure("Source flow requires a callable from the exact checked source program.", declaration);
    }
    const body = ast.body(declaration);
    if (body === undefined) throw new SourceFlowFailure("Source flow requires an implemented checked callable body.", declaration);
    if (options === null || typeof options !== "object" ||
      Object.keys(options).some(key => key !== "limits" && key !== "invocation")) {
      throw new SourceFlowFailure("Source flow requires explicit limits and checked invocation options.", declaration);
    }
    const selectedLimits = sourceFlowLimits(options.limits ?? {});
    const owner = createSourceFlowConstruction(declaration, selectedLimits);
    let parameterInitializers: ReadonlySet<Node> | undefined;
    if (options.invocation !== undefined) {
      if (options.invocation === null || typeof options.invocation !== "object" ||
        Object.keys(options.invocation).some(key => key !== "storage" && key !== "call")) {
        throw new SourceFlowFailure("Source flow invocation entry requires checked storage and its actual call, not a region list.", declaration);
      }
      const { storage, call } = options.invocation;
      if (storage === undefined || storage.source !== source) {
        throw new SourceFlowFailure("Source flow invocation entry requires storage from the identical checked source program.", call);
      }
      const implementations = storage.invocationImplementationsFor(call);
      if (implementations.kind === "unresolved" || !implementations.nodes.includes(declaration)) {
        throw new SourceFlowFailure(implementations.kind === "unresolved" ? implementations.reason
          : "Source flow invocation entry requires the actual selected callable implementation.", call);
      }
      const regions = storage.executionRegionsFor(declaration, call);
      if (regions.kind === "unresolved") throw new SourceFlowFailure(regions.reason, call);
      const allowed = new Set<Node>([body]);
      for (const parameter of ast.parameters(declaration)) {
        owner.step(parameter);
        const initializer = parameter === undefined ? undefined : ast.as.AsParameterDeclaration(parameter)?.Initializer;
        if (initializer !== undefined) allowed.add(initializer);
      }
      if (!regions.nodes.includes(body)) throw new SourceFlowFailure("Source flow invocation entry requires its checked callable body.", call);
      for (const region of regions.nodes) {
        owner.step(region);
        if (!allowed.has(region)) throw new SourceFlowFailure("Source flow invocation entry contains a foreign body or initializer region.", region);
      }
      parameterInitializers = new Set(regions.nodes);
    }
    const pending = [{ node: declaration, depth: 0 }];
    while (pending.length > 0) {
      const current = pending.pop()!;
      owner.step(current.node);
      if (current.depth >= selectedLimits.maximumDepth) {
        throw new SourceFlowFailure("Source flow exceeds its finite syntax depth budget.", current.node);
      }
      for (const child of ast.children(current.node)) {
        if (child !== undefined) pending.push({ node: child, depth: current.depth + 1 });
      }
    }
    const build: SourceFlowConstruction = { source, parameterInitializers,
      captures: createSourceFlowCaptureQuery(source, owner.step),
      point: owner.point, edge: owner.edge, emit: owner.emit, step: owner.step,
      expression: (node, next, context) => owner.nested(node, () => sourceFlowExpression(build, node, next, context)),
      statement: (node, next, context) => owner.nested(node, () => sourceFlowStatement(build, node, next, context)),
      pattern: (node, next, context, initialization) => owner.nested(node, () => sourceFlowPattern(build, node, next, context, initialization)),
    };
    const exit = build.point(declaration, { kind: "exit" });
    const exceptionExit = build.point(declaration, { kind: "exception-exit" });
    const context: SourceFlowContext = { returnTo: exit, throwTo: exceptionExit, breaks: new Map(), continues: new Map() };
    let entry = ast.is.IsBlock(body) ? build.statement(body, exit, context)
      : build.expression(body, build.emit(body, { kind: "return" }, exit, context, false, "return"), context);
    const parameters = ast.parameters(declaration);
    const receiver = source.semantics.forFile(file).types.declarationSignatureInfo(declaration)?.thisParameter?.declaration;
    for (let index = parameters.length - 1; index >= 0; index -= 1) {
      const parameter = parameters[index];
      if (parameter !== undefined && parameter !== receiver) entry = build.pattern(parameter, entry, context, true);
    }
    const root = build.point(declaration, { kind: "entry" });
    build.edge(root, entry);
    return Object.freeze({ kind: "resolved", graph: owner.finish(root, exit, exceptionExit) });
  } catch (error) {
    if (!(error instanceof SourceFlowFailure)) throw error;
    return Object.freeze({ kind: "unresolved", reason: error.message, source: error.source });
  }
}
