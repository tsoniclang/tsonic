import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "@tsonic/core/types.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import { getWildcardDirectories } from "./wildcarddirectories.js";

test("getWildcardDirectories mirrors TS-Go non-ASCII include/exclude handling", () => {
  const cases: Array<{
    readonly name: string;
    readonly include: string[];
    readonly exclude: string[];
    readonly currentDirectory: string;
    readonly useCaseSensitiveFileNames: bool;
  }> = [
    {
      name: "Norwegian character æ in path",
      include: ["src/**/*.test.ts", "src/**/*.stories.ts", "src/**/*.mdx"],
      exclude: ["node_modules"],
      currentDirectory: "C:/Users/TobiasLægreid/dev/app/frontend/packages/react",
      useCaseSensitiveFileNames: false as bool,
    },
    {
      name: "Japanese characters in path",
      include: ["src/**/*.ts"],
      exclude: ["テスト"],
      currentDirectory: "/Users/ユーザー/プロジェクト",
      useCaseSensitiveFileNames: true as bool,
    },
    {
      name: "Chinese characters in path",
      include: ["源代码/**/*.js"],
      exclude: ["节点模块"],
      currentDirectory: "/home/用户/项目",
      useCaseSensitiveFileNames: true as bool,
    },
    {
      name: "Various Unicode characters",
      include: ["src/**/*.ts"],
      exclude: ["node_modules"],
      currentDirectory: "/Users/Müller/café/naïve/résumé",
      useCaseSensitiveFileNames: false as bool,
    },
  ];

  for (const testCase of cases) {
    const comparePathsOptions: ComparePathsOptions = {
      CurrentDirectory: testCase.currentDirectory,
      UseCaseSensitiveFileNames: testCase.useCaseSensitiveFileNames,
    };

    const result = getWildcardDirectories(testCase.include, testCase.exclude, comparePathsOptions);
    assert.ok(result instanceof Map, `${testCase.name} should produce a wildcard directory map`);
    assert.notEqual(result.size, 0, `${testCase.name} should retain at least one wildcard directory`);
  }
});
