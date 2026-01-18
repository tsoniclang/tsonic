// Generated from: GenericExtends.ts
// Generated at: 2026-01-17T15:36:46.162Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.genericinheritance
{
    public class Box<T>
    {
        public T value;

        public Box(T value)
            {
            this.value = value;
            }
    }
    public class LabeledBox<T> : Box<T>
    {
        public string label;

        public LabeledBox(T value, string label) : base(value)
            {
            this.label = label;
            }

        public string describe()
            {
            return $"{this.label}: {this.value}";
            }
    }
    public class WrappedBox<U> : Box<U>
    {
        public WrappedBox(U value) : base(value)
            {

            }

        public Box<U> wrap()
            {
            return new Box<U>(this.value);
            }
    }
}