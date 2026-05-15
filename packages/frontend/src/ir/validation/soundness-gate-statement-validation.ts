import {
  type IrModule,
  type IrIfBranchPlan,
  type IrIfGuardShape,
  type IrStatement,
  type ValidationContext,
  createDiagnostic,
  moduleLocation,
} from "./soundness-gate-shared.js";
import { validateExpression } from "./soundness-gate-expression-validation.js";
import {
  validateInterfaceMember,
  validateParameter,
  validatePattern,
  validateType,
  validateTypeParameter,
} from "./soundness-gate-type-validation.js";
import { classifyIfGuardShape } from "../converters/statements/control/if-branch-plan.js";
import { invertIfGuardShape } from "../types.js";

const validateGuardShape = (
  guardShape: IrIfGuardShape,
  ctx: ValidationContext
): void => {
  switch (guardShape.kind) {
    case "typeofGuard":
      validateExpression(guardShape.target, ctx);
      break;
    case "instanceofGuard":
      validateExpression(guardShape.target, ctx);
      validateExpression(guardShape.typeExpression, ctx);
      break;
    case "arrayIsArrayGuard":
    case "propertyExistence":
    case "propertyTruthiness":
    case "nullableGuard":
      validateExpression(guardShape.target, ctx);
      break;
    case "discriminantEquality":
      validateExpression(guardShape.target, ctx);
      break;
    case "compound":
      validateGuardShape(guardShape.left, ctx);
      validateGuardShape(guardShape.right, ctx);
      break;
    case "opaqueBoolean":
      break;
  }
};

const validateIfBranchPlan = (
  plan: IrIfBranchPlan | undefined,
  condition: Extract<IrStatement, { kind: "ifStatement" }>["condition"],
  label: string,
  ctx: ValidationContext
): void => {
  if (!plan) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN7430",
        "error",
        `If-statement is missing authoritative ${label} branch plan.`,
        moduleLocation(ctx),
        "The frontend must attach IrIfBranchPlan before the soundness gate so the emitter consumes decisions instead of rediscovering them from source shape."
      )
    );
    return;
  }

  const expectedShape =
    label === "then"
      ? classifyIfGuardShape(condition, "truthy")
      : invertIfGuardShape(classifyIfGuardShape(condition, "truthy"));
  if (
    plan.guardShape.kind !== expectedShape.kind ||
    plan.guardShape.polarity !== expectedShape.polarity
  ) {
    ctx.diagnostics.push(
      createDiagnostic(
        "TSN7430",
        "error",
        `If-statement ${label} branch plan does not match its condition.`,
        moduleLocation(ctx),
        "Recompute IrIfBranchPlan whenever the condition is transformed; the emitter must consume the plan as the authoritative branch decision."
      )
    );
  }

  validateGuardShape(plan.guardShape, ctx);
  for (const narrowing of plan.narrowedBindings) {
    validateExpression(narrowing.targetExpr, ctx);
    validateType(narrowing.targetType, ctx, `${label} branch narrowing`);
  }
};

export const validateStatement = (
  stmt: IrStatement,
  ctx: ValidationContext
): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      stmt.declarations.forEach((declaration) => {
        validatePattern(declaration.name, ctx);
        validateType(declaration.type, ctx, "variable declaration type");
        if (declaration.initializer) {
          validateExpression(declaration.initializer, ctx);
        }
      });
      break;

    case "functionDeclaration":
      stmt.typeParameters?.forEach((typeParameter) =>
        validateTypeParameter(typeParameter, ctx)
      );
      stmt.parameters.forEach((parameter) => validateParameter(parameter, ctx));
      validateType(stmt.returnType, ctx, `function '${stmt.name}' return type`);
      validateStatement(stmt.body, ctx);
      break;

    case "classDeclaration":
      stmt.typeParameters?.forEach((typeParameter) =>
        validateTypeParameter(typeParameter, ctx)
      );
      if (stmt.superClass) {
        validateType(stmt.superClass, ctx, `class '${stmt.name}' extends`);
      }
      stmt.implements.forEach((heritage, index) =>
        validateType(heritage, ctx, `class '${stmt.name}' implements ${index}`)
      );
      stmt.members.forEach((member) => {
        switch (member.kind) {
          case "methodDeclaration":
            member.typeParameters?.forEach((typeParameter) =>
              validateTypeParameter(typeParameter, ctx)
            );
            member.parameters.forEach((parameter) =>
              validateParameter(parameter, ctx)
            );
            validateType(
              member.returnType,
              ctx,
              `method '${member.name}' return type`
            );
            if (member.body) {
              validateStatement(member.body, ctx);
            }
            break;
          case "propertyDeclaration":
            validateType(member.type, ctx, `property '${member.name}'`);
            if (member.initializer) {
              validateExpression(member.initializer, ctx);
            }
            break;
          case "constructorDeclaration":
            member.parameters.forEach((parameter) =>
              validateParameter(parameter, ctx)
            );
            if (member.body) {
              validateStatement(member.body, ctx);
            }
            break;
        }
      });
      break;

    case "interfaceDeclaration":
      stmt.typeParameters?.forEach((typeParameter) =>
        validateTypeParameter(typeParameter, ctx)
      );
      stmt.extends.forEach((heritage, index) =>
        validateType(heritage, ctx, `interface '${stmt.name}' extends ${index}`)
      );
      stmt.members.forEach((member) => validateInterfaceMember(member, ctx));
      break;

    case "enumDeclaration":
      stmt.members.forEach((member) => {
        if (member.initializer) {
          validateExpression(member.initializer, ctx);
        }
      });
      break;

    case "typeAliasDeclaration":
      stmt.typeParameters?.forEach((typeParameter) =>
        validateTypeParameter(typeParameter, ctx)
      );
      if (stmt.type.kind === "objectType") {
        stmt.type.members.forEach((member) =>
          validateInterfaceMember(member, ctx)
        );
      }
      break;

    case "expressionStatement":
      validateExpression(stmt.expression, ctx);
      break;

    case "returnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx);
      }
      break;

    case "ifStatement":
      validateExpression(stmt.condition, ctx);
      validateIfBranchPlan(stmt.thenPlan, stmt.condition, "then", ctx);
      validateIfBranchPlan(stmt.elsePlan, stmt.condition, "else", ctx);
      validateStatement(stmt.thenStatement, ctx);
      if (stmt.elseStatement) {
        validateStatement(stmt.elseStatement, ctx);
      }
      break;

    case "whileStatement":
      validateExpression(stmt.condition, ctx);
      validateStatement(stmt.body, ctx);
      break;

    case "forStatement":
      if (stmt.initializer) {
        if (stmt.initializer.kind === "variableDeclaration") {
          validateStatement(stmt.initializer, ctx);
        } else {
          validateExpression(stmt.initializer, ctx);
        }
      }
      if (stmt.condition) {
        validateExpression(stmt.condition, ctx);
      }
      if (stmt.update) {
        validateExpression(stmt.update, ctx);
      }
      validateStatement(stmt.body, ctx);
      break;

    case "forOfStatement":
      validatePattern(stmt.variable, ctx);
      validateExpression(stmt.expression, ctx);
      validateStatement(stmt.body, ctx);
      break;

    case "switchStatement":
      validateExpression(stmt.expression, ctx);
      stmt.cases.forEach((switchCase) => {
        if (switchCase.test) {
          validateExpression(switchCase.test, ctx);
        }
        switchCase.statements.forEach((statement) =>
          validateStatement(statement, ctx)
        );
      });
      break;

    case "throwStatement":
      validateExpression(stmt.expression, ctx);
      break;

    case "tryStatement":
      validateStatement(stmt.tryBlock, ctx);
      if (stmt.catchClause) {
        if (stmt.catchClause.parameter) {
          validatePattern(stmt.catchClause.parameter, ctx);
        }
        validateStatement(stmt.catchClause.body, ctx);
      }
      if (stmt.finallyBlock) {
        validateStatement(stmt.finallyBlock, ctx);
      }
      break;

    case "blockStatement":
      stmt.statements.forEach((statement) => validateStatement(statement, ctx));
      break;

    case "yieldStatement":
      if (stmt.output) {
        validateExpression(stmt.output, ctx);
      }
      if (stmt.receiveTarget) {
        validatePattern(stmt.receiveTarget, ctx);
      }
      if (stmt.receivedType) {
        validateType(stmt.receivedType, ctx, "yield received type");
      }
      break;

    case "generatorReturnStatement":
      if (stmt.expression) {
        validateExpression(stmt.expression, ctx);
      }
      break;

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      break;
  }
};

export const extractLocalTypeNames = (
  statements: readonly IrStatement[]
): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const statement of statements) {
    switch (statement.kind) {
      case "classDeclaration":
      case "interfaceDeclaration":
      case "typeAliasDeclaration":
      case "enumDeclaration":
        names.add(statement.name);
        break;
    }
  }

  return names;
};

export const extractImportedTypeNames = (
  module: IrModule
): ReadonlySet<string> => {
  const names = new Set<string>();
  const addImportedNameVariants = (name: string): void => {
    names.add(name);

    if (!name.endsWith("$instance")) {
      names.add(`${name}$instance`);
    }

    if (!(name.startsWith("__") && name.endsWith("$views"))) {
      names.add(`__${name}$views`);
    }
  };

  for (const imp of module.imports) {
    for (const specifier of imp.specifiers) {
      if (specifier.kind === "named" || specifier.kind === "default") {
        addImportedNameVariants(specifier.localName);
        if (specifier.kind === "named") {
          addImportedNameVariants(specifier.name);
        }
      }
      if (specifier.kind === "namespace") {
        addImportedNameVariants(specifier.localName);
      }
    }
  }

  return names;
};
