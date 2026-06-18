/**
 * Shared helper for validator test modules.
 *
 * Provides `createTestProgram` which constructs a TsonicProgram from an inline
 * source string, suitable for feeding into `validateProgram`.
 */

import type { TsonicProgram } from "../program.js";
import { createInlineTstsTestProgram } from "../testing/tsts-test-program.js";

export const createTestProgram = (
  source: string,
  fileName = "test.ts",
  options: Partial<TsonicProgram["options"]> = {}
): TsonicProgram =>
  createInlineTstsTestProgram(source, {
    fileName,
    projectRoot: options.projectRoot ?? "/test",
    sourceRoot: options.sourceRoot ?? "/test",
    rootNamespace: options.rootNamespace ?? "TestApp",
    ...options,
  });
