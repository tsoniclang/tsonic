const id = <T>(x: T): T => x;

export default id;

const n = id<number>(1);
void n;
