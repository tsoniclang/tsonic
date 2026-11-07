// SourceRoleModel: ONE navigation role model with purpose-specific queries (R4, G11).
// Keys are declaration Nodes, never checker Symbols (I1). Grouped by purpose, not by the old functions.
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceExpressionResultDisposition } from "../../source-navigation/expression-use-model.js";
import type {
  SourceDeclarationUse,
  SourceDeclarationUseSummary,
  SourceExpressionEffects,
  SourceExpressionValueFlowSummary,
  SourceParameterUseSummary,
  SourceProjectModuleDependency,
  SourceProjectModuleSpecifierResolution,
} from "../../source-navigation/types.js";

/** A resolved reference target. `project` is true for a declaration in a project source file. */
export interface SourceDeclarationTarget {
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
  readonly project: boolean;
}

export interface SourceModuleExportTarget extends SourceDeclarationTarget {
  readonly exportName: string;
}

/** Identity and project membership. Replaces referenceFor/sourceReferenceFor/declarationFor/symbolDeclarations. */
export interface SourceIdentityRoles {
  /** The declaration an identifier, property name or type reference denotes. */
  target(reference: Node): SourceDeclarationTarget | undefined;
  /** All declarations merged under one entity (overloads, merged interfaces, namespace merges), authored order. */
  declarations(declaration: Node): readonly Node[];
  isProjectDeclaration(node: Node): boolean;
  isProjectShape(node: Node): boolean;
  isProjectConstructibleObject(node: Node): boolean;
  /** Stable identity text for naming (sourceNodeIdentity). Naming only; never selects Source meaning. */
  identity(node: Node): string;
}

export interface SourceModuleRoles {
  dependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  references(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  exports(sourceFile: SourceFile): readonly SourceModuleExportTarget[];
  specifier(moduleSpecifier: Node): SourceProjectModuleSpecifierResolution;
  hasTopLevelAwait(sourceFile: SourceFile): boolean;
}

/** Binding uses and writes, keyed by declaration. */
export interface SourceUseRoles {
  uses(declaration: Node): readonly SourceDeclarationUse[];
  summary(declaration: Node): SourceDeclarationUseSummary;
  parameterSummary(parameter: Node): SourceParameterUseSummary | undefined;
  references(declaration: Node): readonly Node[];
  referencesWithin(declaration: Node, root: Node): readonly Node[];
  writesWithin(declaration: Node, root: Node): readonly { readonly write: Node; readonly value?: Node; readonly compound: boolean }[];
  referencedOutside(declaration: Node, excluded: Node): boolean;
  hasOnlyTypeUses(declaration: Node): boolean;
}

/** Expression-level facts: effects, value flow, result use, evaluation inputs (E1-1). */
export interface SourceExpressionRoles {
  effects(expression: Node): SourceExpressionEffects;
  valueFlow(expression: Node): SourceExpressionValueFlowSummary;
  resultUse(expression: Node): "consumed" | "discarded";
  resultDisposition(expression: Node): SourceExpressionResultDisposition;
  /** Evaluation inputs in evaluation order: call, `new`, tagged template, sequence operands. */
  valueInputs(expression: Node): readonly Node[];
  /** Operand of parentheses / non-null / satisfies / type assertions that does not change the value. */
  transparentOperand(expression: Node): Node;
  /** Operand stability: true when re-reading the operand yields the same value without effects. */
  stable(expression: Node): boolean;
}

/**
 * The E13 callable purposes (03-DATA-MODEL `SourceCallableRole`; the frozen names in brackets). A node holds every
 * purpose it satisfies; the purposes are independent questions, never one Boolean (D04).
 * - `callable-body` [body-owner]: owns a function body: a function declaration, function expression, arrow, method,
 *   constructor or accessor WITH a body.
 * - `callable-signature` [signature-owner]: declares a call signature: every body owner, the same kinds without a body
 *   (overloads, abstract and ambient members), method signatures, call and construct signatures, function and
 *   constructor types.
 * - `execution-barrier`: stops immediate evaluation of its contents: every body owner, plus class `static {}` blocks.
 * - `deferred-execution`: a closure whose body runs later than its creation: function expressions, arrows, and the
 *   methods and accessors of object literals, wherever created (constructors included, E1-6). Class field initializers
 *   are not deferred: they run during construction.
 * - `type-parameter-owner`: declares at least one type parameter (`ast.typeParameters(owner)`): class, interface,
 *   type alias, function, method, method signature, call and construct signature, function and constructor type.
 * The receiver (`this`) binder is a separate question (`SourceScopeRoles.thisBinder`), not a purpose.
 */
export type SourceCallableRole =
  | "callable-body" | "callable-signature" | "execution-barrier" | "deferred-execution" | "type-parameter-owner";

/**
 * The structural roles beside the callable purposes: `class-scope` (class declaration or expression), `module-scope`
 * (source file), `block-scope` (block, for / for-in / for-of statement, catch clause, case block), `type-only`
 * (interface, type alias, type syntax), `ambient` (`declare` modifier, or any node of a declaration file).
 */
export type SourceNodeRole =
  | SourceCallableRole | "class-scope" | "module-scope" | "block-scope" | "type-only" | "ambient";

/** Scopes, callables, this-binder, captures, control transfer, suspension, reachability. */
export interface SourceScopeRoles {
  /** Every role the node holds, additively, in `SourceNodeRole` declaration order. */
  role(node: Node): readonly SourceNodeRole[];
  /**
   * The nearest STRICT ancestor of `node` that holds `role`; undefined when no ancestor does. One walk per purpose:
   * `enclosing(n, "callable-body")` passes through a class `static {}` block, `enclosing(n, "execution-barrier")` stops
   * at it, and `enclosing(n, "callable-signature")` also stops at a bodyless signature.
   */
  enclosing(node: Node, role: SourceNodeRole): Node | undefined;
  bindingScope(declaration: Node): Node;
  iterationScope(declaration: Node): Node | undefined;
  isModuleScoped(declaration: Node): boolean;
  /**
   * The node that binds `this` for `node`: the nearest function, method, constructor, accessor, field or static block
   * (arrows never bind `this`), else the source file. A separate question from the callable purposes (E13 receiver).
   */
  thisBinder(node: Node): Node | undefined;
  usesLexicalThis(callableOrExpression: Node): boolean;
  captures(callable: Node): readonly { readonly declaration: Node; readonly written: boolean }[];
  /** The callable suspends (await/yield) and where. */
  suspensions(callable: Node): readonly Node[];
  controlTransferTarget(statement: Node): Node | undefined;
  countedLoop(statement: Node): {
    readonly statement: Node; readonly counter: Node; readonly start: Node; readonly bound: Node; readonly body: Node;
  } | undefined;
  /** The node can never execute (native-unreachable). */
  unreachable(node: Node): boolean;
  /** The callable definition is never called or read. */
  unused(callable: Node): boolean;
}

export interface SourceRoleModel {
  readonly identity: SourceIdentityRoles;
  readonly modules: SourceModuleRoles;
  readonly uses: SourceUseRoles;
  readonly expressions: SourceExpressionRoles;
  readonly scopes: SourceScopeRoles;
}
