async function load(): Promise<number> {
  const module = await import("./module.js");
  return module.value;
}

void load();
