import {
  createUnsupportedCapabilityDiagnostic,
  createDiagnostic,
  moduleLocation,
  shouldReportUnsupportedCapability,
  type IrExpression,
  type IrParameter,
  type ValidationContext,
} from "./soundness-gate-shared.js";
import {
  validatePattern,
  validateType,
} from "./soundness-gate-type-validation.js";
import { validateStatement } from "./soundness-gate-statement-validation.js";
import type { IrType } from "../types.js";
import { canonicalCoreModuleSpecifier } from "../../source-frontend/core-module-identity.js";

const typeContainsPoison = (type: IrType | undefined): boolean => {
  if (!type) return false;

  switch (type.kind) {
    case "anyType":
    case "unknownType":
      return true;

    case "arrayType":
      return typeContainsPoison(type.elementType);

    case "tupleType":
      return type.elementTypes.some((element) => typeContainsPoison(element));

    case "functionType":
      return (
        type.parameters.some((parameter) =>
          typeContainsPoison(parameter.type)
        ) || typeContainsPoison(type.returnType)
      );

    case "dictionaryType":
      return (
        typeContainsPoison(type.keyType) || typeContainsPoison(type.valueType)
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((member) => typeContainsPoison(member));

    case "referenceType":
      return (
        type.typeArguments?.some((arg) => typeContainsPoison(arg)) ?? false
      );

    case "objectType":
      return type.members.some((member) =>
        member.kind === "propertySignature"
          ? typeContainsPoison(member.type)
          : member.parameters.some((parameter) =>
              typeContainsPoison(parameter.type)
            ) || typeContainsPoison(member.returnType)
      );

    case "primitiveType":
    case "typeParameterType":
    case "literalType":
    case "voidType":
    case "neverType":
      return false;
  }
};

const parameterPassingCapabilities = {
  out: "out-parameters",
  ref: "ref-parameters",
  in: "in-parameters",
} as const;

const expressionDisplayName = (expr: IrExpression): string | undefined => {
  switch (expr.kind) {
    case "identifier":
      return expr.name;
    case "memberAccess": {
      const owner = expressionDisplayName(expr.object);
      const property =
        typeof expr.property === "string"
          ? expr.property
          : expressionDisplayName(expr.property);
      return property ? (owner ? `${owner}.${property}` : property) : owner;
    }
    default:
      return undefined;
  }
};

const validateExpressionParameterCapabilities = (
  parameter: IrParameter,
  ctx: ValidationContext
): void => {
  const paramName =
    parameter.pattern.kind === "identifierPattern"
      ? parameter.pattern.name
      : "param";
  if (parameter.passing !== "value") {
    const capabilityName = parameterPassingCapabilities[parameter.passing];
    if (shouldReportUnsupportedCapability(ctx, capabilityName)) {
      ctx.diagnostics.push(
        createUnsupportedCapabilityDiagnostic(
          ctx,
          capabilityName,
          "TSN5001",
          `Parameter '${paramName}' uses ${parameter.passing} passing, which is not supported by the active backend.`,
          `Use a backend that declares ${parameter.passing} parameter support, or rewrite the API to return an explicit value.`
        )
      );
    }
  }
  if (
    parameter.attributes !== undefined &&
    parameter.attributes.length > 0 &&
    shouldReportUnsupportedCapability(ctx, "parameter-decorators")
  ) {
    ctx.diagnostics.push(
      createUnsupportedCapabilityDiagnostic(
        ctx,
        "parameter-decorators",
        "TSN5001",
        `Parameter '${paramName}' has metadata attributes, which are not supported by the active backend.`,
        "Use a backend that declares parameter metadata-attribute support, or remove the parameter attributes."
      )
    );
  }
};

const validateFunctionExpressionCapabilities = (
  label: string,
  expr: Extract<
    IrExpression,
    { kind: "functionExpression" } | { kind: "arrowFunction" }
  >,
  ctx: ValidationContext
): void => {
  const isGenerator =
    expr.kind === "functionExpression" ? expr.isGenerator : false;
  if (
    isGenerator &&
    expr.isAsync &&
    shouldReportUnsupportedCapability(ctx, "async-iteration")
  ) {
    ctx.diagnostics.push(
      createUnsupportedCapabilityDiagnostic(
        ctx,
        "async-iteration",
        "TSN5001",
        `${label} uses async iteration, which is not supported by the active backend.`,
        "Use a backend that declares async-iteration support, or rewrite this function as a supported async or generator shape."
      )
    );
  } else if (
    isGenerator &&
    shouldReportUnsupportedCapability(ctx, "generators")
  ) {
    ctx.diagnostics.push(
      createUnsupportedCapabilityDiagnostic(
        ctx,
        "generators",
        "TSN5001",
        `${label} uses generator syntax, which is not supported by the active backend.`,
        "Use a backend that declares generator support, or rewrite this function to return an explicit collection."
      )
    );
  }
};

export const validateExpression = (
  expr: IrExpression,
  ctx: ValidationContext
): void => {
  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
      break;

    case "array":
      expr.elements.forEach((element) => {
        if (element) validateExpression(element, ctx);
      });
      break;

    case "object":
      if (expr.contextualType) {
        validateType(
          expr.contextualType,
          ctx,
          "object literal contextual type",
          { diagnosticLocation: expr.sourceSpan }
        );
      }
      expr.properties.forEach((property) => {
        if (property.kind === "property") {
          if (typeof property.key !== "string") {
            validateExpression(property.key, ctx);
          }
          validateExpression(property.value, ctx);
        } else {
          validateExpression(property.expression, ctx);
        }
      });
      break;

    case "functionExpression":
      validateFunctionExpressionCapabilities("Function expression", expr, ctx);
      expr.parameters.forEach((parameter) =>
        validateExpressionParameterCapabilities(parameter, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validatePattern(parameter.pattern, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "function expression parameter", {
          diagnosticLocation: expr.sourceSpan,
        })
      );
      validateType(expr.returnType, ctx, "function expression return type", {
        diagnosticLocation: expr.sourceSpan,
      });
      validateStatement(expr.body, ctx);
      break;

    case "arrowFunction":
      validateFunctionExpressionCapabilities("Arrow function", expr, ctx);
      expr.parameters.forEach((parameter) =>
        validateExpressionParameterCapabilities(parameter, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validatePattern(parameter.pattern, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "arrow function parameter", {
          diagnosticLocation: expr.sourceSpan,
        })
      );
      validateType(expr.returnType, ctx, "arrow function return type", {
        diagnosticLocation: expr.sourceSpan,
      });
      if (expr.body.kind === "blockStatement") {
        validateStatement(expr.body, ctx);
      } else {
        validateExpression(expr.body, ctx);
      }
      break;

    case "memberAccess": {
      validateExpression(expr.object, ctx);
      if (expr.isComputed && typeContainsPoison(expr.object.inferredType)) {
        validateType(
          expr.object.inferredType,
          ctx,
          "computed access receiver inferred type",
          { diagnosticLocation: expr.object.sourceSpan ?? expr.sourceSpan }
        );
      }
      if (typeof expr.property !== "string") {
        validateExpression(expr.property, ctx);
      }
      const isDeclaredDictionaryAccess = expr.accessKind === "dictionary";
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true &&
        !isDeclaredDictionaryAccess
      ) {
        const propName =
          typeof expr.property === "string" ? expr.property : "<computed>";
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5203",
            "error",
            `Member/property type for '${propName}' cannot be recovered deterministically. Add an explicit type annotation at the declaration site.`,
            expr.sourceSpan ?? moduleLocation(ctx),
            "Ensure the property has a declared type annotation in its interface/class definition."
          )
        );
      }
      break;
    }

    case "call":
      if (expr.callee.kind === "identifier" && expr.callee.name === "istype") {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7441",
            "error",
            "istype<T>(...) is a compile-time-only marker and must be erased during overload specialization.",
            expr.sourceSpan ?? moduleLocation(ctx),
            "Use istype<T>(pN) only inside overload implementations that are being specialized, or remove it."
          )
        );
      }
      if (expr.callee.kind === "identifier") {
        const name = expr.callee.name;
        if (
          name === "asinterface" ||
          name === "trycast" ||
          name === "stackalloc" ||
          name === "defaultof" ||
          name === "out" ||
          name === "ref" ||
          name === "inref"
        ) {
          ctx.diagnostics.push(
            createDiagnostic(
              "TSN7442",
              "error",
              `'${name}(...)' is a compiler intrinsic and cannot be emitted as a normal call.`,
              expr.sourceSpan ?? moduleLocation(ctx),
              `Ensure '${name}' is imported from "${canonicalCoreModuleSpecifier(
                "lang"
              )}" and called with the correct signature.\nIf this call is correct and this error persists, please report it with a minimal repro.`
            )
          );
        }
      }
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((argument) => validateExpression(argument, ctx));
      expr.typeArguments?.forEach((typeArgument, index) =>
        validateType(typeArgument, ctx, `call type argument ${index}`, {
          diagnosticLocation: expr.sourceSpan,
        })
      );
      if (expr.narrowing) {
        validateType(expr.narrowing.targetType, ctx, "type predicate target", {
          diagnosticLocation: expr.sourceSpan,
        });
      }
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true
      ) {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5201",
            "error",
            "Return type of this call cannot be recovered deterministically. Add an explicit return type annotation at the function/method declaration.",
            expr.sourceSpan ?? moduleLocation(ctx),
            "Ensure the called function/method has a declared return type annotation."
          )
        );
      }
      break;

    case "new":
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((argument) => validateExpression(argument, ctx));
      expr.typeArguments?.forEach((typeArgument, index) =>
        validateType(typeArgument, ctx, `new type argument ${index}`, {
          diagnosticLocation: expr.sourceSpan,
        })
      );
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true
      ) {
        const calleeName = expressionDisplayName(expr.callee);
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5202",
            "error",
            calleeName
              ? `Constructor '${calleeName}' cannot be resolved deterministically.`
              : "Constructor call cannot be resolved deterministically.",
            expr.sourceSpan ?? moduleLocation(ctx),
            "Import or declare a supported constructor from the active source surface, or provide an explicit supported type."
          )
        );
      }
      break;

    case "update":
    case "unary":
    case "await":
      validateExpression(expr.expression, ctx);
      break;

    case "yield":
      if (expr.expression) {
        validateExpression(expr.expression, ctx);
      }
      break;

    case "binary":
    case "logical":
      validateExpression(expr.left, ctx);
      validateExpression(expr.right, ctx);
      break;

    case "conditional":
      validateExpression(expr.condition, ctx);
      validateExpression(expr.whenTrue, ctx);
      validateExpression(expr.whenFalse, ctx);
      break;

    case "assignment":
      if (
        expr.left.kind === "identifierPattern" ||
        expr.left.kind === "arrayPattern" ||
        expr.left.kind === "objectPattern"
      ) {
        validatePattern(expr.left, ctx);
      } else {
        validateExpression(expr.left, ctx);
      }
      validateExpression(expr.right, ctx);
      break;

    case "templateLiteral":
      expr.expressions.forEach((child) => validateExpression(child, ctx));
      break;

    case "spread":
      validateExpression(expr.expression, ctx);
      break;

    case "numericNarrowing":
    case "typeAssertion":
    case "asinterface":
    case "trycast":
    case "stackalloc":
    case "defaultof":
    case "sizeof":
      if ("expression" in expr && expr.expression) {
        validateExpression(expr.expression, ctx);
      }
      if ("targetType" in expr && expr.targetType) {
        validateType(expr.targetType, ctx, `${expr.kind} target type`, {
          diagnosticLocation: expr.sourceSpan,
        });
      }
      if ("elementType" in expr && expr.elementType) {
        validateType(expr.elementType, ctx, `${expr.kind} element type`, {
          diagnosticLocation: expr.sourceSpan,
        });
      }
      if ("size" in expr && expr.size) {
        validateExpression(expr.size, ctx);
      }
      if (expr.inferredType) {
        validateType(expr.inferredType, ctx, `${expr.kind} inferred type`, {
          unknownRootKind: "expressionInferredType",
          diagnosticLocation: expr.sourceSpan,
        });
      }
      break;

    case "nameof":
      break;
  }
};
