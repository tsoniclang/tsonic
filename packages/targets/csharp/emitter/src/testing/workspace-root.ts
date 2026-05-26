import * as fs from "node:fs";
import * as path from "node:path";

const isTsonicWorkspaceRoot = (candidate: string): boolean => {
  const packageJsonPath = path.join(candidate, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      readonly name?: unknown;
      readonly workspaces?: unknown;
    };
    return (
      parsed.name === "@tsonic/monorepo" && Array.isArray(parsed.workspaces)
    );
  } catch {
    return false;
  }
};

export const findTsonicWorkspaceRoot = (startDir: string): string => {
  let current = path.resolve(startDir);

  for (;;) {
    if (isTsonicWorkspaceRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Unable to find Tsonic workspace root from '${path.resolve(startDir)}'.`
      );
    }

    current = parent;
  }
};
