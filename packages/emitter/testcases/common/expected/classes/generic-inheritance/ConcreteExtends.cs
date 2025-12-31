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
        public int @double()
            {
            return (int)(this.getValue() * 2);
            }
    }
    public class StringContainer : Container<string>
    {
        public int getLength()
            {
            return (int)this.getValue().Length;
            }
    }
}
