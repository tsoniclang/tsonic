import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @template Result
 * @param {readonly import("./contracts.d.mts").AuthoredFile[]} files
 * @param {(project: import("./contracts.d.mts").SpecProject) => Result | Promise<Result>} action
 * @returns {Promise<Result>}
 */
export async function withSpecProject(files, action) {
  const authored = files.map(file => ({ path: file.path, text: file.text }));
  const paths = authored.map(file => file.path);
  for (const [index, path] of paths.entries()) {
    if (path.length === 0 || isAbsolute(path) || win32.isAbsolute(path)
      || path.includes("\\") || path.includes("\0")
      || path.split("/").some(part => part === "" || part === "." || part === "..")) {
      throw new Error(`Invalid authored file path at index ${index}`);
    }
    if (paths.some((other, otherIndex) => otherIndex !== index
      && (other === path || other.startsWith(`${path}/`)))) {
      throw new Error(`Colliding authored file path at index ${index}`);
    }
  }
  const parent = fileURLToPath(new URL("../../../.temp/host-spec/", import.meta.url));
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(resolve(parent, "project-"));
  try {
    for (const file of authored) {
      const destination = resolve(root, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.text, "utf8");
    }
    return await action(Object.freeze({ root, files: Object.freeze(paths) }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
