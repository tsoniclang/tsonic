export function sourcePackageGraphFixture(rootFiles, dependencies) {
  const entries = [{ name: "root", root: "/src", files: rootFiles,
    dependencies: Object.keys(dependencies) }, ...Object.entries(dependencies).map(([name, entry]) => ({
    name, root: `/src/node_modules/${name}`, ...entry,
  }))];
  const packageId = name => `source-package:${name}`;
  const componentId = name => `source-package-component:${name}`;
  return Object.freeze({
    fingerprint: JSON.stringify(entries),
    rootPackageId: packageId("root"),
    packages: Object.freeze(entries.map(entry => Object.freeze({
      id: packageId(entry.name), name: entry.name,
      packageRoot: entry.root, sourceRoot: entry.root,
      sourceFiles: Object.freeze(entry.files.map(file => `${entry.root}/${file}`)),
      dependencies: Object.freeze(entry.dependencies.map(packageId)),
      exports: Object.freeze([{ specifier: ".", sourceFile: `${entry.root}/index.ts` }]),
      componentId: componentId(entry.name),
    }))),
    components: Object.freeze(entries.map(entry => Object.freeze({
      id: componentId(entry.name), packages: Object.freeze([packageId(entry.name)]),
      dependencies: Object.freeze(entry.dependencies.map(componentId)),
    }))),
  });
}
