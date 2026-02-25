// Generated from: NestedSubstitution.ts
// Generated at: 2026-02-25T03:00:57.586Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericsubstitution
{
    public class Wrapper<T>
    {
        public T inner { get; set; }

        public Wrapper(T inner)
        {
            this.inner = inner;
        }
    }

    public class Container<T>
    {
        public Wrapper<T> wrapped { get; set; }

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
        public IntContainer(int value) : base(value)
        {
        }

        public int addOne()
        {
            return this.getInner() + 1;
        }
    }
}