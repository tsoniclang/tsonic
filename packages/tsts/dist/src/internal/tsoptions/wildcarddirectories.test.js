import { test } from "node:test";
import assert from "node:assert/strict";
import { getWildcardDirectories } from "./wildcarddirectories.js";
test("getWildcardDirectories mirrors TS-Go non-ASCII include/exclude handling", () => {
    const cases = [
        {
            name: "Norwegian character æ in path",
            include: ["src/**/*.test.ts", "src/**/*.stories.ts", "src/**/*.mdx"],
            exclude: ["node_modules"],
            currentDirectory: "C:/Users/TobiasLægreid/dev/app/frontend/packages/react",
            useCaseSensitiveFileNames: false,
        },
        {
            name: "Japanese characters in path",
            include: ["src/**/*.ts"],
            exclude: ["テスト"],
            currentDirectory: "/Users/ユーザー/プロジェクト",
            useCaseSensitiveFileNames: true,
        },
        {
            name: "Chinese characters in path",
            include: ["源代码/**/*.js"],
            exclude: ["节点模块"],
            currentDirectory: "/home/用户/项目",
            useCaseSensitiveFileNames: true,
        },
        {
            name: "Various Unicode characters",
            include: ["src/**/*.ts"],
            exclude: ["node_modules"],
            currentDirectory: "/Users/Müller/café/naïve/résumé",
            useCaseSensitiveFileNames: false,
        },
    ];
    for (const testCase of cases) {
        const comparePathsOptions = {
            CurrentDirectory: testCase.currentDirectory,
            UseCaseSensitiveFileNames: testCase.useCaseSensitiveFileNames,
        };
        const result = getWildcardDirectories(testCase.include, testCase.exclude, comparePathsOptions);
        assert.ok(result instanceof Map, `${testCase.name} should produce a wildcard directory map`);
        assert.notEqual(result.size, 0, `${testCase.name} should retain at least one wildcard directory`);
    }
});
//# sourceMappingURL=wildcarddirectories.test.js.map