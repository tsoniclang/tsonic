namespace TestCases.common.types.genericsubstitution
{
    public class Wrapper<T>
    {
        public T Inner;

        public Wrapper(T inner)
            {
            this.Inner = inner;
            }
    }
    public class Container<T>
    {
        public Wrapper<T> Wrapped;

        public Container(T value)
            {
            this.Wrapped = new Wrapper<T>(value);
            }

        public T GetInner()
            {
            return this.Wrapped.Inner;
            }
    }
    public class IntContainer : Container<int>
    {
        public IntContainer(int value) : base(value)
            {

            }

        public int AddOne()
            {
            return this.GetInner() + 1;
            }
    }
}