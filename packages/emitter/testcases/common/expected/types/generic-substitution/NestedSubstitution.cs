// Generated from: NestedSubstitution.ts
// Generated at: 2026-01-17T15:37:37.519Z
// WARNING: Do not modify this file manually

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
        public IntContainer(int value) : base(value)
            {

            }

        public int addOne()
            {
            return this.getInner() + 1;
            }
    }
}