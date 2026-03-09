export async function main(): Promise<void> {
  const module = await import("./module.js");
  console.log(module.value().toString());
}
