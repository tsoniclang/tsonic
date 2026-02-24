/**
 * Attribute Collection — Module Processing & Entry Point
 *
 * Orchestrates the attribute collection pass: walks module statements,
 * detects attribute markers, attaches IR attributes to declarations,
 * and removes marker statements.
 */

import { Diagnostic, createDiagnostic } from "../../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrCallExpression,
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrAttribute,
  IrVariableDeclaration,
} from "../../types.js";
import {
  type ParsedAttributeDescriptor,
  type AttributeMarker,
  createLocation,
  getAttributesApiLocalNames,
  getAttributeTargetsApiLocalNames,
  parseAttrDescriptorCall,
} from "./arg-extractor.js";
import {
  tryDetectAttributeMarker,
  looksLikeAttributesApiUsage,
} from "./marker-parser.js";

// ═══════════════════════════════════════════════════════════════════════════
// RESULT TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of attribute collection pass
 */
export type AttributeCollectionResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

// ═══════════════════════════════════════════════════════════════════════════
// MODULE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process a single module: detect attribute markers and attach to declarations
 */
const processModule = (
  module: IrModule,
  diagnostics: Diagnostic[]
): IrModule => {
  const apiNames = getAttributesApiLocalNames(module);
  const attributeTargetsApiNames = getAttributeTargetsApiLocalNames(module);
  if (apiNames.size === 0) {
    return module;
  }

  // Collect detected attribute descriptors declared as variables:
  //   const d = A.attr(AttrCtor, ...args)
  const descriptors = new Map<string, ParsedAttributeDescriptor>();
  const removedStatementIndices: Set<number> = new Set();

  module.body.forEach((stmt, i) => {
    if (stmt.kind !== "variableDeclaration") return;
    const decl = stmt as IrVariableDeclaration;

    // Only handle simple, single declarator `const name = A.attr(...)`.
    if (decl.declarationKind !== "const") return;
    if (decl.declarations.length !== 1) return;

    const d0 = decl.declarations[0];
    if (!d0) return;
    if (d0.name.kind !== "identifierPattern") return;
    if (!d0.initializer) return;

    const parsed = parseAttrDescriptorCall(d0.initializer, module, apiNames);
    if (parsed.kind === "notMatch") return;
    if (parsed.kind === "error") {
      diagnostics.push(parsed.diagnostic);
      removedStatementIndices.add(i);
      return;
    }

    descriptors.set(d0.name.name, parsed.value);
    removedStatementIndices.add(i);
  });

  // Collect detected attribute markers
  const markers: AttributeMarker[] = [];

  // Walk statements looking for attribute markers
  module.body.forEach((stmt, i) => {
    if (removedStatementIndices.has(i)) return;
    if (stmt.kind !== "expressionStatement") return;

    const expr = stmt.expression;
    if (expr.kind !== "call") return;

    const marker = tryDetectAttributeMarker(
      expr as IrCallExpression,
      module,
      apiNames,
      attributeTargetsApiNames,
      descriptors
    );
    if (marker.kind === "ok") {
      markers.push(marker.value);
      removedStatementIndices.add(i);
      return;
    }
    if (marker.kind === "error") {
      diagnostics.push(marker.diagnostic);
      removedStatementIndices.add(i);
      return;
    }

    // If it looks like an attribute API call but doesn't match a supported marker,
    // fail deterministically instead of leaving runtime-dead code in the output.
    if (looksLikeAttributesApiUsage(expr, apiNames)) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Invalid attribute marker call. Expected one of: A.on(X).type.add(...), A.on(X).ctor.add(...), A.on(X).method(x => x.m).add(...), A.on(X).prop(x => x.p).add(...), with optional .target(...) before .add(...)`,
          createLocation(module.filePath, expr.sourceSpan)
        )
      );
      removedStatementIndices.add(i);
    }
  });

  // If nothing to do, return module unchanged
  if (markers.length === 0 && removedStatementIndices.size === 0) {
    return module;
  }

  // Build map of declaration names to their indices
  const classDeclarations = new Map<string, number>();
  const functionDeclarations = new Map<string, number>();

  module.body.forEach((stmt, i) => {
    if (stmt.kind === "classDeclaration") {
      classDeclarations.set(stmt.name, i);
    } else if (stmt.kind === "functionDeclaration") {
      functionDeclarations.set(stmt.name, i);
    }
  });

  // Build map of attributes per declaration
  const classAttributes = new Map<number, IrAttribute[]>();
  const classCtorAttributes = new Map<number, IrAttribute[]>();
  const classMethodAttributes = new Map<number, Map<string, IrAttribute[]>>();
  const classPropAttributes = new Map<number, Map<string, IrAttribute[]>>();
  const functionAttributes = new Map<number, IrAttribute[]>();

  for (const marker of markers) {
    const classIndex = classDeclarations.get(marker.targetName);
    const funcIndex = functionDeclarations.get(marker.targetName);

    const attr: IrAttribute = {
      kind: "attribute",
      target: marker.attributeTarget,
      attributeType: marker.attributeType,
      positionalArgs: marker.positionalArgs,
      namedArgs: marker.namedArgs,
    };

    if (marker.targetSelector === "type") {
      if (classIndex !== undefined && funcIndex !== undefined) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Attribute target '${marker.targetName}' is ambiguous (matches both class and function)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      if (classIndex !== undefined) {
        if (
          marker.attributeTarget !== undefined &&
          marker.attributeTarget !== "type"
        ) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute target '${marker.attributeTarget}' for type attribute. Expected 'type' or omit .target(...)`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }
        const attrs = classAttributes.get(classIndex) ?? [];
        attrs.push(attr);
        classAttributes.set(classIndex, attrs);
        continue;
      }

      if (funcIndex !== undefined) {
        if (marker.attributeTarget !== undefined) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `.target(...) is not supported for function attributes via A.on(fn).type. Use A.on(Class).method(...) instead.`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }
        const attrs = functionAttributes.get(funcIndex) ?? [];
        attrs.push(attr);
        functionAttributes.set(funcIndex, attrs);
        continue;
      }

      diagnostics.push(
        createDiagnostic(
          "TSN4007",
          "error",
          `Attribute target '${marker.targetName}' not found in module`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    if (classIndex === undefined) {
      diagnostics.push(
        createDiagnostic(
          "TSN4007",
          "error",
          `Attribute target '${marker.targetName}' not found in module`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const classStmt = module.body[classIndex] as IrClassDeclaration;

    if (marker.targetSelector === "ctor") {
      if (
        marker.attributeTarget !== undefined &&
        marker.attributeTarget !== "method"
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute target '${marker.attributeTarget}' for constructor attribute. Expected 'method' or omit .target(...)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const hasCtor = classStmt.members.some(
        (m) => m.kind === "constructorDeclaration"
      );
      if (classStmt.isStruct && !hasCtor) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Cannot apply constructor attributes to struct '${classStmt.name}' without an explicit constructor`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const attrs = classCtorAttributes.get(classIndex) ?? [];
      attrs.push(attr);
      classCtorAttributes.set(classIndex, attrs);
      continue;
    }

    if (marker.targetSelector === "method") {
      if (
        marker.attributeTarget !== undefined &&
        marker.attributeTarget !== "method" &&
        marker.attributeTarget !== "return"
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute target '${marker.attributeTarget}' for method attribute. Expected 'method', 'return', or omit .target(...)`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const memberName = marker.selectedMemberName;
      if (!memberName) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute marker: method target missing member name`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const hasMember = classStmt.members.some(
        (m) => m.kind === "methodDeclaration" && m.name === memberName
      );
      if (!hasMember) {
        diagnostics.push(
          createDiagnostic(
            "TSN4007",
            "error",
            `Method '${classStmt.name}.${memberName}' not found for attribute target`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const perClass = classMethodAttributes.get(classIndex) ?? new Map();
      const attrs = perClass.get(memberName) ?? [];
      attrs.push(attr);
      perClass.set(memberName, attrs);
      classMethodAttributes.set(classIndex, perClass);
      continue;
    }

    if (marker.targetSelector === "prop") {
      const memberName = marker.selectedMemberName;
      if (!memberName) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid attribute marker: property target missing member name`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }
      const member = classStmt.members.find(
        (m) => m.kind === "propertyDeclaration" && m.name === memberName
      );
      if (!member || member.kind !== "propertyDeclaration") {
        diagnostics.push(
          createDiagnostic(
            "TSN4007",
            "error",
            `Property '${classStmt.name}.${memberName}' not found for attribute target`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      if (marker.attributeTarget !== undefined) {
        if (member.emitAsField) {
          if (marker.attributeTarget !== "field") {
            diagnostics.push(
              createDiagnostic(
                "TSN4005",
                "error",
                `Invalid attribute target '${marker.attributeTarget}' for field-emitted property '${classStmt.name}.${memberName}'. Expected 'field' or omit .target(...)`,
                createLocation(module.filePath, marker.sourceSpan)
              )
            );
            continue;
          }
        } else if (
          marker.attributeTarget !== "property" &&
          marker.attributeTarget !== "field"
        ) {
          diagnostics.push(
            createDiagnostic(
              "TSN4005",
              "error",
              `Invalid attribute target '${marker.attributeTarget}' for property attribute. Expected 'property', 'field', or omit .target(...)`,
              createLocation(module.filePath, marker.sourceSpan)
            )
          );
          continue;
        }

        if (marker.attributeTarget === "field") {
          const isAccessorProperty =
            member.getterBody !== undefined || member.setterBody !== undefined;
          if (isAccessorProperty) {
            diagnostics.push(
              createDiagnostic(
                "TSN4005",
                "error",
                `Cannot apply [field: ...] attribute target to accessor property '${classStmt.name}.${memberName}'. Apply the attribute to the actual field instead.`,
                createLocation(module.filePath, marker.sourceSpan)
              )
            );
            continue;
          }
        }
      }

      const perClass = classPropAttributes.get(classIndex) ?? new Map();
      const attrs = perClass.get(memberName) ?? [];
      attrs.push(attr);
      perClass.set(memberName, attrs);
      classPropAttributes.set(classIndex, perClass);
    }
  }

  // Rebuild module body:
  // 1. Filter out marker statements
  // 2. Update declarations with attached attributes
  const newBody: IrStatement[] = [];

  module.body.forEach((stmt, i) => {
    // Skip marker statements
    if (removedStatementIndices.has(i)) return;

    if (stmt.kind === "classDeclaration") {
      // Update class with attributes
      const classStmt = stmt as IrClassDeclaration;
      const existingAttrs = classStmt.attributes ?? [];
      const typeAttrs = classAttributes.get(i) ?? [];
      const ctorAttrs = classCtorAttributes.get(i) ?? [];
      const methodAttrs = classMethodAttributes.get(i);
      const propAttrs = classPropAttributes.get(i);

      const updatedMembers =
        methodAttrs || propAttrs
          ? classStmt.members.map((m) => {
              if (m.kind === "methodDeclaration" && methodAttrs) {
                const extras = methodAttrs.get(m.name);
                if (extras && extras.length > 0) {
                  return {
                    ...m,
                    attributes: [...(m.attributes ?? []), ...extras],
                  };
                }
              }
              if (m.kind === "propertyDeclaration" && propAttrs) {
                const extras = propAttrs.get(m.name);
                if (extras && extras.length > 0) {
                  return {
                    ...m,
                    attributes: [...(m.attributes ?? []), ...extras],
                  };
                }
              }
              return m;
            })
          : classStmt.members;

      const updated: IrClassDeclaration = {
        ...classStmt,
        members: updatedMembers,
        attributes:
          typeAttrs.length > 0
            ? [...existingAttrs, ...typeAttrs]
            : classStmt.attributes,
        ctorAttributes:
          ctorAttrs.length > 0
            ? [...(classStmt.ctorAttributes ?? []), ...ctorAttrs]
            : classStmt.ctorAttributes,
      };

      // Avoid allocating new nodes when there are no changes.
      if (
        typeAttrs.length === 0 &&
        ctorAttrs.length === 0 &&
        !methodAttrs &&
        !propAttrs
      ) {
        newBody.push(classStmt);
      } else {
        newBody.push(updated);
      }
      return;
    }

    if (stmt.kind === "functionDeclaration" && functionAttributes.has(i)) {
      // Update function with attributes
      const funcStmt = stmt as IrFunctionDeclaration;
      const existingAttrs = funcStmt.attributes ?? [];
      const newAttrs = functionAttributes.get(i) ?? [];
      newBody.push({
        ...funcStmt,
        attributes: [...existingAttrs, ...newAttrs],
      });
      return;
    }

    // Keep statement unchanged
    newBody.push(stmt);
  });

  return {
    ...module,
    body: newBody,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run the attribute collection pass on a set of modules.
 *
 * This pass:
 * 1. Detects attribute marker calls (A.on(X).type.add(Y))
 * 2. Attaches IrAttribute nodes to the corresponding declarations
 * 3. Removes the marker statements from the module body
 * 4. Emits diagnostics for invalid patterns
 */
export const runAttributeCollectionPass = (
  modules: readonly IrModule[]
): AttributeCollectionResult => {
  const diagnostics: Diagnostic[] = [];
  const processedModules: IrModule[] = [];

  for (const module of modules) {
    const processed = processModule(module, diagnostics);
    processedModules.push(processed);
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");

  return {
    ok: !hasErrors,
    modules: processedModules,
    diagnostics,
  };
};
