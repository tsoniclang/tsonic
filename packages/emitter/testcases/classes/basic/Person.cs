using Tsonic.Runtime;

namespace TestCases.classes
{
    public class Person
    {
        public string name;
        public double age;

        public string greet()
            {
            return $"Hello, I'm {this.name}";
            }

        public void birthday()
            {
            this.age++;
            }
    }
}
