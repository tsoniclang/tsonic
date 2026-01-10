namespace TestCases.common.classes.genericinheritance
{
    public class Box<T>
    {
        public T Value;

        public Box(T value)
            {
            this.Value = value;
            }
    }
    public class LabeledBox<T> : Box<T>
    {
        public string Label;

        public LabeledBox(T value, string label) : base(value)
            {
            this.Label = label;
            }

        public string Describe()
            {
            return $"{this.Label}: {this.Value}";
            }
    }
    public class WrappedBox<U> : Box<U>
    {
        public WrappedBox(U value) : base(value)
            {

            }

        public Box<U> Wrap()
            {
            return new Box<U>(this.Value);
            }
    }
}