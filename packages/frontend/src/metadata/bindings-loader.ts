/**
 * Bindings JSON loader - Reads and validates .bindings.json files from tsbindgen.
 *
 * This module provides pure functions to load runtime binding files and validate
 * their structure against the expected schema.
 *
 * @see spec/bindings.md for complete schema documentation
 */

import * as fs from "fs";
import * as path from "path";
import type { Result } from "../types/result.ts";
import type { Diagnostic } from "../types/diagnostic.ts";
import type { BindingsFile, TypeBinding } from "../types/bindings.ts";

/**
 * Load and parse a bindings.json file.
 *
 * @param filePath - Absolute path to the .bindings.json file
 * @returns Result containing parsed bindings or diagnostics
 */
export const loadBindingsFile = (
  filePath: string
): Result<BindingsFile, Diagnostic[]> => {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9101",
          message: `Bindings file not found: ${filePath}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Read file contents
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9102",
          message: `Failed to read bindings file: ${error}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9103",
          message: `Invalid JSON in bindings file: ${error}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Validate structure
  const validation = validateBindingsFile(parsed, filePath);
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, value: validation.value };
};

/**
 * Validate that parsed JSON matches BindingsFile schema.
 *
 * @param data - Parsed JSON data
 * @param filePath - File path for error messages
 * @returns Result containing validated bindings or diagnostics
 */
const validateBindingsFile = (
  data: unknown,
  filePath: string
): Result<BindingsFile, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9104",
          message: `Bindings file must be an object, got ${typeof data}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  const obj = data as Record<string, unknown>;

  // Validate namespace
  if (typeof obj.namespace !== "string") {
    diagnostics.push({
      code: "TSN9105",
      message: `Missing or invalid 'namespace' field in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate types array
  if (!Array.isArray(obj.types)) {
    diagnostics.push({
      code: "TSN9106",
      message: `Missing or invalid 'types' field in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  } else {
    // Validate each type binding
    for (let i = 0; i < obj.types.length; i++) {
      const typeValidation = validateTypeBinding(
        obj.types[i],
        filePath,
        i
      );
      if (!typeValidation.ok) {
        diagnostics.push(...typeValidation.error);
      }
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: obj as BindingsFile };
};

/**
 * Validate a single TypeBinding object.
 *
 * @param data - Type binding to validate
 * @param filePath - File path for error messages
 * @param index - Type index in array
 * @returns Result indicating validation success or errors
 */
const validateTypeBinding = (
  data: unknown,
  filePath: string,
  index: number
): Result<TypeBinding, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];
  const context = `type binding ${index} in ${path.basename(filePath)}`;

  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9107",
          message: `Invalid ${context}: must be an object`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  const type = data as Record<string, unknown>;

  // Validate required string fields
  const requiredStringFields = ["clrName", "tsEmitName", "assemblyName"];
  for (const field of requiredStringFields) {
    if (typeof type[field] !== "string") {
      diagnostics.push({
        code: "TSN9108",
        message: `Invalid ${context}: missing or invalid '${field}'`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Validate metadataToken
  if (typeof type.metadataToken !== "number") {
    diagnostics.push({
      code: "TSN9109",
      message: `Invalid ${context}: 'metadataToken' must be a number`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate optional array fields (V1 Definitions)
  const v1ArrayFields = ["methods", "properties", "fields", "events"];
  for (const field of v1ArrayFields) {
    if (type[field] !== undefined && !Array.isArray(type[field])) {
      diagnostics.push({
        code: "TSN9110",
        message: `Invalid ${context}: '${field}' must be an array if present`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Validate optional array fields (V2 Exposures)
  const v2ArrayFields = [
    "exposedMethods",
    "exposedProperties",
    "exposedFields",
    "exposedEvents",
  ];
  for (const field of v2ArrayFields) {
    if (type[field] !== undefined && !Array.isArray(type[field])) {
      diagnostics.push({
        code: "TSN9111",
        message: `Invalid ${context}: '${field}' must be an array if present`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Note: We're doing basic structural validation here
  // More detailed validation of nested objects (method bindings, etc.)
  // can be added in future iterations if needed

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: type as TypeBinding };
};

/**
 * Load bindings from a directory containing .bindings.json files.
 *
 * @param directoryPath - Path to directory containing bindings files
 * @returns Result containing array of loaded bindings files or diagnostics
 */
export const loadBindingsDirectory = (
  directoryPath: string
): Result<BindingsFile[], Diagnostic[]> => {
  if (!fs.existsSync(directoryPath)) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9112",
          message: `Bindings directory not found: ${directoryPath}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  const stats = fs.statSync(directoryPath);
  if (!stats.isDirectory()) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9113",
          message: `Not a directory: ${directoryPath}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Find all .bindings.json files
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".bindings.json"))
    .map((file) => path.join(directoryPath, file));

  if (files.length === 0) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9114",
          message: `No .bindings.json files found in ${directoryPath}`,
          severity: "warning",
          location: undefined,
        },
      ],
    };
  }

  // Load each file
  const bindingsFiles: BindingsFile[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    const result = loadBindingsFile(file);
    if (result.ok) {
      bindingsFiles.push(result.value);
    } else {
      diagnostics.push(...result.error);
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: bindingsFiles };
};

/**
 * Build a registry of type bindings for fast lookup by TypeScript emit name.
 *
 * @param bindingsFiles - Array of loaded bindings files
 * @returns Map from tsEmitName to TypeBinding
 */
export const buildBindingsRegistry = (
  bindingsFiles: readonly BindingsFile[]
): ReadonlyMap<string, TypeBinding> => {
  const registry = new Map<string, TypeBinding>();

  for (const file of bindingsFiles) {
    for (const typeBinding of file.types) {
      const key = `${file.namespace}.${typeBinding.tsEmitName}`;
      registry.set(key, typeBinding);
    }
  }

  return registry;
};

/**
 * Look up a type binding by fully-qualified TypeScript emit name.
 *
 * @param registry - Bindings registry
 * @param qualifiedTsName - Fully qualified TS name (e.g., "System.Collections.Generic.List_1")
 * @returns TypeBinding if found, undefined otherwise
 */
export const lookupTypeBinding = (
  registry: ReadonlyMap<string, TypeBinding>,
  qualifiedTsName: string
): TypeBinding | undefined => {
  return registry.get(qualifiedTsName);
};
