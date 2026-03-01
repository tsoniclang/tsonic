function wrap(): string {
  const id = <T>(x: T): T => x;
  return id<string>("ok");
}

const result = wrap();
void result;
