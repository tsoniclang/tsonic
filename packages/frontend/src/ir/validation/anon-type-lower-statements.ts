/**
 * Anonymous type lowering for statements and class members.
 *
 * Circular import with anon-type-lower-expressions.ts is intentional and safe:
 * both modules export const functions only used after module initialization.
 */
import type {
  IrBlockStatement,
  IrClassMember,
  IrInterfaceMember,
  IrStatement,
  IrVariableDeclaration,
} from "../types.js";
import { stripNullishFromType } from "./anon-type-shape-analysis.js";
import type { LoweringContext } from "./anon-type-lower-types.js";
import {
  lowerInterfaceMember,
  lowerParameter,
  lowerPattern,
  lowerType,
  lowerTypeParameter,
} from "./anon-type-lower-types.js";
import { lowerExpression } from "./anon-type-lower-expressions.js";

export const lowerBlockStatement = (
  stmt: IrBlockStatement,
  ctx: LoweringContext
): IrBlockStatement => ({
  ...stmt,
  statements: stmt.statements.map((statement) => lowerStatement(statement, ctx)),
});

export const lowerVariableDeclaration = (
  stmt: IrVariableDeclaration,
  ctx: LoweringContext
): IrVariableDeclaration => ({
  ...stmt,
  declarations: stmt.declarations.map((declaration) => ({
    ...declaration,
    name: lowerPattern(declaration.name, ctx),
    type: declaration.type ? lowerType(declaration.type, ctx) : undefined,
    initializer: declaration.initializer
      ? lowerExpression(declaration.initializer, ctx)
      : undefined,
  })),
});

export const lowerClassMember = (
  member: IrClassMember,
  ctx: LoweringContext
): IrClassMember => {
  switch (member.kind) {
    case "methodDeclaration": {
      const loweredReturnType = member.returnType
        ? lowerType(member.returnType, ctx)
        : undefined;
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...member,
        typeParameters: member.typeParameters?.map((typeParameter) =>
          lowerTypeParameter(typeParameter, ctx)
        ),
        parameters: member.parameters.map((parameter) =>
          lowerParameter(parameter, ctx)
        ),
        returnType: loweredReturnType,
        body: member.body
          ? lowerBlockStatement(member.body, bodyCtx)
          : undefined,
      };
    }
    case "propertyDeclaration":
      return {
        ...member,
        type: member.type ? lowerType(member.type, ctx, member.name) : undefined,
        initializer: member.initializer
          ? lowerExpression(member.initializer, ctx)
          : undefined,
        getterBody: member.getterBody
          ? lowerBlockStatement(member.getterBody, ctx)
          : undefined,
        setterBody: member.setterBody
          ? lowerBlockStatement(member.setterBody, ctx)
          : undefined,
      };
    case "constructorDeclaration":
      return {
        ...member,
        parameters: member.parameters.map((parameter) =>
          lowerParameter(parameter, ctx)
        ),
        body: member.body ? lowerBlockStatement(member.body, ctx) : undefined,
      };
  }
};

export const lowerStatement = (
  stmt: IrStatement,
  ctx: LoweringContext
): IrStatement => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return lowerVariableDeclaration(stmt, ctx);

    case "functionDeclaration": {
      const loweredReturnType = stmt.returnType
        ? lowerType(stmt.returnType, ctx)
        : undefined;
      const bodyCtx: LoweringContext = {
        ...ctx,
        currentFunctionReturnType: loweredReturnType,
      };
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((typeParameter) =>
          lowerTypeParameter(typeParameter, ctx)
        ),
        parameters: stmt.parameters.map((parameter) =>
          lowerParameter(parameter, ctx)
        ),
        returnType: loweredReturnType,
        body: lowerBlockStatement(stmt.body, bodyCtx),
      };
    }

    case "classDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((typeParameter) =>
          lowerTypeParameter(typeParameter, ctx)
        ),
        superClass: stmt.superClass ? lowerType(stmt.superClass, ctx) : undefined,
        implements: stmt.implements.map((heritage) => lowerType(heritage, ctx)),
        members: stmt.members.map((member) => lowerClassMember(member, ctx)),
      };

    case "interfaceDeclaration":
      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((typeParameter) =>
          lowerTypeParameter(typeParameter, ctx)
        ),
        extends: stmt.extends.map((heritage) => lowerType(heritage, ctx)),
        members: stmt.members.map((member) => lowerInterfaceMember(member, ctx)),
      };

    case "enumDeclaration":
      return {
        ...stmt,
        members: stmt.members.map((member) => ({
          ...member,
          initializer: member.initializer
            ? lowerExpression(member.initializer, ctx)
            : undefined,
        })),
      };

    case "typeAliasDeclaration":
      if (stmt.type.kind === "objectType") {
        const loweredMembers: IrInterfaceMember[] = stmt.type.members.map(
          (member) => {
            if (member.kind === "propertySignature") {
              return {
                ...member,
                type: lowerType(member.type, ctx),
              };
            }
            if (member.kind === "methodSignature") {
              return {
                ...member,
                parameters: member.parameters.map((parameter) =>
                  lowerParameter(parameter, ctx)
                ),
                returnType: member.returnType
                  ? lowerType(member.returnType, ctx)
                  : undefined,
              };
            }
            return member;
          }
        );

        return {
          ...stmt,
          typeParameters: stmt.typeParameters?.map((typeParameter) =>
            lowerTypeParameter(typeParameter, ctx)
          ),
          type: {
            ...stmt.type,
            members: loweredMembers,
          },
        };
      }

      return {
        ...stmt,
        typeParameters: stmt.typeParameters?.map((typeParameter) =>
          lowerTypeParameter(typeParameter, ctx)
        ),
        type: lowerType(stmt.type, ctx),
      };

    case "expressionStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "returnStatement": {
      if (!stmt.expression) {
        return stmt;
      }
      const loweredExpr = lowerExpression(stmt.expression, ctx);
      if (
        ctx.currentFunctionReturnType &&
        loweredExpr.inferredType?.kind === "objectType"
      ) {
        const targetType = stripNullishFromType(ctx.currentFunctionReturnType);
        return {
          ...stmt,
          expression: { ...loweredExpr, inferredType: targetType },
        };
      }
      return {
        ...stmt,
        expression: loweredExpr,
      };
    }

    case "ifStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        thenStatement: lowerStatement(stmt.thenStatement, ctx),
        elseStatement: stmt.elseStatement
          ? lowerStatement(stmt.elseStatement, ctx)
          : undefined,
      };

    case "whileStatement":
      return {
        ...stmt,
        condition: lowerExpression(stmt.condition, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forStatement":
      return {
        ...stmt,
        initializer: stmt.initializer
          ? stmt.initializer.kind === "variableDeclaration"
            ? lowerVariableDeclaration(stmt.initializer, ctx)
            : lowerExpression(stmt.initializer, ctx)
          : undefined,
        condition: stmt.condition ? lowerExpression(stmt.condition, ctx) : undefined,
        update: stmt.update ? lowerExpression(stmt.update, ctx) : undefined,
        body: lowerStatement(stmt.body, ctx),
      };

    case "forOfStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "forInStatement":
      return {
        ...stmt,
        variable: lowerPattern(stmt.variable, ctx),
        expression: lowerExpression(stmt.expression, ctx),
        body: lowerStatement(stmt.body, ctx),
      };

    case "switchStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          test: switchCase.test ? lowerExpression(switchCase.test, ctx) : undefined,
          statements: switchCase.statements.map((statement) =>
            lowerStatement(statement, ctx)
          ),
        })),
      };

    case "throwStatement":
      return {
        ...stmt,
        expression: lowerExpression(stmt.expression, ctx),
      };

    case "tryStatement":
      return {
        ...stmt,
        tryBlock: lowerBlockStatement(stmt.tryBlock, ctx),
        catchClause: stmt.catchClause
          ? {
              ...stmt.catchClause,
              parameter: stmt.catchClause.parameter
                ? lowerPattern(stmt.catchClause.parameter, ctx)
                : undefined,
              body: lowerBlockStatement(stmt.catchClause.body, ctx),
            }
          : undefined,
        finallyBlock: stmt.finallyBlock
          ? lowerBlockStatement(stmt.finallyBlock, ctx)
          : undefined,
      };

    case "blockStatement":
      return lowerBlockStatement(stmt, ctx);

    case "yieldStatement":
      return {
        ...stmt,
        output: stmt.output ? lowerExpression(stmt.output, ctx) : undefined,
        receiveTarget: stmt.receiveTarget
          ? lowerPattern(stmt.receiveTarget, ctx)
          : undefined,
        receivedType: stmt.receivedType
          ? lowerType(stmt.receivedType, ctx)
          : undefined,
      };

    case "generatorReturnStatement":
      return {
        ...stmt,
        expression: stmt.expression
          ? lowerExpression(stmt.expression, ctx)
          : undefined,
      };

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      return stmt;
  }
};
