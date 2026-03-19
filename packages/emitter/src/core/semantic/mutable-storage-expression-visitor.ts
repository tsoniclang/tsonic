/**
 * Mutable storage detection — expression visitor.
 *
 * Extracted from mutable-storage-detection.ts — contains the large
 * visitExpression function that walks all IR expression kinds to detect
 * mutable array bindings and property slots.
 */

import {
  IrClassDeclaration,
  IrExpression,
  IrInterfaceDeclaration,
  IrParameter,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  type ScopeStack,
  type VisitStatementFn,
  checkArrayMutationOnCall,
  collectPatternNames,
  declarePattern,
  popScope,
  pushScope,
} from "./mutable-storage-helpers.js";

export const visitExpression = (
  expr: IrExpression,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack,
  visitStatementFn: VisitStatementFn
): void => {
  checkArrayMutationOnCall(
    expr,
    context,
    classes,
    interfaces,
    topLevelConstBindings,
    mutableModuleBindings,
    mutablePropertySlots,
    scopes
  );

  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
    case "defaultof":
    case "nameof":
    case "sizeof":
      return;
    case "array":
      for (const element of expr.elements) {
        if (!element) continue;
        if (element.kind === "spread") {
          visitExpression(
            element.expression,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatementFn
          );
          continue;
        }
        visitExpression(
          element,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      return;
    case "object":
      for (const property of expr.properties) {
        if (property.kind === "spread") {
          visitExpression(
            property.expression,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatementFn
          );
          continue;
        }
        if (typeof property.key !== "string") {
          visitExpression(
            property.key,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatementFn
          );
        }
        visitExpression(
          property.value,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      return;
    case "functionExpression": {
      const names = [
        ...(expr.name ? [expr.name] : []),
        ...expr.parameters.flatMap((param: IrParameter) =>
          collectPatternNames(param.pattern)
        ),
      ];
      pushScope(scopes, names);
      visitStatementFn(
        expr.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      popScope(scopes);
      return;
    }
    case "arrowFunction": {
      pushScope(
        scopes,
        expr.parameters.flatMap((param: IrParameter) => collectPatternNames(param.pattern))
      );
      if (expr.body.kind === "blockStatement") {
        visitStatementFn(
          expr.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      } else {
        visitExpression(
          expr.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      popScope(scopes);
      return;
    }
    case "memberAccess":
      visitExpression(
        expr.object,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      if (expr.isComputed && typeof expr.property !== "string") {
        visitExpression(
          expr.property,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      return;
    case "call":
    case "new":
      visitExpression(
        expr.callee,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      for (const arg of expr.arguments) {
        const value = arg.kind === "spread" ? arg.expression : arg;
        visitExpression(
          value,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      return;
    case "update":
    case "unary":
    case "await":
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "binary":
    case "logical":
      visitExpression(
        expr.left,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.right,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "conditional":
      visitExpression(
        expr.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.whenTrue,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      visitExpression(
        expr.whenFalse,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "assignment":
      if ("kind" in expr.left) {
        if (expr.left.kind === "identifierPattern") {
          declarePattern(expr.left, scopes);
        } else if (
          expr.left.kind !== "objectPattern" &&
          expr.left.kind !== "arrayPattern"
        ) {
          visitExpression(
            expr.left,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatementFn
          );
        }
      }
      visitExpression(
        expr.right,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "templateLiteral":
      for (const nested of expr.expressions) {
        visitExpression(
          nested,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatementFn
        );
      }
      return;
    case "spread":
    case "numericNarrowing":
    case "typeAssertion":
    case "asinterface":
    case "trycast":
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "yield":
      if (!expr.expression) return;
      visitExpression(
        expr.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
    case "stackalloc":
      visitExpression(
        expr.size,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatementFn
      );
      return;
  }
};
