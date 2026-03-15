/**
 * Unsafe feature detection (pointers)
 *
 * Used to decide when to emit `unsafe` modifiers in generated C#.
 */

import type {
  IrExpression,
  IrInterfaceMember,
  IrStatement,
  IrType,
  IrClassMember,
  IrParameter,
  IrVariableDeclarator,
  IrModule,
} from "@tsonic/frontend";

const typeUsesPointerInternal = (
  type: IrType | undefined,
  seen: WeakSet<object>
): boolean => {
  if (!type) return false;
  if (typeof type === "object" && type !== null) {
    if (seen.has(type)) return false;
    seen.add(type);
  }

  switch (type.kind) {
    case "referenceType": {
      if (type.name === "ptr") return true;
      if (type.typeArguments && type.typeArguments.length > 0) {
        return type.typeArguments.some((t) => typeUsesPointerInternal(t, seen));
      }
      if (type.structuralMembers && type.structuralMembers.length > 0) {
        return interfaceMembersUsePointer(type.structuralMembers, seen);
      }
      return false;
    }

    case "arrayType":
      return typeUsesPointerInternal(type.elementType, seen);

    case "dictionaryType":
      return (
        typeUsesPointerInternal(type.keyType, seen) ||
        typeUsesPointerInternal(type.valueType, seen)
      );

    case "tupleType":
      return type.elementTypes.some((t) => typeUsesPointerInternal(t, seen));

    case "functionType":
      return (
        type.parameters.some((p) => typeUsesPointerInternal(p.type, seen)) ||
        typeUsesPointerInternal(type.returnType, seen)
      );

    case "objectType":
      return interfaceMembersUsePointer(type.members, seen);

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => typeUsesPointerInternal(t, seen));

    case "typeParameterType":
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;
  }
};

export const typeUsesPointer = (type: IrType | undefined): boolean =>
  typeUsesPointerInternal(type, new WeakSet<object>());

const interfaceMembersUsePointer = (
  members: readonly IrInterfaceMember[],
  seen: WeakSet<object>
): boolean => {
  for (const member of members) {
    if (member.kind === "propertySignature") {
      if (typeUsesPointerInternal(member.type, seen)) return true;
      continue;
    }

    if (member.kind === "methodSignature") {
      if (
        member.parameters.some((p) => typeUsesPointerInternal(p.type, seen))
      ) {
        return true;
      }
      if (typeUsesPointerInternal(member.returnType, seen)) return true;
      continue;
    }
  }
  return false;
};

const classMembersUsePointer = (members: readonly IrClassMember[]): boolean => {
  for (const member of members) {
    if (member.kind === "propertyDeclaration") {
      if (typeUsesPointer(member.type)) return true;
      if (expressionUsesPointer(member.initializer)) return true;
      continue;
    }

    if (member.kind === "methodDeclaration") {
      if (typeUsesPointer(member.returnType)) return true;
      if (parametersUsePointer(member.parameters)) return true;
      if (member.body && statementUsesPointer(member.body)) return true;
      continue;
    }

    if (member.kind === "constructorDeclaration") {
      if (parametersUsePointer(member.parameters)) return true;
      if (member.body && statementUsesPointer(member.body)) return true;
      continue;
    }
  }

  return false;
};

const parametersUsePointer = (params: readonly IrParameter[]): boolean =>
  params.some((p) => typeUsesPointer(p.type));

const variableDeclaratorsUsePointer = (
  decls: readonly IrVariableDeclarator[]
): boolean => {
  for (const decl of decls) {
    if (typeUsesPointer(decl.type)) return true;
    if (expressionUsesPointer(decl.initializer)) return true;
  }
  return false;
};

export const expressionUsesPointer = (
  expr: IrExpression | undefined
): boolean => {
  if (!expr) return false;

  switch (expr.kind) {
    case "asinterface":
      return (
        expressionUsesPointer(expr.expression) ||
        typeUsesPointer(expr.targetType)
      );

    case "typeAssertion":
      return (
        expressionUsesPointer(expr.expression) ||
        typeUsesPointer(expr.targetType)
      );

    case "trycast":
      return (
        expressionUsesPointer(expr.expression) ||
        typeUsesPointer(expr.targetType)
      );

    case "stackalloc":
      return (
        typeUsesPointer(expr.elementType) ||
        expressionUsesPointer(expr.size) ||
        typeUsesPointer(expr.inferredType)
      );

    case "defaultof":
      return typeUsesPointer(expr.targetType);

    case "nameof":
      return false;

    case "sizeof":
      return typeUsesPointer(expr.targetType);

    case "call": {
      if (expressionUsesPointer(expr.callee)) return true;
      if (expr.typeArguments?.some((t) => typeUsesPointer(t))) return true;
      if (expr.parameterTypes?.some((t) => typeUsesPointer(t))) return true;
      if (expr.narrowing && typeUsesPointer(expr.narrowing.targetType))
        return true;
      for (const arg of expr.arguments) {
        if (arg.kind === "spread") {
          if (expressionUsesPointer(arg.expression)) return true;
          continue;
        }
        if (expressionUsesPointer(arg)) return true;
      }
      return false;
    }

    case "new":
      return (
        expressionUsesPointer(expr.callee) ||
        (expr.typeArguments?.some((t) => typeUsesPointer(t)) ?? false) ||
        expr.arguments.some((a) =>
          a.kind === "spread"
            ? expressionUsesPointer(a.expression)
            : expressionUsesPointer(a)
        )
      );

    case "memberAccess":
      return (
        expressionUsesPointer(expr.object) ||
        (expr.isComputed && typeof expr.property !== "string"
          ? expressionUsesPointer(expr.property)
          : false)
      );

    case "array":
      return expr.elements.some((e) =>
        e === undefined
          ? false
          : e.kind === "spread"
            ? expressionUsesPointer(e.expression)
            : expressionUsesPointer(e)
      );

    case "object":
      return expr.properties.some((p) =>
        p.kind === "spread"
          ? expressionUsesPointer(p.expression)
          : expressionUsesPointer(p.value) ||
            (typeof p.key === "string" ? false : expressionUsesPointer(p.key))
      );

    case "functionExpression":
      return (
        parametersUsePointer(expr.parameters) ||
        typeUsesPointer(expr.returnType) ||
        statementUsesPointer(expr.body)
      );

    case "arrowFunction":
      return (
        parametersUsePointer(expr.parameters) ||
        typeUsesPointer(expr.returnType) ||
        (expr.body.kind === "blockStatement"
          ? statementUsesPointer(expr.body)
          : expressionUsesPointer(expr.body))
      );

    case "assignment":
      return (
        ("kind" in expr.left
          ? expressionUsesPointer(expr.left as IrExpression)
          : false) || expressionUsesPointer(expr.right)
      );

    case "binary":
    case "logical":
      return (
        expressionUsesPointer(expr.left) || expressionUsesPointer(expr.right)
      );

    case "unary":
    case "update":
    case "await":
    case "spread":
    case "numericNarrowing":
      return expressionUsesPointer(expr.expression);

    case "conditional":
      return (
        expressionUsesPointer(expr.condition) ||
        expressionUsesPointer(expr.whenTrue) ||
        expressionUsesPointer(expr.whenFalse)
      );

    case "yield":
      return expressionUsesPointer(expr.expression);

    case "templateLiteral":
      return expr.expressions.some((e) => expressionUsesPointer(e));

    case "identifier":
    case "literal":
    case "this":
      return false;
  }
};

export const statementUsesPointer = (stmt: IrStatement): boolean => {
  switch (stmt.kind) {
    case "variableDeclaration":
      return variableDeclaratorsUsePointer(stmt.declarations);

    case "functionDeclaration":
      return (
        parametersUsePointer(stmt.parameters) ||
        typeUsesPointer(stmt.returnType) ||
        statementUsesPointer(stmt.body)
      );

    case "classDeclaration":
      return (
        typeUsesPointer(stmt.superClass) ||
        stmt.implements.some((t) => typeUsesPointer(t)) ||
        classMembersUsePointer(stmt.members)
      );

    case "interfaceDeclaration":
      return (
        (stmt.extends?.some((t) => typeUsesPointer(t)) ?? false) ||
        interfaceMembersUsePointer(stmt.members, new WeakSet<object>())
      );

    case "typeAliasDeclaration":
      return typeUsesPointer(stmt.type);

    case "enumDeclaration":
    case "emptyStatement":
    case "breakStatement":
    case "continueStatement":
      return false;

    case "expressionStatement":
      return expressionUsesPointer(stmt.expression);

    case "returnStatement":
      return expressionUsesPointer(stmt.expression);

    case "ifStatement":
      return (
        expressionUsesPointer(stmt.condition) ||
        statementUsesPointer(stmt.thenStatement) ||
        (stmt.elseStatement ? statementUsesPointer(stmt.elseStatement) : false)
      );

    case "whileStatement":
      return (
        expressionUsesPointer(stmt.condition) || statementUsesPointer(stmt.body)
      );

    case "forStatement": {
      const initUsesPointer = stmt.initializer
        ? stmt.initializer.kind === "variableDeclaration"
          ? variableDeclaratorsUsePointer(stmt.initializer.declarations)
          : expressionUsesPointer(stmt.initializer)
        : false;
      return (
        initUsesPointer ||
        expressionUsesPointer(stmt.condition) ||
        expressionUsesPointer(stmt.update) ||
        statementUsesPointer(stmt.body)
      );
    }

    case "forOfStatement":
      return (
        expressionUsesPointer(stmt.expression) ||
        statementUsesPointer(stmt.body)
      );

    case "forInStatement":
      return (
        expressionUsesPointer(stmt.expression) ||
        statementUsesPointer(stmt.body)
      );

    case "switchStatement":
      return (
        expressionUsesPointer(stmt.expression) ||
        stmt.cases.some(
          (c) =>
            expressionUsesPointer(c.test) ||
            c.statements.some((s) => statementUsesPointer(s))
        )
      );

    case "throwStatement":
      return expressionUsesPointer(stmt.expression);

    case "tryStatement":
      return (
        statementUsesPointer(stmt.tryBlock) ||
        (stmt.catchClause
          ? statementUsesPointer(stmt.catchClause.body)
          : false) ||
        (stmt.finallyBlock ? statementUsesPointer(stmt.finallyBlock) : false)
      );

    case "blockStatement":
      return stmt.statements.some((s) => statementUsesPointer(s));

    case "yieldStatement":
      return (
        expressionUsesPointer(stmt.output) || typeUsesPointer(stmt.receivedType)
      );

    case "generatorReturnStatement":
      return expressionUsesPointer(stmt.expression);
  }
};

export const moduleUsesPointer = (module: IrModule): boolean => {
  for (const stmt of module.body) {
    if (statementUsesPointer(stmt)) return true;
  }
  return false;
};
