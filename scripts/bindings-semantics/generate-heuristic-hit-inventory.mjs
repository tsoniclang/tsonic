#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [, , inputPath, outputJsonPath, outputMdPath] = process.argv;

if (!inputPath || !outputJsonPath || !outputMdPath) {
  console.error(
    "Usage: node scripts/bindings-semantics/generate-heuristic-hit-inventory.mjs <input.jsonl> <output.json> <output.md>"
  );
  process.exit(1);
}

const parityRows = [
  {
    id: "A1",
    family: "call-style:js-receiver",
    label: "js.* receiver helpers",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "A2",
    family: "call-style:linq-queryable-receiver",
    label: "System.Linq.Queryable.* query operators",
    ownerRepo: "@tsonic/dotnet",
    authoringPoint:
      "dotnet/__build/templates/10/tsbindgen.bindings-semantics.json",
  },
  {
    id: "A3",
    family: "call-style:efcore-receiver",
    label: "Microsoft.EntityFrameworkCore.* query operators",
    ownerRepo: "@tsonic/efcore",
    authoringPoint:
      "efcore/__build/templates/10/tsbindgen.bindings-semantics.json",
  },
  {
    id: "A5",
    family: "call-style:linq-enumerable-terminal-receiver",
    label: "System.Linq.Enumerable ToList/ToArray receiver terminals",
    ownerRepo: "@tsonic/dotnet",
    authoringPoint:
      "dotnet/__build/templates/10/tsbindgen.bindings-semantics.json",
  },
  {
    id: "B1",
    family: "type-identity:Array",
    label: "Array contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B2",
    family: "type-identity:Date",
    label: "Date contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B3",
    family: "type-identity:Error",
    label: "Error contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B4",
    family: "type-identity:JSON",
    label: "JSON remains value-only",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B5",
    family: "type-identity:Map",
    label: "Map contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B6",
    family: "type-identity:Math",
    label: "Math remains value-only",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B7",
    family: "type-identity:Number",
    label: "Number contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B8",
    family: "type-identity:Object",
    label: "Object contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B9",
    family: "type-identity:RangeError",
    label: "RangeError contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B10",
    family: "type-identity:ReadonlyArray",
    label: "ReadonlyArray contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B11",
    family: "type-identity:RegExp",
    label: "RegExp contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B12",
    family: "type-identity:Set",
    label: "Set contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B13",
    family: "type-identity:String",
    label: "String contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
  {
    id: "B14",
    family: "type-identity:Uint8Array",
    label: "Uint8Array contributes type identity",
    ownerRepo: "@tsonic/js",
    authoringPoint: "js/versions/10/tsonic.package.json",
  },
];

const rowByFamily = new Map(parityRows.map((row) => [row.family, row]));

const toProjectLabel = (hit) => {
  if (hit.sourceFile) {
    const normalized = hit.sourceFile.replace(/\\/g, "/");
    const fixtureMatch = normalized.match(/\/test\/fixtures\/([^/]+)\//);
    if (fixtureMatch?.[1]) return `fixture:${fixtureMatch[1]}`;
    const packageMatch = normalized.match(/\/packages\/([^/]+)\//);
    if (packageMatch?.[1]) return `workspace:${packageMatch[1]}`;
    const repoPackageMatch = normalized.match(/\/repos\/([^/]+)\/([^/]+)\//);
    if (repoPackageMatch?.[1] && repoPackageMatch?.[2]) {
      return `${repoPackageMatch[1]}/${repoPackageMatch[2]}`;
    }
  }
  return hit.suite;
};

const readHits = () => {
  if (!fs.existsSync(inputPath)) return [];
  const lines = fs
    .readFileSync(inputPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const hits = [];
  for (const line of lines) {
    hits.push(JSON.parse(line));
  }
  return hits;
};

const rawHits = readHits();

const deduped = new Map();
for (const hit of rawHits) {
  const key = JSON.stringify(hit);
  deduped.set(key, hit);
}

const hits = [...deduped.values()]
  .map((hit) => {
    const row = rowByFamily.get(hit.family);
    return {
      ...hit,
      project: toProjectLabel(hit),
      rowId: row?.id ?? "UNMAPPED",
      rowLabel: row?.label ?? "Unmapped heuristic family",
      ownerRepo: row?.ownerRepo ?? "UNRESOLVED",
      authoringPoint: row?.authoringPoint ?? "UNRESOLVED",
    };
  })
  .sort((left, right) =>
    [
      left.heuristicKind,
      left.rowId,
      left.family,
      left.suite,
      left.project,
      left.site,
      left.sourceFile ?? "",
      left.bindingType ?? "",
      left.memberName ?? "",
      left.alias ?? "",
    ]
      .join("\u0000")
      .localeCompare(
        [
          right.heuristicKind,
          right.rowId,
          right.family,
          right.suite,
          right.project,
          right.site,
          right.sourceFile ?? "",
          right.bindingType ?? "",
          right.memberName ?? "",
          right.alias ?? "",
        ].join("\u0000")
      )
  );

const familySummary = new Map();
for (const hit of hits) {
  const current = familySummary.get(hit.family) ?? {
    family: hit.family,
    rowId: hit.rowId,
    rowLabel: hit.rowLabel,
    ownerRepo: hit.ownerRepo,
    authoringPoint: hit.authoringPoint,
    heuristicKind: hit.heuristicKind,
    suites: new Set(),
    projects: new Set(),
    sampleBindings: new Set(),
    count: 0,
  };
  current.count += 1;
  current.suites.add(hit.suite);
  current.projects.add(hit.project);
  if (hit.bindingType && hit.memberName) {
    current.sampleBindings.add(`${hit.bindingType}.${hit.memberName}`);
  } else if (hit.alias) {
    current.sampleBindings.add(`${hit.alias} -> ${hit.clrType ?? "unknown"}`);
  }
  familySummary.set(hit.family, current);
}

const summaryRows = [...familySummary.values()]
  .map((row) => ({
    ...row,
    suites: [...row.suites].sort(),
    projects: [...row.projects].sort(),
    sampleBindings: [...row.sampleBindings].sort(),
  }))
  .sort((left, right) =>
    `${left.rowId}\u0000${left.family}`.localeCompare(
      `${right.rowId}\u0000${right.family}`
    )
  );

const unresolvedFamilies = summaryRows.filter((row) => row.rowId === "UNMAPPED");

const inventoryJson = {
  schemaVersion: 1,
  generatedFrom: path.resolve(inputPath),
  totalHits: hits.length,
  uniqueFamilies: summaryRows.length,
  unresolvedFamilies: unresolvedFamilies.map((row) => ({
    family: row.family,
    heuristicKind: row.heuristicKind,
    suites: row.suites,
    projects: row.projects,
    sampleBindings: row.sampleBindings,
  })),
  summaryRows,
  hits,
};

fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
fs.mkdirSync(path.dirname(outputMdPath), { recursive: true });
fs.writeFileSync(outputJsonPath, `${JSON.stringify(inventoryJson, null, 2)}\n`);

const summaryTableRows = summaryRows.map((row) => {
  const suites = row.suites.join(", ");
  const projects = row.projects.join(", ");
  const sampleBindings = row.sampleBindings.slice(0, 5).join("; ");
  return `| ${row.rowId} | ${row.family} | ${row.heuristicKind} | ${row.ownerRepo} | ${row.authoringPoint} | ${suites} | ${projects} | ${sampleBindings} |`;
});

const rawHitRows = hits.map((hit) => {
  const detail =
    hit.bindingType && hit.memberName
      ? `${hit.bindingType}.${hit.memberName}`
      : hit.alias
        ? `${hit.alias} -> ${hit.clrType ?? "unknown"}`
        : hit.family;
  return `| ${hit.rowId} | ${hit.family} | ${hit.suite} | ${hit.project} | ${hit.site} | ${detail} | ${hit.sourceFile ?? ""} |`;
});

const unresolvedSection =
  unresolvedFamilies.length === 0
    ? "None."
    : unresolvedFamilies
        .map(
          (row) =>
            `- \`${row.family}\` (${row.heuristicKind}) — suites: ${row.suites.join(", ")}; projects: ${row.projects.join(", ")}`
        )
        .join("\n");

const markdown = `# Heuristic Hit Inventory

Generated from \`${path.resolve(inputPath)}\`.

- Total heuristic hits: ${hits.length}
- Unique heuristic families: ${summaryRows.length}
- Unresolved families: ${unresolvedFamilies.length}

## Family Summary

| Row | Family | Kind | Owner Repo | Authoring Point | Suites | Projects | Sample Bindings |
| --- | --- | --- | --- | --- | --- | --- | --- |
${summaryTableRows.join("\n")}

## Raw Observed Hits

| Row | Family | Suite | Project | Site | Detail | Source File |
| --- | --- | --- | --- | --- | --- | --- |
${rawHitRows.join("\n")}

## Unresolved Families

${unresolvedSection}
`;

fs.writeFileSync(outputMdPath, markdown);
