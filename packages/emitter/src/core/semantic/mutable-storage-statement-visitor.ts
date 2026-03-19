import {
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrStatement,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import {
  type ScopeStack,
  collectPatternNames,
  declarePattern,
  popScope,
  pushScope,
  visitExpression,
} from "./mutable-storage-detection.js";

const visitVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
): void => {
  for (const decl of stmt.declarations) {
    if (decl.initializer) {
      visitExpression(
        decl.initializer,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
    }
  }
  if (scopes.length === 0) return;
  for (const decl of stmt.declarations) {
    declarePattern(decl.name, scopes);
  }
};

export const visitStatement = (
  stmt: IrStatement,
  context: EmitterContext,
  classes: ReadonlyMap<string, IrClassDeclaration>,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  topLevelConstBindings: ReadonlySet<string>,
  mutableModuleBindings: Set<string>,
  mutablePropertySlots: Set<string>,
  scopes: ScopeStack
): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      visitVariableDeclaration(
        stmt,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "functionDeclaration": {
      if (scopes.length > 0) {
        scopes[scopes.length - 1]?.add(stmt.name);
      }
      pushScope(
        scopes,
        stmt.parameters.flatMap((param) => collectPatternNames(param.pattern))
      );
      visitStatement(
        stmt.body,
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
    case "classDeclaration":
      if (scopes.length > 0) {
        scopes[scopes.length - 1]?.add(stmt.name);
      }
      for (const member of stmt.members) {
        if (member.kind === "propertyDeclaration" && member.initializer) {
          visitExpression(
            member.initializer,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatement
          );
          continue;
        }

        if (member.kind === "methodDeclaration" && member.body) {
          pushScope(
            scopes,
            member.parameters.flatMap((param) =>
              collectPatternNames(param.pattern)
            )
          );
          visitStatement(
            member.body,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          popScope(scopes);
          continue;
        }

        if (member.kind === "constructorDeclaration" && member.body) {
          pushScope(
            scopes,
            member.parameters.flatMap((param) =>
              collectPatternNames(param.pattern)
            )
          );
          visitStatement(
            member.body,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
          popScope(scopes);
          continue;
        }

        if (member.kind === "propertyDeclaration") {
          if (member.getterBody) {
            pushScope(scopes);
            visitStatement(
              member.getterBody,
              context,
              classes,
              interfaces,
              topLevelConstBindings,
              mutableModuleBindings,
              mutablePropertySlots,
              scopes
            );
            popScope(scopes);
          }
          if (member.setterBody) {
            pushScope(
              scopes,
              member.setterParamName ? [member.setterParamName] : ["value"]
            );
            visitStatement(
              member.setterBody,
              context,
              classes,
              interfaces,
              topLevelConstBindings,
              mutableModuleBindings,
              mutablePropertySlots,
              scopes
            );
            popScope(scopes);
          }
        }
      }
      return;
    case "interfaceDeclaration":
    case "enumDeclaration":
    case "typeAliasDeclaration":
    case "emptyStatement":
    case "breakStatement":
    case "continueStatement":
      return;
    case "expressionStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
      return;
    case "returnStatement":
    case "throwStatement":
    case "generatorReturnStatement":
      if (stmt.expression) {
        visitExpression(
          stmt.expression,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatement
        );
      }
      return;
    case "ifStatement":
      visitExpression(
        stmt.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
      visitStatement(
        stmt.thenStatement,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      if (stmt.elseStatement) {
        visitStatement(
          stmt.elseStatement,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "whileStatement":
      visitExpression(
        stmt.condition,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
      visitStatement(
        stmt.body,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      return;
    case "forStatement":
      pushScope(scopes);
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          visitVariableDeclaration(
            stmt.initializer,
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
            stmt.initializer,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatement
          );
        }
      }
      if (stmt.condition) {
        visitExpression(
          stmt.condition,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatement
        );
      }
      if (stmt.update) {
        visitExpression(
          stmt.update,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatement
        );
      }
      visitStatement(
        stmt.body,
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
    case "forOfStatement":
    case "forInStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
      pushScope(scopes);
      declarePattern(stmt.variable, scopes);
      visitStatement(
        stmt.body,
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
    case "switchStatement":
      visitExpression(
        stmt.expression,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes,
        visitStatement
      );
      for (const caseStmt of stmt.cases) {
        if (caseStmt.test) {
          visitExpression(
            caseStmt.test,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes,
            visitStatement
          );
        }
        pushScope(scopes);
        for (const nested of caseStmt.statements) {
          visitStatement(
            nested,
            context,
            classes,
            interfaces,
            topLevelConstBindings,
            mutableModuleBindings,
            mutablePropertySlots,
            scopes
          );
        }
        popScope(scopes);
      }
      return;
    case "tryStatement":
      visitStatement(
        stmt.tryBlock,
        context,
        classes,
        interfaces,
        topLevelConstBindings,
        mutableModuleBindings,
        mutablePropertySlots,
        scopes
      );
      if (stmt.catchClause) {
        pushScope(
          scopes,
          stmt.catchClause.parameter
            ? collectPatternNames(stmt.catchClause.parameter)
            : []
        );
        visitStatement(
          stmt.catchClause.body,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
        popScope(scopes);
      }
      if (stmt.finallyBlock) {
        visitStatement(
          stmt.finallyBlock,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      return;
    case "blockStatement":
      pushScope(scopes);
      for (const nested of stmt.statements) {
        visitStatement(
          nested,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes
        );
      }
      popScope(scopes);
      return;
    case "yieldStatement":
      if (stmt.output) {
        visitExpression(
          stmt.output,
          context,
          classes,
          interfaces,
          topLevelConstBindings,
          mutableModuleBindings,
          mutablePropertySlots,
          scopes,
          visitStatement
        );
      }
      return;
  }
};
