import { createCsharpTargetPack } from "../../../../tsonic-csharp/dist/public/index.js";
import { createMemoryTestDeclarationProvider, memoryTestModule, memoryTestPrelude,
  memoryTestRegistration } from "../../../packages/source-core/dist/memory-layout/testing/programs.js";
import { checkSourceProgramFixture } from "../source-program-fixture.mjs";

export function checkSourceMemoryFixture(text, options = {}) {
  const projectDirectory = options.projectDirectory ?? "/src";
  const entryPoint = options.entryPoint ?? "index.ts";
  const target = { id: "csharp", options: { outputType: "Library" } };
  return checkSourceProgramFixture({
    project: { entryPoint, rootDir: ".", targets: [target] }, projectDirectory, target,
    targetPack: createCsharpTargetPack(), selectedCapabilities: [], selectedSurfaces: [],
    paths: { projectFilePath: `${projectDirectory}/tsonic.json`, projectRoot: projectDirectory,
      outputRoot: "/out", targetOutputRoot: "/out/csharp", cacheRoot: "/out/cache" },
    currentDirectory: projectDirectory,
    files: { [`${projectDirectory}/${entryPoint}`]: `${options.prelude ?? memoryTestPrelude}${text}`, ...options.files },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler", ...options.compilerOptions },
    targetContributions(base) {
      const contributions = { ...base,
        semanticsModules: [...base.semanticsModules ?? [], memoryTestModule],
        declarationProviders: [...base.declarationProviders ?? [], createMemoryTestDeclarationProvider()],
        dataLayouts: [...base.dataLayouts ?? [], ...options.registrations ?? [memoryTestRegistration]],
      };
      return options.targetContributions === undefined ? contributions : options.targetContributions(contributions);
    },
  });
}
