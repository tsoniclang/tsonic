export async function load(): Promise<object> {
  return import("./module.js");
}

load();
