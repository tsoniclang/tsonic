namespace TestCases.common.types.genericconstraints
{
    public interface Printable
    {
        string ToString();
    }
    public class Printer<T>
        where T : Printable
    {
        public T Value;

        public Printer(T value)
            {
            this.Value = value;
            }

        public string Print()
            {
            return this.Value.ToString();
            }
    }
}