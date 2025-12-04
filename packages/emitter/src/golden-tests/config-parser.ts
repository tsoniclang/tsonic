/**
 * Config.yaml parser for golden tests
 */

import YAML from "yaml";
import { DiagnosticsMode, TestEntry } from "./types.js";

/**
 * Normalize and deduplicate diagnostic codes.
 * - Trims whitespace
 * - Filters empty strings
 * - Removes duplicates
 * - Sorts for deterministic ordering
 */
const normalizeDiagnosticCodes = (
  codes: readonly string[]
): readonly string[] => {
  const normalized = codes.map((c) => c.trim()).filter((c) => c.length > 0);
  return [...new Set(normalized)].sort();
};

/**
 * Parse and validate expectDiagnostics field.
 * - Must be an array of strings
 * - Each code must match TSN#### format
 * - Returns undefined if empty or not present
 */
const parseExpectDiagnostics = (
  value: unknown
): readonly string[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("expectDiagnostics must be an array of strings");
  }

  for (const v of value) {
    if (typeof v !== "string") {
      throw new Error(
        `expectDiagnostics must contain strings. Got: ${JSON.stringify(v)}`
      );
    }
  }

  const codes = normalizeDiagnosticCodes(value);

  // Enforce TSN#### format
  for (const c of codes) {
    if (!/^TSN\d{4}$/.test(c)) {
      throw new Error(
        `Invalid diagnostic code "${c}". Expected format TSN####.`
      );
    }
  }

  return codes.length > 0 ? codes : undefined;
};

/**
 * Validate and parse diagnostics mode.
 */
const parseDiagnosticsMode = (value: unknown): DiagnosticsMode | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value === "contains" || value === "exact") {
    return value;
  }
  throw new Error(
    `Invalid expectDiagnosticsMode: "${value}". Must be "contains" or "exact".`
  );
};

/**
 * Parse config.yaml and extract test entries
 */
export const parseConfigYaml = (yamlContent: string): readonly TestEntry[] => {
  const parsed = YAML.parse(yamlContent);

  if (!Array.isArray(parsed)) {
    throw new Error("config.yaml must be an array of test entries");
  }

  const entries: TestEntry[] = [];

  for (const item of parsed) {
    if (typeof item === "object" && item !== null) {
      // Check if it's the simple YAML format: { "File.ts": "title" }
      const keys = Object.keys(item);

      if (keys.length === 1 && keys[0] && keys[0].endsWith(".ts")) {
        // Simple format parsed as object
        const input = keys[0];
        const title = item[input];

        if (typeof title !== "string") {
          throw new Error(`Title must be a string for ${input}`);
        }

        entries.push({ input, title });
      } else if ("input" in item && "title" in item) {
        // Explicit format: { input: "File.ts", title: "...", expectDiagnostics?: [...], expectDiagnosticsMode?: "..." }
        const input = (item as Record<string, unknown>).input;
        const title = (item as Record<string, unknown>).title;

        if (typeof input !== "string" || typeof title !== "string") {
          throw new Error(
            "Each test entry must have 'input' and 'title' as strings"
          );
        }

        if (!input.endsWith(".ts")) {
          throw new Error(`input must end with .ts: ${input}`);
        }

        const expectDiagnostics = parseExpectDiagnostics(
          (item as Record<string, unknown>).expectDiagnostics
        );

        const expectDiagnosticsMode = parseDiagnosticsMode(
          (item as Record<string, unknown>).expectDiagnosticsMode
        );

        // Validate that mode is only set when diagnostics are expected
        if (expectDiagnosticsMode && !expectDiagnostics) {
          throw new Error(
            `expectDiagnosticsMode is set for ${input} but expectDiagnostics is missing.`
          );
        }

        entries.push({
          input,
          title,
          expectDiagnostics,
          expectDiagnosticsMode,
        });
      } else {
        throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
      }
    } else if (typeof item === "string") {
      // Quoted string format: "File.ts: title here"
      // Split on first colon to allow paths with spaces
      const colonIdx = item.indexOf(":");
      if (colonIdx === -1) {
        throw new Error(
          `Invalid test entry format: "${item}". Expected "File.ts: title".`
        );
      }

      const input = item.slice(0, colonIdx).trim();
      const title = item.slice(colonIdx + 1).trim();

      if (!input.endsWith(".ts")) {
        throw new Error(`input must end with .ts: ${input}`);
      }

      if (title.length === 0) {
        throw new Error(`Title cannot be empty for ${input}`);
      }

      entries.push({ input, title });
    } else {
      throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
    }
  }

  return entries;
};
