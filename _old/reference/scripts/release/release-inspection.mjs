import {
  npmView,
  npmViewJson,
  waitForNpmViewPresence,
} from "./npm-registry.mjs";
import { inspectPublishedSource } from "./source-provenance.mjs";
import { compareSemver } from "./release-state.mjs";

export function inspectRegistry(packages, options = {}) {
  const view = options.npmView ?? npmView;
  const viewJson = options.npmViewJson ?? npmViewJson;
  const inspectSource = options.inspectPublishedSource ?? inspectPublishedSource;
  const write = options.write ?? ((value) => process.stdout.write(value));
  return packages.map((entry) => {
    const publishedVersion = view(entry.name, "dist-tags.latest");
    let versionIntegrity = view(
      entry.name,
      "dist.integrity",
      entry.manifest.version,
    );
    const relation = publishedVersion === undefined
      ? "missing"
      : compareSemver(publishedVersion, entry.manifest.version) < 0
        ? "behind"
        : compareSemver(publishedVersion, entry.manifest.version) > 0
          ? "ahead"
          : "equal";
    if (relation === "equal" && versionIntegrity === undefined) {
      const waitForMetadata = options.waitForNpmViewPresence ??
        waitForNpmViewPresence;
      versionIntegrity = waitForMetadata(
        entry.name,
        "dist.integrity",
        entry.manifest.version,
        { npmView: view },
      );
    }
    const source = versionIntegrity === undefined
      ? Object.freeze({ kind: "unpublished" })
      : inspectSource(entry, viewJson(entry.name, "tsonicRelease", entry.manifest.version));
    write(
      `${entry.name}: local=${entry.manifest.version} npm-latest=${publishedVersion ?? "<missing>"} exact=${versionIntegrity === undefined ? "missing" : "published"} source=${source.kind}${source.reason === undefined ? "" : ` (${source.reason})`}\n`,
    );
    return Object.freeze({
      ...entry,
      publishedVersion,
      versionIntegrity,
      relation,
      source,
    });
  });
}
