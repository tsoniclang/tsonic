async function load(): Promise<void> {
  await import("./nested/module.js");
}

void load();
