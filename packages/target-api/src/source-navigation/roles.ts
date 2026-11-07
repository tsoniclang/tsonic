// SourceRoleModel: the one navigation role model (R4, G11). Purpose queries over the existing navigation algorithms.
// Keys are declaration Nodes; navigation itself is declaration-keyed and reads no checker Symbol (I1, I3).
// Built once per program by the Host fact owner.
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type {
  SourceDeclarationTarget, SourceModuleExportTarget, SourceNodeRole, SourceRoleModel,
} from "../public/source/roles.js";
import type { SourceProgramNavigation } from "./types.js";
import { sourceTransparentExpressionOperand } from "./ast.js";
import { isSourceCallableBodyBoundary, sourceEnclosing, sourceNodeRoles } from "./callable-boundaries.js";
import { sourceLexicalFunctionIsUnused } from "./callable-invocations.js";
import { sourceControlTransferTarget } from "./control-targets.js";
import { sourceDeclarationHasOnlyTypeUses } from "./declaration-use-summary.js";
import { sourceConstructValueInputs, sourceExpressionValueInputs } from "./expression-use.js";
import { sourceNodeIdentity } from "./identity.js";
import {
  sourceBindingIterationScope, sourceBindingScope, sourceDeclarationIsModuleScoped, sourceLexicalCaptures,
} from "./lexical-captures.js";
import { sourceReceiverOwner } from "./receiver-owner.js";
import { sourceCallableUsesLexicalThis, sourceExpressionUsesLexicalThis } from "../source-semantics/lexical-this.js";
import { sourceNodeIsNativeUnreachable } from "../source-semantics/native-control-flow.js";

/** Host-internal inputs of the role model. */
export interface SourceRoleModelInput {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  /**
   * The declaration the Host value type at `node` names: `facts.values.type(node)` is a declared descriptor, or a union
   * whose only non-absent arm is one. Undefined otherwise. From the Host value model, never a checked type (R3).
   */
  valueTypeDeclaration(node: Node): Node | undefined;
  /** Constant truth value of a condition expression when the Source fixes it (literal facts), else undefined. */
  conditionValue(expression: Node): boolean | undefined;
}

const projectShapeKinds: ReadonlySet<string> = new Set([
  "KindClassDeclaration", "KindClassExpression", "KindInterfaceDeclaration", "KindEnumDeclaration", "KindEnumMember",
]);

export function createSourceRoleModel(input: SourceRoleModelInput): SourceRoleModel {
  const { ast, navigation } = input;
  const roles = new WeakMap<Node, readonly SourceNodeRole[]>();
  const suspensionsMemo = new WeakMap<Node, readonly Node[]>();
  const capturesMemo = new WeakMap<Node, readonly { readonly declaration: Node; readonly written: boolean }[]>();

  const sourceFileOf = (node: Node): SourceFile => {
    const sourceFile = ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("Source roles require a node of the checked program.");
    return sourceFile;
  };
  const projectValueDeclaration = (node: Node): Node | undefined => {
    if (ast.isDeclarationFile(sourceFileOf(node))) return undefined;
    const declaration = input.valueTypeDeclaration(node);
    return declaration !== undefined && navigation.isProjectDeclaration(declaration) ? declaration : undefined;
  };
  const target = (reference: Node): SourceDeclarationTarget | undefined => {
    const selected = navigation.sourceReferenceFor(reference);
    return selected === undefined ? undefined
      : Object.freeze({ declaration: selected.declaration, sourceFile: selected.sourceFile, project: selected.project });
  };

  // Roles are additive (one predicate per role, callable-boundaries.ts); memoized per program (I5).
  const role = (node: Node): readonly SourceNodeRole[] => {
    const known = roles.get(node);
    if (known !== undefined) return known;
    const selected = sourceNodeRoles(ast, node);
    roles.set(node, selected);
    return selected;
  };
  // One walk per purpose over the memoized roles; the nearest strict ancestor holding the role.
  const enclosing = (node: Node, selected: SourceNodeRole): Node | undefined =>
    sourceEnclosing(ast, node, selected, (candidate, wanted) => role(candidate).includes(wanted));

  const suspensions = (callable: Node): readonly Node[] => {
    const known = suspensionsMemo.get(callable);
    if (known !== undefined) return known;
    if (!isSourceCallableBodyBoundary(ast, callable)) throw new Error("Suspension facts require a callable with a body.");
    const found: Node[] = [];
    const body = ast.body(callable);
    const visit = (node: Node): void => {
      if (node !== callable && isSourceCallableBodyBoundary(ast, node)) return;
      const kind = ast.kindName(node);
      if (kind === "KindAwaitExpression" || kind === "KindYieldExpression") found.push(node);
      else if (kind === "KindForOfStatement" && ast.as.AsForInOrOfStatement(node)?.AwaitModifier !== undefined) found.push(node);
      else if (kind === "KindVariableDeclarationList" && ast.variableDeclarationKind(node) === "await using") found.push(node);
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    if (body !== undefined) visit(body);
    const frozen = Object.freeze(found);
    suspensionsMemo.set(callable, frozen);
    return frozen;
  };

  const captures = (callable: Node) => {
    const known = capturesMemo.get(callable);
    if (known !== undefined) return known;
    const body = ast.body(callable);
    const selection = sourceLexicalCaptures(callable, body === undefined ? [] : [body], ast, navigation, "source");
    const result = Object.freeze(selection.captures.map(capture => Object.freeze({
      declaration: capture.declaration,
      written: navigation.declarationUseSummary(capture.declaration).bindingWritten,
    })));
    capturesMemo.set(callable, result);
    return result;
  };

  const stable = (expression: Node): boolean => {
    const operand = transparentOperand(expression);
    const kind = ast.kindName(operand);
    if (kind === "KindThisKeyword" || kind === "KindStringLiteral" || kind === "KindNumericLiteral" ||
      kind === "KindBigIntLiteral" || kind === "KindTrueKeyword" || kind === "KindFalseKeyword" ||
      kind === "KindNullKeyword" || kind === "KindNoSubstitutionTemplateLiteral") return true;
    if (kind !== "KindIdentifier") return false;
    const selected = navigation.sourceReferenceFor(operand);
    if (selected === undefined || !selected.project) return false;
    const summary = navigation.declarationUseSummary(selected.declaration);
    return !summary.bindingWritten && !summary.mutatedAfterInitialization;
  };

  const transparentOperand = (expression: Node): Node => {
    let current = expression;
    for (let operand = sourceTransparentExpressionOperand(ast, current); operand !== undefined;
      operand = sourceTransparentExpressionOperand(ast, current)) current = operand;
    return current;
  };

  return Object.freeze({
    identity: Object.freeze({
      target,
      declarations: (declaration: Node) => navigation.mergedDeclarations(declaration),
      isProjectDeclaration: (node: Node) => navigation.isProjectDeclaration(node),
      isProjectShape(node: Node) {
        const declaration = projectValueDeclaration(node);
        return declaration !== undefined && projectShapeKinds.has(ast.kindName(declaration));
      },
      isProjectConstructibleObject(node: Node) {
        const declaration = projectValueDeclaration(node);
        return declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) &&
          acceptsNoConstructorArguments(ast, declaration);
      },
      identity(node: Node) {
        const identity = sourceNodeIdentity(ast, node);
        if (identity === undefined) throw new Error("Source identity requires a node of the checked program.");
        return identity;
      },
    }),
    modules: Object.freeze({
      dependencies: (sourceFile: SourceFile) => navigation.moduleDependencies(sourceFile),
      references: (sourceFile: SourceFile) => navigation.moduleReferences(sourceFile),
      exports(sourceFile: SourceFile): readonly SourceModuleExportTarget[] {
        return Object.freeze(navigation.moduleExports(sourceFile).map(entry => Object.freeze({
          exportName: entry.exportName, declaration: entry.declaration, sourceFile: entry.sourceFile,
          project: navigation.isProjectDeclaration(entry.declaration),
        })));
      },
      specifier: (moduleSpecifier: Node) => navigation.moduleSpecifierResolution(moduleSpecifier),
      hasTopLevelAwait: (sourceFile: SourceFile) => navigation.moduleHasTopLevelAwait(sourceFile),
    }),
    uses: Object.freeze({
      uses: (declaration: Node) => navigation.declarationUses(declaration),
      summary: (declaration: Node) => navigation.declarationUseSummary(declaration),
      parameterSummary: (parameter: Node) => navigation.parameterUseSummary(parameter),
      references: (declaration: Node) => navigation.referencesToDeclaration(declaration),
      referencesWithin: (declaration: Node, root: Node) => navigation.referencesWithin(declaration, root),
      writesWithin(declaration: Node, root: Node) {
        return Object.freeze(navigation.bindingWritesWithin(declaration, root).map(write => {
          const value = write.values.find(entry => entry.kind === "value")?.expression;
          return Object.freeze({
            write: write.reference,
            ...(value === undefined ? {} : { value }),
            compound: write.kind === "update" || write.kind === "assignment" && compoundAssignment(ast, write.operation),
          });
        }));
      },
      referencedOutside: (declaration: Node, excluded: Node) =>
        navigation.hasReferenceOutside(declaration, excluded),
      hasOnlyTypeUses: (declaration: Node) => sourceDeclarationHasOnlyTypeUses(navigation.declarationUseSummary(declaration)),
    }),
    expressions: Object.freeze({
      effects: (expression: Node) => navigation.expressionEffects(expression),
      valueFlow: (expression: Node) => navigation.expressionValueFlow(expression),
      resultUse: (expression: Node) => navigation.expressionResultUse(expression),
      resultDisposition: (expression: Node) => navigation.expressionResultDisposition(expression),
      valueInputs(expression: Node): readonly Node[] {
        const kind = ast.kindName(expression);
        const inputs = kind === "KindNewExpression" || kind === "KindCallExpression" || kind === "KindTaggedTemplateExpression"
          ? sourceExpressionValueInputs(ast, expression) ?? sourceConstructValueInputs(ast, expression)
          : sourceExpressionValueInputs(ast, expression);
        return Object.freeze((inputs ?? []).map(entry => entry.expression));
      },
      transparentOperand,
      stable,
    }),
    scopes: Object.freeze({
      role,
      enclosing,
      bindingScope(declaration: Node) {
        const scope = sourceBindingScope(declaration, ast);
        if (scope === undefined) throw new Error("A binding scope requires a binding declaration.");
        return scope;
      },
      iterationScope: (declaration: Node) => sourceBindingIterationScope(declaration, ast),
      isModuleScoped: (declaration: Node) => sourceDeclarationIsModuleScoped(declaration, ast),
      thisBinder: (node: Node) => sourceReceiverOwner(node, ast, "lexical-capture"),
      usesLexicalThis: (node: Node) => isSourceCallableBodyBoundary(ast, node)
        ? sourceCallableUsesLexicalThis(ast, node) : sourceExpressionUsesLexicalThis(ast, node),
      captures,
      suspensions,
      controlTransferTarget: (statement: Node) => sourceControlTransferTarget(ast, statement),
      countedLoop(statement: Node) {
        const loop = navigation.countedLoop(statement);
        return loop === undefined ? undefined : Object.freeze({
          statement: loop.statement, counter: loop.counterDeclaration, start: loop.start, bound: loop.bound, body: loop.body,
        });
      },
      unreachable: (node: Node) => sourceNodeIsNativeUnreachable(ast, node, input.conditionValue),
      unused: (callable: Node) => sourceLexicalFunctionIsUnused(callable, ast, navigation),
    }),
  });
}

function compoundAssignment(ast: AstReader, operation: Node): boolean {
  if (!ast.is.IsBinaryExpression(operation)) return false;
  const operator = ast.as.AsBinaryExpression(operation)?.OperatorToken;
  return operator !== undefined && ast.kindName(operator) !== "KindEqualsToken";
}

/** A class constructible with no arguments: no constructor, or one whose every parameter is optional, defaulted or rest. */
function acceptsNoConstructorArguments(ast: AstReader, classDeclaration: Node): boolean {
  const constructors = ast.members(classDeclaration)
    .filter((member): member is Node => member !== undefined && ast.is.IsConstructorDeclaration(member));
  return constructors.length === 0 || constructors.some(constructor => ast.parameters(constructor).every(parameter => {
    const declaration = parameter === undefined ? undefined : ast.as.AsParameterDeclaration(parameter);
    return declaration !== undefined && (declaration.QuestionToken !== undefined || declaration.Initializer !== undefined ||
      declaration.DotDotDotToken !== undefined);
  }));
}
