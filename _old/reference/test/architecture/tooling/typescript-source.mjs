import { createCompilerSessionFromFiles } from "../../../packages/tsts/dist/src/index.js";

export function readArchitectureTypeScript(sourceFiles) {
  return createCompilerSessionFromFiles({
    currentDirectory: "/architecture",
    files: new Map([...sourceFiles].map(([path, text]) => [`/architecture/${path}`, text])),
    rootFiles: [...sourceFiles.keys()],
    compilerOptions: {
      allowJs: true,
      module: "esnext",
      moduleResolution: "bundler",
      noLib: true,
      noResolve: true,
      skipLibCheck: true,
      target: "esnext",
    },
  }).checkSource();
}
