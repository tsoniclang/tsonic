namespace TestCases.common.classes.genericinheritance
{
    public class Container<T>
    {
        public T Value;

        public Container(T value)
            {
            this.Value = value;
            }

        public T GetValue()
            {
            return this.Value;
            }
    }
    public class IntContainer : Container<int>
    {
        public IntContainer(int value) : base(value)
            {

            }

        public int Double()
            {
            return this.GetValue() * 2;
            }
    }
    public class StringContainer : Container<string>
    {
        public StringContainer(string value) : base(value)
            {

            }

        public int GetLength()
            {
            return this.GetValue().Length;
            }
    }
}