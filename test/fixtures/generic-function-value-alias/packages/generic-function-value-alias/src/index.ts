const id = <T>(x: T): T => x;
const copy = id;
const finalCopy = copy;

const n = finalCopy<number>(1);
const s = copy<string>("ok");

void n;
void s;
