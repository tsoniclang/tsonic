async function load(): Promise<number> {
  const module = await import("./nested/module.js");
  return module.value;
}

void load();
