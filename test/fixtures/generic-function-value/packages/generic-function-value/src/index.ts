export const id = <T>(x: T): T => x;

const n = id<number>(42);
const s = id<string>("ok");

void n;
void s;
