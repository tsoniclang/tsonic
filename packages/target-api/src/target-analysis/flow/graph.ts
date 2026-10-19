import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { isSourceCallableBodyBoundary } from "../../source-navigation/callable-boundaries.js";
import { sourceFlowPattern } from "./bindings.js";
import { createSourceFlowCaptureQuery } from "./captures.js";
import { createSourceFlowConstruction, type SourceFlowConstruction, type SourceFlowContext } from "./construction.js";
import { sourceFlowEntry, type SourceFlowInitializer } from "./entry.js";
import { sourceFlowExpression } from "./expressions.js";
import type { SourceControlFlowOptions, SourceControlFlowSelection } from "./model.js";
import { SourceFlowFailure, sourceFlowLimits } from "./resources.js";
import { sourceFlowStatement } from "./statements.js";

type PatternKey = Node | string | number | boolean | undefined;
interface PatternContinuation {
  readonly children: Map<PatternKey, PatternContinuation>;
  entry: number | undefined;
}

export function createSourceControlFlow(source: TargetSourceProgram, declaration: Node,
  options: SourceControlFlowOptions = {}): SourceControlFlowSelection {
  try {
    const { ast } = source;
    const file = ast.getSourceFile(declaration);
    if (file === undefined || !source.sourceFiles.includes(file) ||
      !isSourceCallableBodyBoundary(ast, declaration) && !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration)) {
      throw new SourceFlowFailure("Source flow requires a callable from the exact checked source program.", declaration);
    }
    if (options === null || typeof options !== "object" ||
      Object.keys(options).some(key => key !== "limits" && key !== "invocation")) {
      throw new SourceFlowFailure("Source flow requires explicit limits and checked invocation options.", declaration);
    }
    const selectedLimits = sourceFlowLimits(options.limits ?? {});
    const owner = createSourceFlowConstruction(declaration, selectedLimits);
    const selectedEntry = sourceFlowEntry(source, declaration, options.invocation, owner.step);
    const { body, parameterInitializers, superInitializers, bodyExecution } = selectedEntry;
    const pending = [declaration, ...selectedEntry.syntaxRoots].map(node => ({ node, depth: 0 }));
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
    const initialize = (initializers: readonly SourceFlowInitializer[], next: number, context: SourceFlowContext): number => {
      let entry = next;
      for (let index = initializers.length - 1; index >= 0; index -= 1) {
        const selected = initializers[index]!;
        entry = owner.withExecution(selected.execution, () => build.expression(selected.node, entry, context));
      }
      return entry;
    };
    let patternWave: { readonly context: SourceFlowContext; readonly root: PatternContinuation } | undefined;
    const build: SourceFlowConstruction = { source, parameterInitializers,
      initializeSuper: (next, context) => initialize(superInitializers, next, context),
      captures: createSourceFlowCaptureQuery(source, owner.step),
      point: owner.point, edge: owner.edge, emit: owner.emit, step: owner.step,
      expression: (node, next, context) => owner.nested(node, () => sourceFlowExpression(build, node, next, context)),
      statement: (node, next, context) => owner.nested(node, () => sourceFlowStatement(build, node, next, context)),
      pattern: (node, next, context, initialization, value) => owner.nested(node, () => {
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
      }),
    };
    const exit = build.point(declaration, { kind: "exit" });
    const exceptionExit = build.point(declaration, { kind: "exception-exit" });
    const context: SourceFlowContext = { returnTo: exit, throwTo: exceptionExit, breaks: new Map(), continues: new Map() };
    const completion = initialize(selectedEntry.completionInitializers, exit, context);
    const bodyContext = { ...context, returnTo: completion };
    let entry = owner.withExecution(bodyExecution, () => {
      let entry = body === undefined ? completion : ast.is.IsBlock(body) ? build.statement(body, completion, bodyContext)
        : build.expression(body, build.emit(body, { kind: "return" }, completion, bodyContext, false, "return"), bodyContext);
      const implicit = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration);
      const parameters = selectedEntry.parameters;
      const receiver = implicit ? undefined : source.semantics.forFile(file).types.declarationSignatureInfo(declaration)?.thisParameter?.declaration;
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
    return Object.freeze({ kind: "unresolved", reason: error.message, source: error.source });
  }
}
