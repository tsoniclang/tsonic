namespace TestCases.common.classes.basic
{
    public class Person
    {
        public string Name;

        public double Age;

        public string Greet()
            {
            return $"Hello, I'm {this.Name}";
            }

        public void Birthday()
            {
            this.Age++;
            }
    }
}