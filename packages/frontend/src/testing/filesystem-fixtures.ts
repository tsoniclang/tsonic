import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type FixtureCopySpec = {
  from: string;
  to: string;
};

type FixtureSymlinkSpec = {
  from: string;
  to: string;
  type?: fs.symlink.Type;
};

type FixtureMeta = {
  copyDirectories?: FixtureCopySpec[];
  copyFiles?: FixtureCopySpec[];
  symlinks?: FixtureSymlinkSpec[];
};

export type MaterializedFixture = {
  root: string;
  path: (relativePath?: string) => string;
  cleanup: () => void;
};

const resolveFrontendPackageRoot = (): string => {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (
      fs.existsSync(path.join(currentDir, "package.json")) &&
      fs.existsSync(path.join(currentDir, "src"))
    ) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(
        `Unable to locate the frontend package root from ${import.meta.url}`
      );
    }
    currentDir = parentDir;
  }
};

const frontendPackageRoot = resolveFrontendPackageRoot();
const repoRoot = path.resolve(frontendPackageRoot, "../..");
const fixtureSourceRoot = path.join(frontendPackageRoot, "test-fixtures");
const materializedFixtureRoot = path.join(
  tmpdir(),
  "frontend-test-fixtures"
);

const loadFixtureMeta = (fixtureRoot: string): FixtureMeta => {
  const metaPath = path.join(fixtureRoot, "fixture.meta.json");
  if (!fs.existsSync(metaPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf8")) as FixtureMeta;
};

const copyFixtureContents = (sourceRoot: string, destinationRoot: string) => {
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const entry of fs.readdirSync(sourceRoot)) {
    if (entry === "fixture.meta.json") {
      continue;
    }
    fs.cpSync(path.join(sourceRoot, entry), path.join(destinationRoot, entry), {
      recursive: true,
    });
  }
};

const applyFixtureMeta = (
  destinationRoot: string,
  fixtureMeta: FixtureMeta
): void => {
  for (const copy of fixtureMeta.copyDirectories ?? []) {
    fs.cpSync(
      path.resolve(repoRoot, copy.from),
      path.join(destinationRoot, copy.to),
      { recursive: true }
    );
  }

  for (const copy of fixtureMeta.copyFiles ?? []) {
    const destinationPath = path.join(destinationRoot, copy.to);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(path.resolve(repoRoot, copy.from), destinationPath);
  }

  for (const link of fixtureMeta.symlinks ?? []) {
    const targetPath = path.join(destinationRoot, link.from);
    const linkPath = path.join(destinationRoot, link.to);
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(targetPath, linkPath, link.type ?? "file");
  }
};

export const materializeFrontendFixture = (
  fixtureNames: string | readonly string[]
): MaterializedFixture => {
  const normalizedFixtureNames = Array.isArray(fixtureNames)
    ? fixtureNames
    : [fixtureNames];

  fs.mkdirSync(materializedFixtureRoot, { recursive: true });
  const destinationRoot = fs.mkdtempSync(
    path.join(materializedFixtureRoot, "fixture-")
  );

  for (const fixtureName of normalizedFixtureNames) {
    const sourceRoot = path.join(fixtureSourceRoot, fixtureName);
    if (!fs.existsSync(sourceRoot)) {
      throw new Error(`Frontend fixture '${fixtureName}' does not exist`);
    }
    copyFixtureContents(sourceRoot, destinationRoot);
    applyFixtureMeta(destinationRoot, loadFixtureMeta(sourceRoot));
  }

  return {
    root: destinationRoot,
    path: (relativePath = ".") => path.join(destinationRoot, relativePath),
    cleanup: () =>
      fs.rmSync(destinationRoot, {
        recursive: true,
        force: true,
      }),
  };
};
