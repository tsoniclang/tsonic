// Generated from: ConcreteExtends.ts
// Generated at: 2026-01-17T15:36:44.985Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.genericinheritance
{
    public class Container<T>
    {
        public T value;

        public Container(T value)
            {
            this.value = value;
            }

        public T getValue()
            {
            return this.value;
            }
    }
    public class IntContainer : Container<int>
    {
        public IntContainer(int value) : base(value)
            {

            }

        public int @double()
            {
            return this.getValue() * 2;
            }
    }
    public class StringContainer : Container<string>
    {
        public StringContainer(string value) : base(value)
            {

            }

        public int getLength()
            {
            return this.getValue().Length;
            }
    }
}