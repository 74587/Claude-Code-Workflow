#!/usr/bin/env python3
"""
Terminal Colors Utility
Provides ANSI color codes for terminal output formatting.
"""

import os
import sys
from typing import Optional


class Colors:
    """ANSI color codes for terminal output."""

    # Basic colors
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    PURPLE = '\033[0;35m'
    CYAN = '\033[0;36m'
    WHITE = '\033[0;37m'
    BLACK = '\033[0;30m'

    # Bright colors
    BRIGHT_RED = '\033[1;31m'
    BRIGHT_GREEN = '\033[1;32m'
    BRIGHT_YELLOW = '\033[1;33m'
    BRIGHT_BLUE = '\033[1;34m'
    BRIGHT_PURPLE = '\033[1;35m'
    BRIGHT_CYAN = '\033[1;36m'
    BRIGHT_WHITE = '\033[1;37m'

    # Background colors
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_BLUE = '\033[44m'
    BG_PURPLE = '\033[45m'
    BG_CYAN = '\033[46m'
    BG_WHITE = '\033[47m'

    # Text formatting
    BOLD = '\033[1m'
    DIM = '\033[2m'
    UNDERLINE = '\033[4m'
    BLINK = '\033[5m'
    REVERSE = '\033[7m'
    STRIKETHROUGH = '\033[9m'

    # Reset
    NC = '\033[0m'  # No Color / Reset
    RESET = '\033[0m'

    @classmethod
    def is_tty(cls) -> bool:
        """Check if output is a TTY (supports colors)."""
        return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()

    @classmethod
    def supports_color(cls) -> bool:
        """Check if the terminal supports color output."""
        # Check environment variables
        if os.getenv('NO_COLOR'):
            return False

        if os.getenv('FORCE_COLOR'):
            return True

        # Check if output is a TTY
        if not cls.is_tty():
            return False

        # Check TERM environment variable
        term = os.getenv('TERM', '').lower()
        if 'color' in term or term in ('xterm', 'xterm-256color', 'screen', 'tmux'):
            return True

        # Windows Terminal detection
        if os.name == 'nt':
            # Windows 10 version 1511 and later support ANSI colors
            try:
                import subprocess
                result = subprocess.run(['ver'], capture_output=True, text=True, shell=True)
                if result.returncode == 0:
                    version_info = result.stdout
                    # Extract Windows version (simplified check)
                    if 'Windows' in version_info:
                        return True
            except Exception:
                pass

        return False

    @classmethod
    def colorize(cls, text: str, color: str, bold: bool = False) -> str:
        """Apply color to text if colors are supported."""
        if not cls.supports_color():
            return text

        prefix = color
        if bold:
            prefix = cls.BOLD + prefix

        return f"{prefix}{text}{cls.RESET}"

    @classmethod
    def red(cls, text: str, bold: bool = False) -> str:
        """Color text red."""
        return cls.colorize(text, cls.RED, bold)

    @classmethod
    def green(cls, text: str, bold: bool = False) -> str:
        """Color text green."""
        return cls.colorize(text, cls.GREEN, bold)

    @classmethod
    def yellow(cls, text: str, bold: bool = False) -> str:
        """Color text yellow."""
        return cls.colorize(text, cls.YELLOW, bold)

    @classmethod
    def blue(cls, text: str, bold: bool = False) -> str:
        """Color text blue."""
        return cls.colorize(text, cls.BLUE, bold)

    @classmethod
    def purple(cls, text: str, bold: bool = False) -> str:
        """Color text purple."""
        return cls.colorize(text, cls.PURPLE, bold)

    @classmethod
    def cyan(cls, text: str, bold: bool = False) -> str:
        """Color text cyan."""
        return cls.colorize(text, cls.CYAN, bold)

    @classmethod
    def bold(cls, text: str) -> str:
        """Make text bold."""
        return cls.colorize(text, '', True)

    @classmethod
    def dim(cls, text: str) -> str:
        """Make text dim."""
        return cls.colorize(text, cls.DIM)

    @classmethod
    def underline(cls, text: str) -> str:
        """Underline text."""
        return cls.colorize(text, cls.UNDERLINE)

    @classmethod
    def success(cls, text: str) -> str:
        """Format success message (green)."""
        return cls.green(f"[SUCCESS] {text}", bold=True)

    @classmethod
    def error(cls, text: str) -> str:
        """Format error message (red)."""
        return cls.red(f"[ERROR] {text}", bold=True)

    @classmethod
    def warning(cls, text: str) -> str:
        """Format warning message (yellow)."""
        return cls.yellow(f"[WARNING] {text}", bold=True)

    @classmethod
    def info(cls, text: str) -> str:
        """Format info message (blue)."""
        return cls.blue(f"[INFO] {text}")

    @classmethod
    def highlight(cls, text: str) -> str:
        """Highlight text (cyan background)."""
        if not cls.supports_color():
            return f"[{text}]"
        return f"{cls.BG_CYAN}{cls.BLACK}{text}{cls.RESET}"

    @classmethod
    def strip_colors(cls, text: str) -> str:
        """Remove ANSI color codes from text."""
        import re
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)


# Convenience functions for common usage
def colorize(text: str, color: str) -> str:
    """Convenience function to colorize text."""
    return Colors.colorize(text, color)


def red(text: str) -> str:
    """Red text."""
    return Colors.red(text)


def green(text: str) -> str:
    """Green text."""
    return Colors.green(text)


def yellow(text: str) -> str:
    """Yellow text."""
    return Colors.yellow(text)


def blue(text: str) -> str:
    """Blue text."""
    return Colors.blue(text)


def success(text: str) -> str:
    """Success message."""
    return Colors.success(text)


def error(text: str) -> str:
    """Error message."""
    return Colors.error(text)


def warning(text: str) -> str:
    """Warning message."""
    return Colors.warning(text)


def info(text: str) -> str:
    """Info message."""
    return Colors.info(text)


if __name__ == "__main__":
    # Test color output
    print(Colors.red("Red text"))
    print(Colors.green("Green text"))
    print(Colors.yellow("Yellow text"))
    print(Colors.blue("Blue text"))
    print(Colors.purple("Purple text"))
    print(Colors.cyan("Cyan text"))
    print(Colors.bold("Bold text"))
    print(Colors.success("Success message"))
    print(Colors.error("Error message"))
    print(Colors.warning("Warning message"))
    print(Colors.info("Info message"))
    print(Colors.highlight("Highlighted text"))
    print(f"Color support: {Colors.supports_color()}")
    print(f"TTY: {Colors.is_tty()}")