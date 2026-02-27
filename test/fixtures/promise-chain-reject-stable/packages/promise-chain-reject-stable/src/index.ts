async function load(): Promise<number> {
  return 1;
}

const p: Promise<number> = load();
void p.then((x) => x + 1);
