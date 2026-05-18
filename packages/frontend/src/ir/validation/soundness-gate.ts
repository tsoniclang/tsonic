/**
 * IR Soundness Gate - Validates IR before emission
 *
 * Walks the produced IR and asserts:
 * - No `anyType` anywhere (TSN7401 for explicit any, TSN7414 for unrepresentable)
 * - No unresolved/unsupported placeholders
 *
 * If this pass emits any errors, the emitter must not run.
 */

import { IrModule } from "../types.js";
import type {
  CapabilityValidationOptions,
  IrExpression,
  IrPattern,
  SoundnessGateOptions,
  SoundnessValidationResult,
  UniversalHygieneOptions,
  ValidationContext,
} from "./soundness-gate-shared.js";
import {
  extractImportedTypeNames,
  extractLocalTypeNames,
  validateStatement,
} from "./soundness-gate-statement-validation.js";
import { validateExpression } from "./soundness-gate-expression-validation.js";
import { validateType } from "./soundness-gate-type-validation.js";

/**
 * Validate a single module
 */
const validateModule = (
  module: IrModule,
  knownReferenceTypes: ReadonlySet<string>,
  namespaceLocalTypeNames: ReadonlySet<string>,
  options: SoundnessGateOptions,
  enableCapabilityChecks: boolean,
  validationMode: ValidationContext["validationMode"]
): ValidationContext["diagnostics"] => {
  // Extract local and imported type names for reference type validation
  const localTypeNames = extractLocalTypeNames(module.body);
  const importedTypeNames = extractImportedTypeNames(module);

  const ctx: ValidationContext = {
    filePath: module.filePath,
    namespace: module.namespace,
    diagnostics: [],
    localTypeNames,
    namespaceLocalTypeNames,
    importedTypeNames,
    knownReferenceTypes,
    backendCapabilities: options.backendCapabilities,
    enableCapabilityChecks,
    validationMode,
    typeParameterNames: new Set(), // Will be populated per-scope during validation
    activeTypeValidation: new WeakSet<object>(),
  };

  // Validate all statements in the module body
  module.body.forEach((stmt) => validateStatement(stmt, ctx));

  // Validate exports
  module.exports.forEach((exp) => {
    if (exp.kind === "default") {
      validateExpression(exp.expression, ctx);
    } else if (exp.kind === "declaration") {
      validateStatement(exp.declaration, ctx);
    }
  });

  return ctx.diagnostics;
};

const createContext = (
  module: IrModule,
  knownReferenceTypes: ReadonlySet<string>,
  namespaceLocalTypeNames: ReadonlySet<string>,
  importedTypeNames: ReadonlySet<string>,
  options: SoundnessGateOptions,
  enableCapabilityChecks: boolean,
  validationMode: ValidationContext["validationMode"]
): ValidationContext => ({
  filePath: module.filePath,
  namespace: module.namespace,
  diagnostics: [],
  localTypeNames: extractLocalTypeNames(module.body),
  namespaceLocalTypeNames,
  importedTypeNames,
  knownReferenceTypes,
  backendCapabilities: options.backendCapabilities,
  enableCapabilityChecks,
  validationMode,
  typeParameterNames: new Set(),
  activeTypeValidation: new WeakSet<object>(),
});

const addExpressionCapabilityDiagnostics = (
  expression: IrExpression,
  ctx: ValidationContext
): void => {
  if ("contextualType" in expression) {
    validateType(expression.contextualType, ctx, "expression contextual type", {
      intersectionRootKind: "semanticMetadata",
    });
  }
  if ("inferredType" in expression) {
    validateType(expression.inferredType, ctx, "expression inferred type", {
      intersectionRootKind: "semanticMetadata",
      unknownRootKind: "expressionInferredType",
    });
  }

  switch (expression.kind) {
    case "literal":
    case "identifier":
    case "this":
      break;
    case "array":
      expression.elements.forEach((element) => {
        if (element) addExpressionCapabilityDiagnostics(element, ctx);
      });
      break;
    case "object":
      expression.properties.forEach((property) => {
        if (property.kind === "property") {
          if (typeof property.key !== "string") {
            addExpressionCapabilityDiagnostics(property.key, ctx);
          }
          addExpressionCapabilityDiagnostics(property.value, ctx);
        } else {
          addExpressionCapabilityDiagnostics(property.expression, ctx);
        }
      });
      break;
    case "functionExpression":
    case "arrowFunction":
      expression.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "function parameter")
      );
      validateType(expression.returnType, ctx, "function return type");
      if (expression.body.kind === "blockStatement") {
        addStatementCapabilityDiagnostics(expression.body, ctx);
      } else {
        addExpressionCapabilityDiagnostics(expression.body, ctx);
      }
      break;
    case "memberAccess":
      addExpressionCapabilityDiagnostics(expression.object, ctx);
      if (typeof expression.property !== "string") {
        addExpressionCapabilityDiagnostics(expression.property, ctx);
      }
      break;
    case "call":
    case "new":
      addExpressionCapabilityDiagnostics(expression.callee, ctx);
      expression.arguments.forEach((argument) =>
        addExpressionCapabilityDiagnostics(argument, ctx)
      );
      expression.typeArguments?.forEach((typeArgument, index) =>
        validateType(typeArgument, ctx, `call type argument ${index}`)
      );
      if (expression.kind === "call") {
        validateType(expression.narrowing?.targetType, ctx, "type predicate target");
      }
      break;
    case "update":
    case "unary":
    case "await":
      addExpressionCapabilityDiagnostics(expression.expression, ctx);
      break;
    case "yield":
      if (expression.expression) {
        addExpressionCapabilityDiagnostics(expression.expression, ctx);
      }
      break;
    case "binary":
    case "logical":
      addExpressionCapabilityDiagnostics(expression.left, ctx);
      addExpressionCapabilityDiagnostics(expression.right, ctx);
      break;
    case "conditional":
      addExpressionCapabilityDiagnostics(expression.condition, ctx);
      addExpressionCapabilityDiagnostics(expression.whenTrue, ctx);
      addExpressionCapabilityDiagnostics(expression.whenFalse, ctx);
      break;
    case "assignment":
      if (expression.left.kind === "identifierPattern") {
        addPatternCapabilityDiagnostics(expression.left, ctx);
      } else if (
        expression.left.kind === "arrayPattern" ||
        expression.left.kind === "objectPattern"
      ) {
        addPatternCapabilityDiagnostics(expression.left, ctx);
      } else {
        addExpressionCapabilityDiagnostics(expression.left, ctx);
      }
      addExpressionCapabilityDiagnostics(expression.right, ctx);
      break;
    case "templateLiteral":
      expression.expressions.forEach((part) =>
        addExpressionCapabilityDiagnostics(part, ctx)
      );
      break;
    case "spread":
      addExpressionCapabilityDiagnostics(expression.expression, ctx);
      break;
    case "numericNarrowing":
      addExpressionCapabilityDiagnostics(expression.expression, ctx);
      break;
    case "typeAssertion":
    case "asinterface":
    case "trycast":
      addExpressionCapabilityDiagnostics(expression.expression, ctx);
      validateType(expression.targetType, ctx, "assertion target type");
      break;
    case "stackalloc":
      validateType(expression.elementType, ctx, "stackalloc element type");
      addExpressionCapabilityDiagnostics(expression.size, ctx);
      break;
    case "defaultof":
      validateType(expression.targetType, ctx, `${expression.kind} type`);
      break;
    case "sizeof":
      validateType(expression.targetType, ctx, `${expression.kind} type`);
      break;
    case "nameof":
      break;
  }
};

const addPatternCapabilityDiagnostics = (
  pattern: IrPattern,
  ctx: ValidationContext
): void => {
  switch (pattern.kind) {
    case "identifierPattern":
      validateType(pattern.type, ctx, `pattern '${pattern.name}'`);
      break;
    case "arrayPattern":
      pattern.elements.forEach((element) => {
        if (element) {
          addPatternCapabilityDiagnostics(element.pattern, ctx);
          if (element.defaultExpr) {
            addExpressionCapabilityDiagnostics(element.defaultExpr, ctx);
          }
        }
      });
      break;
    case "objectPattern":
      pattern.properties.forEach((property) => {
        if (property.kind === "property") {
          addPatternCapabilityDiagnostics(property.value, ctx);
          if (property.defaultExpr) {
            addExpressionCapabilityDiagnostics(property.defaultExpr, ctx);
          }
        } else {
          addPatternCapabilityDiagnostics(property.pattern, ctx);
        }
      });
      break;
  }
};

const addStatementCapabilityDiagnostics = (
  statement: Parameters<typeof validateStatement>[0],
  ctx: ValidationContext
): void => {
  switch (statement.kind) {
    case "variableDeclaration":
      statement.declarations.forEach((declaration) => {
        validateType(declaration.type, ctx, "variable declaration type");
        if (declaration.initializer) {
          addExpressionCapabilityDiagnostics(declaration.initializer, ctx);
        }
      });
      break;
    case "functionDeclaration":
      statement.typeParameters?.forEach((typeParameter) => {
        validateType(typeParameter.constraint, ctx, "type parameter constraint", {
          intersectionRootKind: "typeParameterConstraint",
        });
        validateType(typeParameter.default, ctx, "type parameter default");
      });
      statement.parameters.forEach((parameter) =>
        validateType(parameter.type, ctx, "function parameter")
      );
      validateType(statement.returnType, ctx, `function '${statement.name}' return type`);
      addStatementCapabilityDiagnostics(statement.body, ctx);
      break;
    case "classDeclaration":
      validateType(statement.superClass, ctx, `class '${statement.name}' extends`);
      statement.implements.forEach((heritage, index) =>
        validateType(heritage, ctx, `class '${statement.name}' implements ${index}`)
      );
      statement.members.forEach((member) => {
        if (member.kind === "methodDeclaration") {
          member.parameters.forEach((parameter) =>
            validateType(parameter.type, ctx, "method parameter")
          );
          validateType(member.returnType, ctx, `method '${member.name}' return type`);
          if (member.body) addStatementCapabilityDiagnostics(member.body, ctx);
        } else if (member.kind === "propertyDeclaration") {
          validateType(member.type, ctx, `property '${member.name}'`);
          if (member.initializer) {
            addExpressionCapabilityDiagnostics(member.initializer, ctx);
          }
        } else if (member.body) {
          addStatementCapabilityDiagnostics(member.body, ctx);
        }
      });
      break;
    case "interfaceDeclaration":
      statement.members.forEach((member) => {
        if (member.kind === "propertySignature") {
          validateType(member.type, ctx, `property '${member.name}'`);
        } else {
          member.parameters.forEach((parameter) =>
            validateType(parameter.type, ctx, "method parameter")
          );
          validateType(member.returnType, ctx, `method '${member.name}' return type`);
        }
      });
      break;
    case "typeAliasDeclaration":
      if (statement.type.kind === "objectType") {
        statement.type.members.forEach((member) => {
          if (member.kind === "propertySignature") {
            validateType(member.type, ctx, `property '${member.name}'`);
          } else {
            member.parameters.forEach((parameter) =>
              validateType(parameter.type, ctx, "method parameter")
            );
            validateType(member.returnType, ctx, `method '${member.name}' return type`);
          }
        });
      }
      break;
    case "expressionStatement":
      addExpressionCapabilityDiagnostics(statement.expression, ctx);
      break;
    case "returnStatement":
      if (statement.expression) addExpressionCapabilityDiagnostics(statement.expression, ctx);
      break;
    case "ifStatement":
      addExpressionCapabilityDiagnostics(statement.condition, ctx);
      addStatementCapabilityDiagnostics(statement.thenStatement, ctx);
      if (statement.elseStatement) addStatementCapabilityDiagnostics(statement.elseStatement, ctx);
      break;
    case "whileStatement":
      addExpressionCapabilityDiagnostics(statement.condition, ctx);
      addStatementCapabilityDiagnostics(statement.body, ctx);
      break;
    case "forStatement":
      if (statement.initializer) {
        if (statement.initializer.kind === "variableDeclaration") {
          addStatementCapabilityDiagnostics(statement.initializer, ctx);
        } else {
          addExpressionCapabilityDiagnostics(statement.initializer, ctx);
        }
      }
      if (statement.condition) addExpressionCapabilityDiagnostics(statement.condition, ctx);
      if (statement.update) addExpressionCapabilityDiagnostics(statement.update, ctx);
      addStatementCapabilityDiagnostics(statement.body, ctx);
      break;
    case "forOfStatement":
      addExpressionCapabilityDiagnostics(statement.expression, ctx);
      addStatementCapabilityDiagnostics(statement.body, ctx);
      break;
    case "switchStatement":
      addExpressionCapabilityDiagnostics(statement.expression, ctx);
      statement.cases.forEach((switchCase) =>
        switchCase.statements.forEach((nested) =>
          addStatementCapabilityDiagnostics(nested, ctx)
        )
      );
      break;
    case "throwStatement":
      addExpressionCapabilityDiagnostics(statement.expression, ctx);
      break;
    case "tryStatement":
      addStatementCapabilityDiagnostics(statement.tryBlock, ctx);
      if (statement.catchClause) addStatementCapabilityDiagnostics(statement.catchClause.body, ctx);
      if (statement.finallyBlock) addStatementCapabilityDiagnostics(statement.finallyBlock, ctx);
      break;
    case "blockStatement":
      statement.statements.forEach((nested) =>
        addStatementCapabilityDiagnostics(nested, ctx)
      );
      break;
    case "enumDeclaration":
      statement.members.forEach((member) => {
        if (member.initializer) addExpressionCapabilityDiagnostics(member.initializer, ctx);
      });
      break;
    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
      break;
  }
};

const namespaceTypeNamesFor = (
  modules: readonly IrModule[]
): ReadonlyMap<string, ReadonlySet<string>> => {
  const namespaceTypeNames = new Map<string, Set<string>>();
  for (const module of modules) {
    const current =
      namespaceTypeNames.get(module.namespace) ?? new Set<string>();
    for (const name of extractLocalTypeNames(module.body)) {
      current.add(name);
    }
    namespaceTypeNames.set(module.namespace, current);
  }
  return namespaceTypeNames;
};

export const validateUniversalHygiene = (
  modules: readonly IrModule[],
  options: UniversalHygieneOptions = {}
): SoundnessValidationResult => {
  const allDiagnostics: ValidationContext["diagnostics"] = [];
  const knownReferenceTypes = options.knownReferenceTypes ?? new Set<string>();
  const namespaceTypeNames = namespaceTypeNamesFor(modules);

  for (const module of modules) {
    const moduleDiagnostics = validateModule(
      module,
      knownReferenceTypes,
      namespaceTypeNames.get(module.namespace) ?? new Set<string>(),
      options,
      false,
      "universal"
    );
    allDiagnostics.push(...moduleDiagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    diagnostics: allDiagnostics,
  };
};

export const validateCapabilityAcceptability = (
  modules: readonly IrModule[],
  options: CapabilityValidationOptions
): SoundnessValidationResult => {
  const allDiagnostics: ValidationContext["diagnostics"] = [];
  const knownReferenceTypes = options.knownReferenceTypes ?? new Set<string>();
  const namespaceTypeNames = namespaceTypeNamesFor(modules);

  for (const module of modules) {
    const ctx = createContext(
      module,
      knownReferenceTypes,
      namespaceTypeNames.get(module.namespace) ?? new Set<string>(),
      extractImportedTypeNames(module),
      options,
      true,
      "capability"
    );
    module.body.forEach((statement) =>
      addStatementCapabilityDiagnostics(statement, ctx)
    );
    module.exports.forEach((exp) => {
      if (exp.kind === "default") {
        addExpressionCapabilityDiagnostics(exp.expression, ctx);
      } else if (exp.kind === "declaration") {
        addStatementCapabilityDiagnostics(exp.declaration, ctx);
      }
    });
    allDiagnostics.push(...ctx.diagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    diagnostics: allDiagnostics,
  };
};

/**
 * Run soundness validation on all modules.
 *
 * This composed API is the IR soundness gate: if any diagnostics are returned,
 * the emitter must not run.
 */
export const validateIrSoundness = (
  modules: readonly IrModule[],
  options: SoundnessGateOptions = {}
): SoundnessValidationResult => {
  const universal = validateUniversalHygiene(modules, options);
  const capabilityResult = validateCapabilityAcceptability(modules, options);
  const diagnostics = [
    ...universal.diagnostics,
    ...capabilityResult.diagnostics,
  ];
  return {
    ok: diagnostics.length === 0,
    diagnostics,
  };
};

export type {
  CapabilityValidationOptions,
  SoundnessGateOptions,
  SoundnessValidationResult,
  UniversalHygieneOptions,
};
