/**
 * Config.yaml parser for golden tests
 */

import YAML from "yaml";
import { TestEntry } from "./types.js";

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
      } else if (item.input && item.title) {
        // Explicit format: { input: "File.ts", title: "...", expectDiagnostics?: [...] }
        const input = item.input;
        const title = item.title;

        if (typeof input !== "string" || typeof title !== "string") {
          throw new Error(
            "Each test entry must have 'input' and 'title' fields"
          );
        }

        const expectDiagnostics = Array.isArray(item.expectDiagnostics)
          ? item.expectDiagnostics.map(String)
          : undefined;

        entries.push({ input, title, expectDiagnostics });
      } else {
        throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
      }
    } else if (typeof item === "string") {
      // Quoted string format: "File.ts: title here"
      const match = item.match(/^(\S+\.ts):\s*(.+)$/);
      if (!match || !match[1] || !match[2]) {
        throw new Error(`Invalid test entry format: ${item}`);
      }

      entries.push({
        input: match[1],
        title: match[2].trim(),
      });
    } else {
      throw new Error(`Invalid test entry: ${JSON.stringify(item)}`);
    }
  }

  return entries;
};
