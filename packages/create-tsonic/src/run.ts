import { createTsonicProject } from "./scaffold.js";

interface CreateTsonicCliResult {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

interface ParsedArguments {
  readonly destination: string;
  readonly targetId: string;
  readonly surfaces: readonly string[];
}

export async function runCreateTsonic(
  args: readonly string[],
  currentDirectory: string,
): Promise<CreateTsonicCliResult> {
  if (args.includes("--help") || args.includes("-h")) {
    return { exitCode: 0, stdout: helpText() };
  }
  const parsed = parseArguments(args);
  const created = await createTsonicProject({
    ...parsed,
    currentDirectory,
  });
  return {
    exitCode: 0,
    stdout: [
      "",
      `Created ${created.projectName} with the '${created.targetId}' target.`,
      "",
      `  cd ${created.relativeDestination}`,
      "  npm start",
      "",
    ].join("\n"),
  };
}

function parseArguments(args: readonly string[]): ParsedArguments {
  let destination: string | undefined;
  let targetId: string | undefined;
  const surfaces: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--target" || argument === "--surface") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`Expected a value after ${argument}.\n\n${helpText()}`);
      }
      if (argument === "--target") {
        if (targetId !== undefined) {
          throw new Error("Specify --target exactly once.");
        }
        targetId = value;
      } else {
        surfaces.push(value);
      }
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option '${argument}'.\n\n${helpText()}`);
    }
    if (destination !== undefined) {
      throw new Error(`Unexpected positional argument '${argument}'.\n\n${helpText()}`);
    }
    destination = argument;
  }
  if (destination === undefined || targetId === undefined) {
    throw new Error(`A destination and --target are required.\n\n${helpText()}`);
  }
  requireIdentifier(targetId, "Target id");
  const uniqueSurfaces = [...new Set(surfaces)];
  if (uniqueSurfaces.length !== surfaces.length) {
    throw new Error("Each --surface value must be unique.");
  }
  for (const surface of uniqueSurfaces) {
    requireIdentifier(surface, "Surface id");
  }
  return { destination, targetId, surfaces: uniqueSurfaces };
}

function requireIdentifier(value: string, subject: string): void {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`${subject} '${value}' must use lowercase hyphen-separated ASCII segments.`);
  }
}

function helpText(): string {
  return [
    "Create a ready-to-run Tsonic project.",
    "",
    "Usage:",
    "  npm create tsonic@latest <directory> -- --target <target-id>",
    "",
    "Options:",
    "  --target <id>   Target to install, such as csharp or rust",
    "  --surface <id>  Select a source surface; may be repeated",
    "  -h, --help      Show this help",
    "",
  ].join("\n");
}
