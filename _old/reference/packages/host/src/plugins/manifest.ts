export interface TsonicPluginManifest {
  readonly packageName: string;
  readonly entry: string;
}

export function readTsonicPluginManifest(packageName: string, value: unknown): TsonicPluginManifest | undefined {
  if (!isRecord(value)) {
    throw new Error(`Tsonic plugin package '${packageName}' package.json must be an object.`);
  }
  const tsonic = value.tsonic;
  if (tsonic === undefined) {
    return undefined;
  }
  if (!isRecord(tsonic)) {
    throw new Error(`Tsonic plugin '${packageName}' metadata must be an object.`);
  }
  if (tsonic.kind !== "plugin") {
    throw new Error(`Tsonic plugin '${packageName}' metadata kind must be 'plugin'.`);
  }
  if (tsonic.contractVersion !== 1) {
    throw new Error(`Tsonic plugin '${packageName}' uses unsupported contract version ${String(tsonic.contractVersion)}.`);
  }
  if (typeof tsonic.entry !== "string" || tsonic.entry.length === 0) {
    throw new Error(`Tsonic plugin '${packageName}' must declare non-empty tsonic.entry.`);
  }
  return {
    packageName,
    entry: tsonic.entry,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
