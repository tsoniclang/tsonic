/**
 * Metadata JSON loader - Reads and validates .metadata.json files from tsbindgen.
 *
 * This module provides pure functions to load CLR metadata files and validate
 * their structure against the expected schema.
 *
 * @see spec/metadata.md for complete schema documentation
 */

import * as fs from "fs";
import * as path from "path";
import type { Result } from "../types/result.ts";
import type { Diagnostic } from "../types/diagnostic.ts";
import type {
  MetadataFile,
  TypeMetadata,
  TypeKind,
  Accessibility,
} from "../types/metadata.ts";

/**
 * Load and parse a metadata.json file.
 *
 * @param filePath - Absolute path to the .metadata.json file
 * @returns Result containing parsed metadata or diagnostics
 */
export const loadMetadataFile = (
  filePath: string
): Result<MetadataFile, Diagnostic[]> => {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9001",
          message: `Metadata file not found: ${filePath}`,
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
          code: "TSN9002",
          message: `Failed to read metadata file: ${error}`,
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
          code: "TSN9003",
          message: `Invalid JSON in metadata file: ${error}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Validate structure
  const validation = validateMetadataFile(parsed, filePath);
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, value: validation.value };
};

/**
 * Validate that parsed JSON matches MetadataFile schema.
 *
 * @param data - Parsed JSON data
 * @param filePath - File path for error messages
 * @returns Result containing validated metadata or diagnostics
 */
const validateMetadataFile = (
  data: unknown,
  filePath: string
): Result<MetadataFile, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9004",
          message: `Metadata file must be an object, got ${typeof data}`,
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
      code: "TSN9005",
      message: `Missing or invalid 'namespace' field in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate contributingAssemblies
  if (!Array.isArray(obj.contributingAssemblies)) {
    diagnostics.push({
      code: "TSN9006",
      message: `Missing or invalid 'contributingAssemblies' field in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  } else if (
    !obj.contributingAssemblies.every((item) => typeof item === "string")
  ) {
    diagnostics.push({
      code: "TSN9007",
      message: `All 'contributingAssemblies' must be strings in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate types array
  if (!Array.isArray(obj.types)) {
    diagnostics.push({
      code: "TSN9008",
      message: `Missing or invalid 'types' field in ${path.basename(filePath)}`,
      severity: "error",
      location: undefined,
    });
  } else {
    // Validate each type
    for (let i = 0; i < obj.types.length; i++) {
      const typeValidation = validateTypeMetadata(obj.types[i], filePath, i);
      if (!typeValidation.ok) {
        diagnostics.push(...typeValidation.error);
      }
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: obj as MetadataFile };
};

/**
 * Validate a single TypeMetadata object.
 *
 * @param data - Type metadata to validate
 * @param filePath - File path for error messages
 * @param index - Type index in array
 * @returns Result indicating validation success or errors
 */
const validateTypeMetadata = (
  data: unknown,
  filePath: string,
  index: number
): Result<TypeMetadata, Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];
  const context = `type ${index} in ${path.basename(filePath)}`;

  if (typeof data !== "object" || data === null) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9009",
          message: `Invalid ${context}: must be an object`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  const type = data as Record<string, unknown>;

  // Validate required string fields
  const requiredStringFields = ["clrName", "tsEmitName"];
  for (const field of requiredStringFields) {
    if (typeof type[field] !== "string") {
      diagnostics.push({
        code: "TSN9010",
        message: `Invalid ${context}: missing or invalid '${field}'`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Validate kind
  const validKinds: TypeKind[] = [
    "Class",
    "Interface",
    "Struct",
    "Enum",
    "Delegate",
  ];
  if (!validKinds.includes(type.kind as TypeKind)) {
    diagnostics.push({
      code: "TSN9011",
      message: `Invalid ${context}: 'kind' must be one of ${validKinds.join(", ")}`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate accessibility
  const validAccessibility: Accessibility[] = [
    "Public",
    "Internal",
    "Protected",
    "ProtectedInternal",
    "PrivateProtected",
    "Private",
  ];
  if (!validAccessibility.includes(type.accessibility as Accessibility)) {
    diagnostics.push({
      code: "TSN9012",
      message: `Invalid ${context}: 'accessibility' must be one of ${validAccessibility.join(", ")}`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate required boolean fields
  const requiredBooleanFields = ["isAbstract", "isSealed", "isStatic"];
  for (const field of requiredBooleanFields) {
    if (typeof type[field] !== "boolean") {
      diagnostics.push({
        code: "TSN9013",
        message: `Invalid ${context}: '${field}' must be a boolean`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Validate arity
  if (typeof type.arity !== "number" || type.arity < 0) {
    diagnostics.push({
      code: "TSN9014",
      message: `Invalid ${context}: 'arity' must be a non-negative number`,
      severity: "error",
      location: undefined,
    });
  }

  // Validate required array fields
  const requiredArrayFields = [
    "methods",
    "properties",
    "fields",
    "events",
    "constructors",
  ];
  for (const field of requiredArrayFields) {
    if (!Array.isArray(type[field])) {
      diagnostics.push({
        code: "TSN9015",
        message: `Invalid ${context}: '${field}' must be an array`,
        severity: "error",
        location: undefined,
      });
    }
  }

  // Note: We're doing basic structural validation here
  // More detailed validation of nested objects (methods, properties, etc.)
  // can be added in future iterations if needed

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: type as TypeMetadata };
};

/**
 * Load metadata from a directory containing .metadata.json files.
 *
 * @param directoryPath - Path to directory containing metadata files
 * @returns Result containing array of loaded metadata files or diagnostics
 */
export const loadMetadataDirectory = (
  directoryPath: string
): Result<MetadataFile[], Diagnostic[]> => {
  if (!fs.existsSync(directoryPath)) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9016",
          message: `Metadata directory not found: ${directoryPath}`,
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
          code: "TSN9017",
          message: `Not a directory: ${directoryPath}`,
          severity: "error",
          location: undefined,
        },
      ],
    };
  }

  // Find all .metadata.json files
  const files = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".metadata.json"))
    .map((file) => path.join(directoryPath, file));

  if (files.length === 0) {
    return {
      ok: false,
      error: [
        {
          code: "TSN9018",
          message: `No .metadata.json files found in ${directoryPath}`,
          severity: "warning",
          location: undefined,
        },
      ],
    };
  }

  // Load each file
  const metadataFiles: MetadataFile[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    const result = loadMetadataFile(file);
    if (result.ok) {
      metadataFiles.push(result.value);
    } else {
      diagnostics.push(...result.error);
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, error: diagnostics };
  }

  return { ok: true, value: metadataFiles };
};
