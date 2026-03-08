async function load() {
  const module = await import("./module.js");
  return module.Box;
}

void load();
