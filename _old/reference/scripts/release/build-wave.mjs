import { hostRoot, run } from "./npm-wave.mjs";

export function buildReleaseWave(wave) {
  for (const entry of wave.packages) {
    if (typeof entry.manifest.scripts?.build !== "string") continue;
    process.stdout.write(`Building release artifact ${entry.name}\n`);
    run("npm", ["run", "build"], {
      cwd: entry.packageRoot,
      env: {
        ...process.env,
        TSONIC_ROOT: hostRoot,
        TSONICLANG_WORKSPACE_ROOT: wave.layout.workspaceRoot,
        TSONIC_SKIP_DEPENDENCY_BUILDS: "1",
      },
    });
  }
}
