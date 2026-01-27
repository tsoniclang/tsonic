namespace TestCases.common.types.genericconstraints
{
    public interface Printable
    {
        string toString();
    }
    public class Printer<T>
        where T : Printable
    {
        public T value { get; set; }

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