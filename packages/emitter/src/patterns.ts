/**
 * Pattern lowering (AST-only).
 *
 * Handles destructuring for:
 * - local declarations
 * - static/module-level field declarations
 * - assignment expressions
 */

import {
  IrArrayPattern,
  IrExpression,
  IrObjectPattern,
  IrPattern,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "./emitter-types/index.js";
import { emitTypeAst } from "./types/emitter.js";
import { emitExpressionAst } from "./expression-emitter.js";
import { emitCSharpName } from "./naming-policy.js";
import {
  allocateLocalName,
  emitRemappedLocalName,
  registerLocalName,
} from "./core/format/local-names.js";
import type {
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

const objectTypeAst: CSharpTypeAst = { kind: "identifierType", name: "object" };

const generateTemp = (
  prefix: string,
  ctx: EmitterContext
): [string, EmitterContext] => {
  const tempId = ctx.tempVarId ?? 0;
  const name = `__${prefix}${tempId}`;
  return [name, { ...ctx, tempVarId: tempId + 1 }];
};

const emitDefaultExprAst = (
  expr: IrExpression,
  ctx: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return [{ kind: "literalExpression", text: `"${expr.value}"` }, ctx];
    }
    if (typeof expr.value === "number") {
      return [{ kind: "literalExpression", text: String(expr.value) }, ctx];
    }
    if (typeof expr.value === "boolean") {
      return [
        { kind: "literalExpression", text: expr.value ? "true" : "false" },
        ctx,
      ];
    }
    if (expr.value === null) {
      return [{ kind: "literalExpression", text: "null" }, ctx];
    }
  }
  if (expr.kind === "identifier") {
    return [
      {
        kind: "identifierExpression",
        identifier: emitRemappedLocalName(expr.name, ctx),
      },
      ctx,
    ];
  }
  return emitExpressionAst(expr, ctx);
};

const getPropertyType = (
  type: IrType | undefined,
  key: string,
  ctx: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "objectType") {
    const prop = type.members.find(
      (m) => m.kind === "propertySignature" && m.name === key
    );
    return prop?.kind === "propertySignature" ? prop.type : undefined;
  }

  if (type.kind === "referenceType" && type.structuralMembers) {
    const prop = type.structuralMembers.find(
      (m) => m.kind === "propertySignature" && m.name === key
    );
    return prop?.kind === "propertySignature" ? prop.type : undefined;
  }

  if (type.kind === "referenceType") {
    const localType = ctx.localTypes?.get(type.name);
    if (!localType) return undefined;

    if (localType.kind === "interface") {
      const prop = localType.members.find(
        (m) => m.kind === "propertySignature" && m.name === key
      );
      return prop?.kind === "propertySignature" ? prop.type : undefined;
    }

    if (localType.kind === "class") {
      const prop = localType.members.find(
        (m) => m.kind === "propertyDeclaration" && m.name === key
      );
      return prop?.kind === "propertyDeclaration" ? prop.type : undefined;
    }

    if (localType.kind === "typeAlias") {
      return getPropertyType(localType.type, key, ctx);
    }
  }

  return undefined;
};

export type LoweringResultAst = {
  readonly statements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
};

const lowerIdentifierAst = (
  name: string,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const alloc = allocateLocalName(name, ctx);
  const localName = alloc.emittedName;
  let currentCtx = alloc.context;

  let typeAst: CSharpTypeAst = { kind: "varType" };
  if (type) {
    const [emittedType, next] = emitTypeAst(type, currentCtx);
    typeAst = emittedType;
    currentCtx = next;
  }

  const stmt: CSharpStatementAst = {
    kind: "localDeclarationStatement",
    modifiers: [],
    type: typeAst,
    declarators: [{ name: localName, initializer: inputExpr }],
  };

  currentCtx = registerLocalName(name, localName, currentCtx);
  return { statements: [stmt], context: currentCtx };
};

const lowerArrayPatternAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  elementType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("arr", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      index++;
      continue;
    }

    if (elem.isRest) {
      const sliceExpr: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: "Tsonic.Runtime.ArrayHelpers",
          },
          memberName: "Slice",
        },
        arguments: [tempId, { kind: "literalExpression", text: String(index) }],
      };
      const rest = lowerPatternAst(
        elem.pattern,
        sliceExpr,
        elementType ? { kind: "arrayType", elementType } : undefined,
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      break;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: tempId,
      arguments: [{ kind: "literalExpression", text: String(index) }],
    };

    let valueExpr: CSharpExpressionAst = accessExpr;
    if (elem.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        elem.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const nested = lowerPatternAst(
      elem.pattern,
      valueExpr,
      elementType,
      currentCtx
    );
    statements.push(...nested.statements);
    currentCtx = nested.context;
    index++;
  }

  return { statements, context: currentCtx };
};

const lowerObjectPatternAst = (
  pattern: IrObjectPattern,
  inputExpr: CSharpExpressionAst,
  inputType: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  const statements: CSharpStatementAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("obj", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempId: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      if (!prop.restShapeMembers || !prop.restSynthTypeName) {
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
      }

      const initMembers = prop.restShapeMembers
        .filter((m) => m.kind === "propertySignature")
        .map((m) => ({
          kind: "assignmentExpression" as const,
          operatorToken: "=" as const,
          left: {
            kind: "identifierExpression" as const,
            identifier: m.name,
          },
          right: {
            kind: "memberAccessExpression" as const,
            expression: tempId,
            memberName: m.name,
          },
        }));

      const restExpr: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: { kind: "identifierType", name: prop.restSynthTypeName },
        arguments: [],
        initializer: initMembers,
      };
      const rest = lowerPatternAst(
        prop.pattern,
        restExpr,
        undefined,
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      continue;
    }

    const propAccessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempId,
      memberName: prop.key,
    };

    let valueExpr: CSharpExpressionAst = propAccessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: propAccessExpr,
        right: defaultAst,
      };
    }

    const propType = getPropertyType(inputType, prop.key, currentCtx);
    const nested = lowerPatternAst(prop.value, valueExpr, propType, currentCtx);
    statements.push(...nested.statements);
    currentCtx = nested.context;
  }

  return { statements, context: currentCtx };
};

export const lowerPatternAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): LoweringResultAst => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifierAst(pattern.name, inputExpr, type, ctx);
    case "arrayPattern": {
      const elementType =
        type?.kind === "arrayType" ? type.elementType : undefined;
      return lowerArrayPatternAst(pattern, inputExpr, elementType, ctx);
    }
    case "objectPattern":
      return lowerObjectPatternAst(pattern, inputExpr, type, ctx);
  }
};

export type StaticPatternLoweringResultAst = {
  readonly members: readonly CSharpMemberAst[];
  readonly context: EmitterContext;
};

const createStaticField = (
  name: string,
  type: CSharpTypeAst,
  initializer: CSharpExpressionAst
): CSharpMemberAst => ({
  kind: "fieldDeclaration",
  attributes: [],
  modifiers: ["private", "static", "readonly"],
  type,
  name,
  initializer,
});

const lowerIdentifierStaticAst = (
  name: string,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  let currentCtx = ctx;
  let typeAst: CSharpTypeAst = objectTypeAst;
  if (type) {
    const [emittedType, next] = emitTypeAst(type, currentCtx);
    typeAst = emittedType;
    currentCtx = next;
  }
  return {
    members: [
      createStaticField(
        emitCSharpName(name, "fields", ctx),
        typeAst,
        inputExpr
      ),
    ],
    context: currentCtx,
  };
};

const lowerArrayPatternStaticAst = (
  pattern: IrArrayPattern,
  inputExpr: CSharpExpressionAst,
  elementType: IrType | undefined,
  arrayType: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  const members: CSharpMemberAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("arr", currentCtx);
  currentCtx = nextCtx;
  const tempName = emitCSharpName(rawTempName, "fields", currentCtx);

  let tempTypeAst: CSharpTypeAst = objectTypeAst;
  if (arrayType) {
    const [emittedType, typeCtx] = emitTypeAst(arrayType, currentCtx);
    tempTypeAst = emittedType;
    currentCtx = typeCtx;
  }
  members.push(createStaticField(tempName, tempTypeAst, inputExpr));

  const tempExpr: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  let index = 0;
  for (const elem of pattern.elements) {
    if (!elem) {
      index++;
      continue;
    }
    if (elem.isRest) {
      const restExpr: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: {
            kind: "identifierExpression",
            identifier: "Tsonic.Runtime.ArrayHelpers",
          },
          memberName: "Slice",
        },
        arguments: [
          tempExpr,
          { kind: "literalExpression", text: String(index) },
        ],
      };
      const rest = lowerPatternToStaticMembersAst(
        elem.pattern,
        restExpr,
        elementType ? { kind: "arrayType", elementType } : undefined,
        currentCtx
      );
      members.push(...rest.members);
      currentCtx = rest.context;
      break;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "elementAccessExpression",
      expression: tempExpr,
      arguments: [{ kind: "literalExpression", text: String(index) }],
    };
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (elem.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        elem.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const nested = lowerPatternToStaticMembersAst(
      elem.pattern,
      valueExpr,
      elementType,
      currentCtx
    );
    members.push(...nested.members);
    currentCtx = nested.context;
    index++;
  }

  return { members, context: currentCtx };
};

const lowerObjectPatternStaticAst = (
  pattern: IrObjectPattern,
  inputExpr: CSharpExpressionAst,
  inputType: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  const members: CSharpMemberAst[] = [];
  let currentCtx = ctx;

  const [rawTempName, nextCtx] = generateTemp("obj", currentCtx);
  currentCtx = nextCtx;
  const tempName = emitCSharpName(rawTempName, "fields", currentCtx);

  let tempTypeAst: CSharpTypeAst = objectTypeAst;
  if (inputType) {
    const [emittedType, typeCtx] = emitTypeAst(inputType, currentCtx);
    tempTypeAst = emittedType;
    currentCtx = typeCtx;
  }
  members.push(createStaticField(tempName, tempTypeAst, inputExpr));

  const tempExpr: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      if (!prop.restShapeMembers || !prop.restSynthTypeName) {
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
      }
      const initMembers = prop.restShapeMembers
        .filter((m) => m.kind === "propertySignature")
        .map((m) => ({
          kind: "assignmentExpression" as const,
          operatorToken: "=" as const,
          left: {
            kind: "identifierExpression" as const,
            identifier: m.name,
          },
          right: {
            kind: "memberAccessExpression" as const,
            expression: tempExpr,
            memberName: m.name,
          },
        }));

      const restExpr: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: { kind: "identifierType", name: prop.restSynthTypeName },
        arguments: [],
        initializer: initMembers,
      };
      const rest = lowerPatternToStaticMembersAst(
        prop.pattern,
        restExpr,
        undefined,
        currentCtx
      );
      members.push(...rest.members);
      currentCtx = rest.context;
      continue;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempExpr,
      memberName: prop.key,
    };
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const propType = getPropertyType(inputType, prop.key, currentCtx);
    const nested = lowerPatternToStaticMembersAst(
      prop.value,
      valueExpr,
      propType,
      currentCtx
    );
    members.push(...nested.members);
    currentCtx = nested.context;
  }

  return { members, context: currentCtx };
};

export const lowerPatternToStaticMembersAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): StaticPatternLoweringResultAst => {
  switch (pattern.kind) {
    case "identifierPattern":
      return lowerIdentifierStaticAst(pattern.name, inputExpr, type, ctx);
    case "arrayPattern": {
      const elementType =
        type?.kind === "arrayType" ? type.elementType : undefined;
      return lowerArrayPatternStaticAst(
        pattern,
        inputExpr,
        elementType,
        type,
        ctx
      );
    }
    case "objectPattern":
      return lowerObjectPatternStaticAst(pattern, inputExpr, type, ctx);
  }
};

type AssignmentPatternLoweringResultAst = {
  readonly expression: CSharpExpressionAst;
  readonly context: EmitterContext;
};

const isRuntimeRepresentableType = (type: IrType): boolean => {
  if (type.kind === "anyType" || type.kind === "unknownType") return false;
  if (type.kind === "objectType") return false;
  if (type.kind === "unionType") {
    return type.types.every(isRuntimeRepresentableType);
  }
  return true;
};

const resolveAssignmentResultTypeAst = (
  type: IrType | undefined,
  ctx: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  if (!type || !isRuntimeRepresentableType(type)) {
    return [objectTypeAst, ctx];
  }
  return emitTypeAst(type, ctx);
};

const lowerAssignmentPatternStatementsAst = (
  pattern: IrPattern,
  inputExpr: CSharpExpressionAst,
  type: IrType | undefined,
  ctx: EmitterContext
): {
  readonly statements: readonly CSharpStatementAst[];
  readonly context: EmitterContext;
} => {
  if (pattern.kind === "identifierPattern") {
    return {
      statements: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            operatorToken: "=",
            left: {
              kind: "identifierExpression",
              identifier: emitRemappedLocalName(pattern.name, ctx),
            },
            right: inputExpr,
          },
        },
      ],
      context: ctx,
    };
  }

  let currentCtx = ctx;
  const statements: CSharpStatementAst[] = [];

  const [rawTempName, nextCtx] = generateTemp("t", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawTempName, currentCtx);
  const tempName = alloc.emittedName;
  currentCtx = alloc.context;

  statements.push({
    kind: "localDeclarationStatement",
    modifiers: [],
    type: { kind: "varType" },
    declarators: [{ name: tempName, initializer: inputExpr }],
  });

  const tempExpr: CSharpExpressionAst = {
    kind: "identifierExpression",
    identifier: tempName,
  };

  if (pattern.kind === "arrayPattern") {
    const elementType =
      type?.kind === "arrayType" ? type.elementType : undefined;
    let index = 0;
    for (const elem of pattern.elements) {
      if (!elem) {
        index++;
        continue;
      }
      if (elem.isRest) {
        const restExpr: CSharpExpressionAst = {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: {
              kind: "identifierExpression",
              identifier: "Tsonic.Runtime.ArrayHelpers",
            },
            memberName: "Slice",
          },
          arguments: [
            tempExpr,
            { kind: "literalExpression", text: String(index) },
          ],
        };
        const rest = lowerAssignmentPatternStatementsAst(
          elem.pattern,
          restExpr,
          elementType ? { kind: "arrayType", elementType } : undefined,
          currentCtx
        );
        statements.push(...rest.statements);
        currentCtx = rest.context;
        break;
      }

      const accessExpr: CSharpExpressionAst = {
        kind: "elementAccessExpression",
        expression: tempExpr,
        arguments: [{ kind: "literalExpression", text: String(index) }],
      };
      let valueExpr: CSharpExpressionAst = accessExpr;
      if (elem.defaultExpr) {
        const [defaultAst, defaultCtx] = emitDefaultExprAst(
          elem.defaultExpr,
          currentCtx
        );
        currentCtx = defaultCtx;
        valueExpr = {
          kind: "binaryExpression",
          operatorToken: "??",
          left: accessExpr,
          right: defaultAst,
        };
      }

      const nested = lowerAssignmentPatternStatementsAst(
        elem.pattern,
        valueExpr,
        elementType,
        currentCtx
      );
      statements.push(...nested.statements);
      currentCtx = nested.context;
      index++;
    }

    return { statements, context: currentCtx };
  }

  for (const prop of pattern.properties) {
    if (prop.kind === "rest") {
      if (!prop.restShapeMembers || !prop.restSynthTypeName) {
        throw new Error(
          "Object rest destructuring requires rest shape information from the frontend (restShapeMembers/restSynthTypeName)."
        );
      }
      const initMembers = prop.restShapeMembers
        .filter((m) => m.kind === "propertySignature")
        .map((m) => ({
          kind: "assignmentExpression" as const,
          operatorToken: "=" as const,
          left: {
            kind: "identifierExpression" as const,
            identifier: m.name,
          },
          right: {
            kind: "memberAccessExpression" as const,
            expression: tempExpr,
            memberName: m.name,
          },
        }));

      const restExpr: CSharpExpressionAst = {
        kind: "objectCreationExpression",
        type: { kind: "identifierType", name: prop.restSynthTypeName },
        arguments: [],
        initializer: initMembers,
      };
      const rest = lowerAssignmentPatternStatementsAst(
        prop.pattern,
        restExpr,
        undefined,
        currentCtx
      );
      statements.push(...rest.statements);
      currentCtx = rest.context;
      continue;
    }

    const accessExpr: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: tempExpr,
      memberName: prop.key,
    };
    let valueExpr: CSharpExpressionAst = accessExpr;
    if (prop.defaultExpr) {
      const [defaultAst, defaultCtx] = emitDefaultExprAst(
        prop.defaultExpr,
        currentCtx
      );
      currentCtx = defaultCtx;
      valueExpr = {
        kind: "binaryExpression",
        operatorToken: "??",
        left: accessExpr,
        right: defaultAst,
      };
    }

    const propType = getPropertyType(type, prop.key, currentCtx);
    const nested = lowerAssignmentPatternStatementsAst(
      prop.value,
      valueExpr,
      propType,
      currentCtx
    );
    statements.push(...nested.statements);
    currentCtx = nested.context;
  }

  return { statements, context: currentCtx };
};

export const lowerAssignmentPatternAst = (
  pattern: IrPattern,
  rhsExpr: CSharpExpressionAst,
  rhsType: IrType | undefined,
  ctx: EmitterContext
): AssignmentPatternLoweringResultAst => {
  if (pattern.kind === "identifierPattern") {
    return {
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: emitRemappedLocalName(pattern.name, ctx),
        },
        right: rhsExpr,
      },
      context: ctx,
    };
  }

  let currentCtx = ctx;
  const [resultTypeAst, typeCtx] = resolveAssignmentResultTypeAst(
    rhsType,
    currentCtx
  );
  currentCtx = typeCtx;

  const [rawResultName, nextCtx] = generateTemp("assign", currentCtx);
  currentCtx = nextCtx;
  const alloc = allocateLocalName(rawResultName, currentCtx);
  const resultName = alloc.emittedName;
  currentCtx = alloc.context;

  const nested = lowerAssignmentPatternStatementsAst(
    pattern,
    {
      kind: "identifierExpression",
      identifier: resultName,
    },
    rhsType,
    currentCtx
  );
  currentCtx = nested.context;

  const lambdaStatements: CSharpStatementAst[] = [
    {
      kind: "localDeclarationStatement",
      modifiers: [],
      type: resultTypeAst,
      declarators: [{ name: resultName, initializer: rhsExpr }],
    },
    ...nested.statements,
    {
      kind: "returnStatement",
      expression: { kind: "identifierExpression", identifier: resultName },
    },
  ];

  const iifeExpr: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: {
          kind: "identifierType",
          name: "global::System.Func",
          typeArguments: [resultTypeAst],
        },
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [],
            body: { kind: "blockStatement", statements: lambdaStatements },
          },
        },
      },
    },
    arguments: [],
  };

  return { expression: iifeExpr, context: currentCtx };
};
