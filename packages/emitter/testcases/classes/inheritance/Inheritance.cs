using Tsonic.Runtime;

namespace TestCases.classes
{
    public class Animal
    {
        public string name;

        public Animal(string name)
            {
            this.name = name;
            }

        public string makeSound()
            {
            return "Some sound";
            }
    }

    public class Dog : Animal
    {
        public string breed;

        public Dog(string name, string breed) : base(name)
            {
            this.breed = breed;
            }

        public override string makeSound()
            {
            return "Woof!";
            }
    }

    public static class Inheritance
    {
    }
}
