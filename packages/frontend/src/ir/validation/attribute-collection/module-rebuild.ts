/**
 * Attribute Collection — Module Rebuild & Entry Point
 *
 * Rebuilds module body after attribute collection: filters out marker
 * statements, attaches collected attributes to declarations, and
 * provides the entry point for the pass.
 */

import { Diagnostic } from "../../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrInterfaceDeclaration,
} from "../../types.js";
import {
  type CollectedAttributes,
  collectModuleAttributes,
} from "./marker-collection.js";

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
  const collected = collectModuleAttributes(module, diagnostics);
  if (!collected) {
    return module;
  }

  return rebuildModuleBody(module, collected);
};

/**
 * Rebuild module body with collected attributes attached to declarations.
 */
const rebuildModuleBody = (
  module: IrModule,
  collected: CollectedAttributes
): IrModule => {
  const {
    removedStatementIndices,
    classAttributes,
    interfaceAttributes,
    classCtorAttributes,
    classMethodAttributes,
    classPropAttributes,
    interfaceMethodAttributes,
    interfacePropAttributes,
    functionAttributes,
  } = collected;

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

    if (stmt.kind === "interfaceDeclaration") {
      const ifaceStmt = stmt as IrInterfaceDeclaration;
      const existingAttrs = ifaceStmt.attributes ?? [];
      const typeAttrs = interfaceAttributes.get(i) ?? [];
      const methodAttrs = interfaceMethodAttributes.get(i);
      const propAttrs = interfacePropAttributes.get(i);

      const updatedMembers =
        methodAttrs || propAttrs
          ? ifaceStmt.members.map((m) => {
              if (m.kind === "methodSignature" && methodAttrs) {
                const extras = methodAttrs.get(m.name);
                if (extras && extras.length > 0) {
                  return {
                    ...m,
                    attributes: [...(m.attributes ?? []), ...extras],
                  };
                }
              }
              if (m.kind === "propertySignature" && propAttrs) {
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
          : ifaceStmt.members;

      if (typeAttrs.length === 0 && !methodAttrs && !propAttrs) {
        newBody.push(ifaceStmt);
      } else {
        newBody.push({
          ...ifaceStmt,
          members: updatedMembers,
          attributes:
            typeAttrs.length > 0
              ? [...existingAttrs, ...typeAttrs]
              : ifaceStmt.attributes,
        });
      }
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
 * 1. Detects attribute marker calls
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
