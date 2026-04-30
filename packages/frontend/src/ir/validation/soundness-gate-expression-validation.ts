import {
  createDiagnostic,
  moduleLocation,
  type IrExpression,
  type ValidationContext,
} from "./soundness-gate-shared.js";
import {
  validatePattern,
  validateType,
} from "./soundness-gate-type-validation.js";
import { validateStatement } from "./soundness-gate-statement-validation.js";
import type { IrType } from "../types.js";

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
          "object literal contextual type"
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
      expr.parameters.forEach((parameter) =>
        validatePattern(parameter.pattern, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "function expression parameter")
      );
      validateType(expr.returnType, ctx, "function expression return type");
      validateStatement(expr.body, ctx);
      break;

    case "arrowFunction":
      expr.parameters.forEach((parameter) =>
        validatePattern(parameter.pattern, ctx)
      );
      expr.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "arrow function parameter")
      );
      validateType(expr.returnType, ctx, "arrow function return type");
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
          "computed access receiver inferred type"
        );
      }
      if (typeof expr.property !== "string") {
        validateExpression(expr.property, ctx);
      }
      const allowComputedDictionaryUnknown =
        expr.isComputed && expr.accessKind === "dictionary";
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true &&
        !expr.allowUnknownInferredType &&
        !allowComputedDictionaryUnknown
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
              `Ensure '${name}' is imported from "@tsonic/core/lang.js" and called with the correct signature.\nIf this call is correct and this error persists, please report it with a minimal repro.`
            )
          );
        }
      }
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((argument) => validateExpression(argument, ctx));
      expr.typeArguments?.forEach((typeArgument, index) =>
        validateType(typeArgument, ctx, `call type argument ${index}`)
      );
      if (expr.narrowing) {
        validateType(expr.narrowing.targetType, ctx, "type predicate target");
      }
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true &&
        !expr.allowUnknownInferredType
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
        validateType(typeArgument, ctx, `new type argument ${index}`)
      );
      if (
        expr.inferredType?.kind === "unknownType" &&
        expr.inferredType.explicit !== true
      ) {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN5202",
            "error",
            "Type arguments for this constructor call cannot be inferred deterministically. Add explicit type arguments: new Foo<T>(...).",
            expr.sourceSpan ?? moduleLocation(ctx),
            "Provide explicit type arguments when instantiating generic types."
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
        validateType(expr.targetType, ctx, `${expr.kind} target type`);
      }
      if ("elementType" in expr && expr.elementType) {
        validateType(expr.elementType, ctx, `${expr.kind} element type`);
      }
      if ("size" in expr && expr.size) {
        validateExpression(expr.size, ctx);
      }
      if (expr.inferredType) {
        validateType(expr.inferredType, ctx, `${expr.kind} inferred type`, {
          allowRootUnknownType: true,
        });
      }
      break;

    case "nameof":
      break;
  }
};
