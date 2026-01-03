namespace TestCases.common.types.genericsubstitution
{
    public class Wrapper<T>
    {
        public T inner;

        public Wrapper(T inner)
            {
            this.inner = inner;
            }
    }
    public class Container<T>
    {
        public Wrapper<T> wrapped;

        public Container(T value)
            {
            this.wrapped = new Wrapper<T>(value);
            }

        public T getInner()
            {
            return this.wrapped.inner;
            }
    }
    public class IntContainer : Container<int>
    {
        public int addOne()
            {
            return this.getInner() + 1;
            }
    }
}
