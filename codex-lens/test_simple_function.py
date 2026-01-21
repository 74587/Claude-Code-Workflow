"""Simple test file with clear function definitions."""

def hello_world():
    """A simple function."""
    return "Hello, World!"

def greet(name: str) -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"

def main():
    """Main function that calls other functions."""
    msg = hello_world()
    greeting = greet("Alice")
    print(msg)
    print(greeting)

if __name__ == "__main__":
    main()
