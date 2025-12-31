namespace TestCases.common.types.genericconstraints
{
    public class Printable
    {
        public string toString() => throw new NotImplementedException();
    }
    public class Printer<T>
        where T : Printable
    {
        public T value;

        public Printer(T value)
            {
            this.value = value;
            }

        public string print()
            {
            return this.value.toString();
            }
    }
}