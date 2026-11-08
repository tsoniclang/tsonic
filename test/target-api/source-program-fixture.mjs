import {
  captureTargetCapabilityContributions,
  checkTargetSourceFiles,
  collectTargetSourceProfileContributions,
} from "../../packages/host/dist/index.js";

export function checkSourceProgramFixture(options) {
  const {
    project,
    projectDirectory,
    target,
    targetPack,
    paths,
    selectedCapabilities,
    selectedSurfaces,
    currentDirectory,
    files,
    rootFiles,
    configFileName,
    compilerOptions,
  } = options;
  const session = targetPack.createCompilationSession({
    project,
    projectDirectory,
    target,
    paths,
    selectedSurfaceIds: selectedSurfaces.map(surface => surface.id),
    capabilities: captureTargetCapabilityContributions({
      project,
      projectDirectory,
      target,
      selectedCapabilities,
      selectedSurfaces,
    }),
  });
  try {
    const originalCompilerContributions = session.sourceCompilerContributions();
    const originalProfileContributions = session.sourceProfileContributions();
    const targetContributions = options.targetContributions === undefined
      ? originalCompilerContributions : options.targetContributions(originalCompilerContributions);
    const profileContributions = options.sourceProfile === undefined
      ? originalProfileContributions : options.sourceProfile(originalProfileContributions);
    const sourceProfile = collectTargetSourceProfileContributions({
      project,
      projectDirectory,
      projectRoot: paths.projectRoot,
      target,
      targetPackId: targetPack.id,
      selectedCapabilities,
      selectedSurfaces,
      targetContributions: profileContributions,
    });
    return checkTargetSourceFiles({
      project,
      projectDirectory,
      target,
      targetPack,
      selectedCapabilities,
      selectedSurfaces,
      targetContributions,
      sourceProfile,
      currentDirectory,
      files,
      ...(rootFiles === undefined ? {} : { rootFiles }),
      ...(configFileName === undefined ? {} : { configFileName }),
      ...(compilerOptions === undefined ? {} : { compilerOptions }),
    });
  } finally {
    session.close();
  }
}
