const p: Promise<number> = Promise.resolve(1);
void p.then((x) => x + 1);
