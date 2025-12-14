/**
 * IR Soundness Gate - Validates IR before emission
 *
 * Walks the produced IR and asserts:
 * - No `anyType` anywhere (TSN7401 for explicit any, TSN7414 for unrepresentable)
 * - No unresolved/unsupported placeholders
 *
 * If this pass emits any errors, the emitter must not run.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrExpression,
  IrType,
  IrParameter,
  IrTypeParameter,
  IrInterfaceMember,
  IrPattern,
} from "../types.js";

/**
 * Result of soundness validation
 */
export type SoundnessValidationResult = {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Known builtin types that are handled by emitter's built-in mappings
 * or are C# primitive type names that may appear in IR.
 * C# primitives correspond to types defined in @tsonic/core package.
 */
const KNOWN_BUILTINS = new Set([
  // JS/TS builtins handled by emitter
  "Array",
  "Promise",
  "Map",
  "Set",
  "Error",
  "Object",
  "Generator",
  "AsyncGenerator",
  "IteratorResult",
  // C# signed integers (from @tsonic/core)
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  // C# unsigned integers (from @tsonic/core)
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  // C# floating-point (from @tsonic/core)
  "half",
  "float",
  "double",
  "decimal",
  // C# other primitives (from @tsonic/core)
  "bool",
  "char",
  // Additional C# keywords that are valid type names
  "string",
  "object",
  "void",
  // .NET types commonly used
  "IntPtr",
  "UIntPtr",
]);

/**
 * Context for tracking location during IR walk
 */
type ValidationContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** Local type names defined in this module (class, interface, type alias, enum) */
  readonly localTypeNames: ReadonlySet<string>;
  /** Type names imported in this module */
  readonly importedTypeNames: ReadonlySet<string>;
  /** Type parameter names in current scope */
  readonly typeParameterNames: ReadonlySet<string>;
};

/**
 * Create a source location for a module
 */
const moduleLocation = (ctx: ValidationContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Check if a type contains anyType anywhere (recursively)
 */
const validateType = (
  type: IrType | undefined,
  ctx: ValidationContext,
  typeContext: string
): void => {
  if (!type) return;

  switch (type.kind) {
    case "anyType": {
      // TSN7414: Type cannot be represented in compiler subset
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN7414",
          "error",
          `Type cannot be represented in compiler subset: ${typeContext}. The type resolved to 'any' which is not supported.`,
          moduleLocation(ctx),
          "Ensure the type can be explicitly annotated or is a recognized type alias."
        )
      );
      break;
    }

    case "arrayType":
      validateType(type.elementType, ctx, `${typeContext}[]`);
      break;

    case "tupleType":
      type.elementTypes.forEach((et, i) =>
        validateType(et, ctx, `${typeContext}[${i}]`)
      );
      break;

    case "functionType":
      type.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(type.returnType, ctx, `${typeContext} return type`);
      break;

    case "objectType":
      type.members.forEach((m) => validateInterfaceMember(m, ctx));
      break;

    case "dictionaryType":
      validateType(type.keyType, ctx, `${typeContext} key type`);
      validateType(type.valueType, ctx, `${typeContext} value type`);
      break;

    case "unionType":
      type.types.forEach((t, i) =>
        validateType(t, ctx, `${typeContext} union member ${i}`)
      );
      break;

    case "intersectionType":
      type.types.forEach((t, i) =>
        validateType(t, ctx, `${typeContext} intersection member ${i}`)
      );
      break;

    case "referenceType": {
      const { name, resolvedClrType } = type;

      // TSN7420: ref/out/In are parameter modifiers, not types
      // These must be expressed via syntax in the future, not type annotations
      if (name === "ref" || name === "out" || name === "In") {
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7420",
            "error",
            `'${name}' is a parameter modifier, not a type. Parameter modifiers cannot be expressed as type annotations.`,
            moduleLocation(ctx),
            "Parameter modifiers (ref/out/in) will be supported via syntax in a future release. Remove the type wrapper."
          )
        );
        return;
      }

      // Check if this reference type is resolvable
      const isResolvable =
        // Has pre-resolved CLR type from IR
        resolvedClrType !== undefined ||
        // Is a known builtin handled by emitter
        KNOWN_BUILTINS.has(name) ||
        // Is a local type defined in this module
        ctx.localTypeNames.has(name) ||
        // Is an imported type
        ctx.importedTypeNames.has(name) ||
        // Is a type parameter in current scope
        ctx.typeParameterNames.has(name);

      if (!isResolvable) {
        // TSN7414: Unresolved reference type
        ctx.diagnostics.push(
          createDiagnostic(
            "TSN7414",
            "error",
            `Unresolved reference type '${name}' in ${typeContext}. The type is not local, not imported, and has no CLR binding.`,
            moduleLocation(ctx),
            "Ensure the type is imported or defined locally, or that CLR bindings are available."
          )
        );
      }

      // Validate type arguments recursively
      type.typeArguments?.forEach((ta, i) =>
        validateType(ta, ctx, `${typeContext}<arg ${i}>`)
      );
      break;
    }

    // These types are valid and don't contain nested types
    case "primitiveType":
    case "typeParameterType":
    case "literalType":
    case "unknownType":
    case "voidType":
    case "neverType":
      break;
  }
};

/**
 * Validate a parameter
 */
const validateParameter = (
  param: IrParameter,
  ctx: ValidationContext
): void => {
  const paramName =
    param.pattern.kind === "identifierPattern" ? param.pattern.name : "param";
  validateType(param.type, ctx, `parameter '${paramName}'`);
  validatePattern(param.pattern, ctx);
  if (param.initializer) {
    validateExpression(param.initializer, ctx);
  }
};

/**
 * Validate a type parameter
 */
const validateTypeParameter = (
  tp: IrTypeParameter,
  ctx: ValidationContext
): void => {
  validateType(tp.constraint, ctx, `type parameter '${tp.name}' constraint`);
  validateType(tp.default, ctx, `type parameter '${tp.name}' default`);
  tp.structuralMembers?.forEach((m) => validateInterfaceMember(m, ctx));
};

/**
 * Validate an interface member
 */
const validateInterfaceMember = (
  member: IrInterfaceMember,
  ctx: ValidationContext
): void => {
  switch (member.kind) {
    case "propertySignature":
      validateType(member.type, ctx, `property '${member.name}'`);
      break;
    case "methodSignature":
      member.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      member.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(
        member.returnType,
        ctx,
        `method '${member.name}' return type`
      );
      break;
  }
};

/**
 * Validate a pattern
 */
const validatePattern = (pattern: IrPattern, ctx: ValidationContext): void => {
  switch (pattern.kind) {
    case "identifierPattern":
      validateType(pattern.type, ctx, `pattern '${pattern.name}'`);
      break;
    case "arrayPattern":
      pattern.elements.forEach((e) => {
        if (e) validatePattern(e, ctx);
      });
      break;
    case "objectPattern":
      pattern.properties.forEach((p) => {
        if (p.kind === "property") {
          validatePattern(p.value, ctx);
        } else {
          validatePattern(p.pattern, ctx);
        }
      });
      break;
  }
};

/**
 * Validate an expression (and its nested types/expressions)
 *
 * NOTE: We intentionally do NOT validate the `inferredType` field on expressions.
 * `inferredType` is informational and optional - if the type checker couldn't
 * determine a specific type, it may be `anyType`, but this doesn't indicate
 * a user error or an unsupported type. The emitter works correctly regardless.
 *
 * We DO validate:
 * - Explicit type annotations (parameters, return types, variable types)
 * - Type arguments on calls and new expressions
 * - Contextual types on object literals (which affect C# type synthesis)
 */
const validateExpression = (
  expr: IrExpression,
  ctx: ValidationContext
): void => {
  switch (expr.kind) {
    case "literal":
    case "identifier":
    case "this":
      break;

    case "array":
      expr.elements.forEach((e) => {
        if (e) validateExpression(e, ctx);
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
      expr.properties.forEach((p) => {
        if (p.kind === "property") {
          if (typeof p.key !== "string") {
            validateExpression(p.key, ctx);
          }
          validateExpression(p.value, ctx);
        } else {
          validateExpression(p.expression, ctx);
        }
      });
      break;

    case "functionExpression":
      expr.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(expr.returnType, ctx, "function expression return type");
      validateStatement(expr.body, ctx);
      break;

    case "arrowFunction":
      expr.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(expr.returnType, ctx, "arrow function return type");
      if (expr.body.kind === "blockStatement") {
        validateStatement(expr.body, ctx);
      } else {
        validateExpression(expr.body, ctx);
      }
      break;

    case "memberAccess":
      validateExpression(expr.object, ctx);
      if (typeof expr.property !== "string") {
        validateExpression(expr.property, ctx);
      }
      break;

    case "call":
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((a) => validateExpression(a, ctx));
      expr.typeArguments?.forEach((ta, i) =>
        validateType(ta, ctx, `call type argument ${i}`)
      );
      if (expr.narrowing) {
        validateType(expr.narrowing.targetType, ctx, "type predicate target");
      }
      break;

    case "new":
      validateExpression(expr.callee, ctx);
      expr.arguments.forEach((a) => validateExpression(a, ctx));
      expr.typeArguments?.forEach((ta, i) =>
        validateType(ta, ctx, `new type argument ${i}`)
      );
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
      expr.expressions.forEach((e) => validateExpression(e, ctx));
      break;

    case "spread":
      validateExpression(expr.expression, ctx);
      break;
  }
};

/**
 * Validate a statement (and its nested types/expressions/statements)
 */
const validateStatement = (stmt: IrStatement, ctx: ValidationContext): void => {
  switch (stmt.kind) {
    case "variableDeclaration":
      stmt.declarations.forEach((d) => {
        validatePattern(d.name, ctx);
        validateType(d.type, ctx, "variable declaration type");
        if (d.initializer) {
          validateExpression(d.initializer, ctx);
        }
      });
      break;

    case "functionDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      stmt.parameters.forEach((p) => validateParameter(p, ctx));
      validateType(stmt.returnType, ctx, `function '${stmt.name}' return type`);
      validateStatement(stmt.body, ctx);
      break;

    case "classDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      if (stmt.superClass) {
        validateExpression(stmt.superClass, ctx);
      }
      stmt.implements.forEach((i, idx) =>
        validateType(i, ctx, `class '${stmt.name}' implements ${idx}`)
      );
      stmt.members.forEach((m) => {
        switch (m.kind) {
          case "methodDeclaration":
            m.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
            m.parameters.forEach((p) => validateParameter(p, ctx));
            validateType(m.returnType, ctx, `method '${m.name}' return type`);
            if (m.body) {
              validateStatement(m.body, ctx);
            }
            break;
          case "propertyDeclaration":
            validateType(m.type, ctx, `property '${m.name}'`);
            if (m.initializer) {
              validateExpression(m.initializer, ctx);
            }
            break;
          case "constructorDeclaration":
            m.parameters.forEach((p) => validateParameter(p, ctx));
            if (m.body) {
              validateStatement(m.body, ctx);
            }
            break;
        }
      });
      break;

    case "interfaceDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      stmt.extends.forEach((e, idx) =>
        validateType(e, ctx, `interface '${stmt.name}' extends ${idx}`)
      );
      stmt.members.forEach((m) => validateInterfaceMember(m, ctx));
      break;

    case "enumDeclaration":
      stmt.members.forEach((m) => {
        if (m.initializer) {
          validateExpression(m.initializer, ctx);
        }
      });
      break;

    case "typeAliasDeclaration":
      stmt.typeParameters?.forEach((tp) => validateTypeParameter(tp, ctx));
      validateType(stmt.type, ctx, `type alias '${stmt.name}'`);
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
      stmt.cases.forEach((c) => {
        if (c.test) {
          validateExpression(c.test, ctx);
        }
        c.statements.forEach((s) => validateStatement(s, ctx));
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
      stmt.statements.forEach((s) => validateStatement(s, ctx));
      break;

    case "breakStatement":
    case "continueStatement":
    case "emptyStatement":
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
  }
};

/**
 * Extract local type names from module statements
 */
const extractLocalTypeNames = (
  statements: readonly IrStatement[]
): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const stmt of statements) {
    switch (stmt.kind) {
      case "classDeclaration":
      case "interfaceDeclaration":
      case "typeAliasDeclaration":
      case "enumDeclaration":
        names.add(stmt.name);
        break;
    }
  }

  return names;
};

/**
 * Extract imported type names from module imports
 */
const extractImportedTypeNames = (module: IrModule): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const imp of module.imports) {
    for (const spec of imp.specifiers) {
      // Include all imports - the emitter will resolve whether they're types or values
      // Named imports use localName (the name in this module's scope)
      if (spec.kind === "named" || spec.kind === "default") {
        names.add(spec.localName);
      }
      // Namespace imports (import * as NS) - the namespace itself is available
      if (spec.kind === "namespace") {
        names.add(spec.localName);
      }
    }
  }

  return names;
};

/**
 * Validate a single module
 */
const validateModule = (module: IrModule): readonly Diagnostic[] => {
  // Extract local and imported type names for reference type validation
  const localTypeNames = extractLocalTypeNames(module.body);
  const importedTypeNames = extractImportedTypeNames(module);

  const ctx: ValidationContext = {
    filePath: module.filePath,
    diagnostics: [],
    localTypeNames,
    importedTypeNames,
    typeParameterNames: new Set(), // Will be populated per-scope during validation
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

/**
 * Run soundness validation on all modules
 *
 * This is the IR soundness gate - if any diagnostics are returned,
 * the emitter must not run.
 */
export const validateIrSoundness = (
  modules: readonly IrModule[]
): SoundnessValidationResult => {
  const allDiagnostics: Diagnostic[] = [];

  for (const module of modules) {
    const moduleDiagnostics = validateModule(module);
    allDiagnostics.push(...moduleDiagnostics);
  }

  return {
    ok: allDiagnostics.length === 0,
    diagnostics: allDiagnostics,
  };
};
