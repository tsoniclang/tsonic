/**
 * CLI command dispatcher
 */

import { resolve } from "node:path";
import { parseArgs } from "./parser.js";
import {
  dispatchProjectCommand,
  resolveProjectCommandConfig,
} from "./dispatcher/project-commands.js";
import {
  ensureDotnetInstalled,
  handleBuiltinCliCommand,
  loadWorkspaceCommandContext,
  runWorkspaceMutationCommand,
} from "./dispatcher/workspace-commands.js";

/**
 * Main CLI entry point
 */
export const runCli = async (args: string[]): Promise<number> => {
  const parsed = parseArgs(args);

  const builtinExitCode = handleBuiltinCliCommand(parsed);
  if (builtinExitCode !== null) return builtinExitCode;

  const dotnetError = ensureDotnetInstalled();
  if (dotnetError) return dotnetError.code;

  const workspaceContext = loadWorkspaceCommandContext({
    ...parsed,
    options: parsed.options.config
      ? {
          ...parsed.options,
          config: resolve(process.cwd(), parsed.options.config),
        }
      : parsed.options,
  });
  if ("code" in workspaceContext) {
    console.error(`Error: ${workspaceContext.error}`);
    return workspaceContext.code;
  }

  const workspaceCommandExitCode = runWorkspaceMutationCommand(
    parsed,
    workspaceContext.workspaceConfigPath
  );
  if (workspaceCommandExitCode !== null) return workspaceCommandExitCode;

  const configResult = resolveProjectCommandConfig(
    parsed,
    workspaceContext.workspaceConfigPath,
    workspaceContext.workspaceRoot,
    workspaceContext.rawWorkspaceConfig
  );
  if (!configResult.ok) {
    console.error(`Error: ${configResult.error.error}`);
    return configResult.error.code;
  }

  return dispatchProjectCommand(parsed, configResult.value);
};
