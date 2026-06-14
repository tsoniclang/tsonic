import { test } from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import { TryParseVersion } from "./version.js";
import { TryParseVersionRange, VersionRange_String, VersionRange_Test } from "./version_range.js";
const upstreamTestPath = nodePath.join(process.cwd(), "packages/tsts/_vendor/typescript-go/internal/semver/version_range_test.go");
function upstreamSource() {
    return nodeFs.readFileSync(upstreamTestPath, "utf8");
}
function parseVersion(text) {
    const [version, error] = TryParseVersion(text);
    assert.equal(error, undefined, text);
    return version;
}
function parseRange(text) {
    const [range, ok] = TryParseVersionRange(text);
    assert.equal(ok, true, text);
    return range;
}
function decodeGoString(quoted) {
    return JSON.parse(quoted);
}
function splitGoExpressions(text) {
    const parts = [];
    let current = "";
    let inString = false;
    let escaped = false;
    for (const char of text) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\") {
            current += char;
            escaped = inString;
            continue;
        }
        if (char === "\"") {
            current += char;
            inString = !inString;
            continue;
        }
        if (char === "," && !inString) {
            const trimmed = current.trim();
            if (trimmed !== "") {
                parts.push(trimmed);
            }
            current = "";
            continue;
        }
        current += char;
    }
    const trimmed = current.trim();
    if (trimmed !== "") {
        parts.push(trimmed);
    }
    return parts;
}
function splitGoConcatTerms(text) {
    const parts = [];
    let current = "";
    let inString = false;
    let escaped = false;
    for (const char of text) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\") {
            current += char;
            escaped = inString;
            continue;
        }
        if (char === "\"") {
            current += char;
            inString = !inString;
            continue;
        }
        if (char === "+" && !inString) {
            const trimmed = current.trim();
            if (trimmed !== "") {
                parts.push(trimmed);
            }
            current = "";
            continue;
        }
        current += char;
    }
    const trimmed = current.trim();
    if (trimmed !== "") {
        parts.push(trimmed);
    }
    return parts;
}
function buildGoVariables(source) {
    const variables = new Map();
    for (const match of source.matchAll(/(\w+)\s*:=\s*strings\.Repeat\(("(?:[^"\\]|\\.)*"),\s*(\d+)\)/g)) {
        variables.set(match[1], decodeGoString(match[2]).repeat(Number.parseInt(match[3], 10)));
    }
    return variables;
}
function normalizeGoStringExpression(expression) {
    return expression
        .split(/\n/g)
        .join("")
        .split(/\r/g)
        .join("")
        .trim();
}
function evaluateGoStringExpression(expression, variables) {
    return splitGoConcatTerms(normalizeGoStringExpression(expression))
        .map((part) => part.trim())
        .filter((part) => part !== "")
        .map((part) => {
        if (part.startsWith("\"")) {
            return decodeGoString(part);
        }
        const value = variables.get(part);
        assert.notEqual(value, undefined, `unknown Go string test variable ${part}`);
        return value;
    })
        .join("");
}
function extractGoStringList(source, name) {
    const match = new RegExp(`${name} := \\[\\]string\\{([\\s\\S]*?)\\}`, "m").exec(source);
    assert.notEqual(match, null, `missing upstream string list ${name}`);
    return splitGoExpressions(match[1]).map((expression) => evaluateGoStringExpression(expression, new Map()));
}
function extractGoodBadCases(source) {
    const variables = buildGoVariables(source);
    const cases = [];
    const casePattern = /assertRangesGoodBad\(t,\s*((?:"(?:[^"\\]|\\.)*"|lotsaOnes|\s|\+)+),\s*testGoodBad\{\s*good:\s*\[\]string\{([\s\S]*?)\},\s*bad:\s*\[\]string\{([\s\S]*?)\},\s*\}\)/g;
    for (const match of source.matchAll(casePattern)) {
        cases.push({
            range: evaluateGoStringExpression(match[1], variables),
            good: splitGoExpressions(match[2]).map((expression) => evaluateGoStringExpression(expression, variables)),
            bad: splitGoExpressions(match[3]).map((expression) => evaluateGoStringExpression(expression, variables)),
        });
    }
    assert.equal(cases.length, 11);
    return cases;
}
function extractTupleCases(source) {
    const cases = [];
    for (const match of source.matchAll(/\{\s*("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*"),\s*(true|false)\s*\}/g)) {
        cases.push({
            range: decodeGoString(match[1]),
            version: decodeGoString(match[2]),
            inRange: match[3] === "true",
        });
    }
    assert.equal(cases.length, 683);
    return cases;
}
test("VersionRange.String normalizes wildcard spellings like upstream", () => {
    const source = upstreamSource();
    const groups = [
        extractGoStringList(source, "majorWildcardStrings"),
        extractGoStringList(source, "minorWildcardStrings"),
        extractGoStringList(source, "patchWildcardStrings"),
        extractGoStringList(source, "mixedCaseWildcardStrings"),
    ];
    for (const strings of groups) {
        for (const left of strings) {
            for (const right of strings) {
                assert.equal(VersionRange_String(parseRange(left)), VersionRange_String(parseRange(right)), `${left} == ${right}`);
            }
        }
    }
});
test("VersionRange.Test mirrors upstream good/bad range suites", () => {
    for (const testCase of extractGoodBadCases(upstreamSource())) {
        const range = parseRange(testCase.range);
        for (const version of testCase.good) {
            assert.equal(VersionRange_Test(range, parseVersion(version)), true, `${testCase.range} includes ${version}`);
        }
        for (const version of testCase.bad) {
            assert.equal(VersionRange_Test(range, parseVersion(version)), false, `${testCase.range} excludes ${version}`);
        }
    }
});
test("VersionRange.Test mirrors upstream comparator, conjunction, disjunction, hyphen, tilde, and caret cases", () => {
    for (const testCase of extractTupleCases(upstreamSource())) {
        assert.equal(VersionRange_Test(parseRange(testCase.range), parseVersion(testCase.version)), testCase.inRange, `${testCase.range} on ${testCase.version}`);
    }
});
//# sourceMappingURL=version_range.test.js.map