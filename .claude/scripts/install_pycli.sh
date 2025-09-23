#!/bin/bash

#==============================================================================
# pycli Installation Script
#
# This script installs the pycli bash wrapper and configuration files
# to the ~/.claude directory structure.
#==============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

#==============================================================================
# Configuration
#==============================================================================

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_BASE="$HOME/.claude"
INSTALL_DIR="$INSTALL_BASE/scripts"
PYTHON_SCRIPT_DIR="$INSTALL_BASE/python_script"
VECTOR_DB_DIR="$INSTALL_BASE/vector_db"
CONFIG_DIR="$INSTALL_BASE/config"
LOGS_DIR="$INSTALL_BASE/logs"

#==============================================================================
# Pre-installation Checks
#==============================================================================

print_status "Starting pycli installation..."
print_status "Source directory: $SOURCE_DIR"
print_status "Install directory: $INSTALL_DIR"

# Check if source files exist
if [[ ! -f "$SOURCE_DIR/pycli" ]]; then
    print_error "pycli script not found in $SOURCE_DIR"
    exit 1
fi

if [[ ! -f "$SOURCE_DIR/pycli.conf" ]]; then
    print_error "pycli.conf not found in $SOURCE_DIR"
    exit 1
fi

# Check if Python script directory exists
if [[ ! -d "$PYTHON_SCRIPT_DIR" ]]; then
    print_warning "Python script directory not found: $PYTHON_SCRIPT_DIR"
    print_status "Please ensure the Python scripts are installed in ~/.claude/python_script/"
    read -p "Continue installation anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installation cancelled."
        exit 0
    fi
fi

#==============================================================================
# Create Directory Structure
#==============================================================================

print_status "Creating directory structure..."

# Create all required directories
directories=(
    "$INSTALL_BASE"
    "$INSTALL_DIR"
    "$VECTOR_DB_DIR"
    "$CONFIG_DIR"
    "$LOGS_DIR"
)

for dir in "${directories[@]}"; do
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        print_status "Created directory: $dir"
    else
        print_status "Directory exists: $dir"
    fi
done

#==============================================================================
# Install Files
#==============================================================================

print_status "Installing pycli files..."

# Backup existing files if they exist
if [[ -f "$INSTALL_DIR/pycli" ]]; then
    backup_file="$INSTALL_DIR/pycli.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$INSTALL_DIR/pycli" "$backup_file"
    print_warning "Backed up existing pycli to: $backup_file"
fi

if [[ -f "$INSTALL_DIR/pycli.conf" ]]; then
    backup_file="$INSTALL_DIR/pycli.conf.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$INSTALL_DIR/pycli.conf" "$backup_file"
    print_warning "Backed up existing pycli.conf to: $backup_file"
fi

# Copy files
cp "$SOURCE_DIR/pycli" "$INSTALL_DIR/"
cp "$SOURCE_DIR/pycli.conf" "$INSTALL_DIR/"

# Make executable
chmod +x "$INSTALL_DIR/pycli"

print_success "Files installed successfully"

#==============================================================================
# Configuration Updates
#==============================================================================

print_status "Updating configuration..."

# Detect Python path
PYTHON_CANDIDATES=(
    "/usr/bin/python3"
    "/usr/local/bin/python3"
    "/opt/conda/bin/python"
    "$(which python3 2>/dev/null || echo "")"
    "$(which python 2>/dev/null || echo "")"
)

DETECTED_PYTHON=""
for candidate in "${PYTHON_CANDIDATES[@]}"; do
    if [[ -n "$candidate" ]] && [[ -x "$candidate" ]]; then
        # Test if it's Python 3
        if "$candidate" -c "import sys; exit(0 if sys.version_info >= (3, 6) else 1)" 2>/dev/null; then
            DETECTED_PYTHON="$candidate"
            break
        fi
    fi
done

if [[ -n "$DETECTED_PYTHON" ]]; then
    print_success "Detected Python: $DETECTED_PYTHON"

    # Update configuration file
    sed -i.bak "s|^PYTHON_PATH=.*|PYTHON_PATH=\"$DETECTED_PYTHON\"|" "$INSTALL_DIR/pycli.conf"
    print_status "Updated PYTHON_PATH in configuration"
else
    print_warning "Could not detect Python 3.6+. Please manually update PYTHON_PATH in:"
    print_warning "  $INSTALL_DIR/pycli.conf"
fi

#==============================================================================
# Shell Integration Setup
#==============================================================================

print_status "Setting up shell integration..."

# Detect shell
SHELL_RC=""
if [[ -n "${BASH_VERSION:-}" ]] || [[ "$SHELL" == *"bash"* ]]; then
    SHELL_RC="$HOME/.bashrc"
elif [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
fi

# Function to add alias/path to shell config
add_to_shell_config() {
    local config_file="$1"
    local content="$2"

    if [[ -f "$config_file" ]]; then
        if ! grep -q "pycli" "$config_file"; then
            echo "" >> "$config_file"
            echo "# pycli - Python CLI Wrapper" >> "$config_file"
            echo "$content" >> "$config_file"
            print_success "Added pycli to $config_file"
            return 0
        else
            print_warning "pycli already configured in $config_file"
            return 1
        fi
    fi
    return 1
}

# Add pycli to PATH
PATH_ADDED=false

if [[ -n "$SHELL_RC" ]]; then
    # Add pycli directory to PATH
    if add_to_shell_config "$SHELL_RC" "export PATH=\"\$PATH:$INSTALL_DIR\""; then
        PATH_ADDED=true
        print_success "Added $INSTALL_DIR to PATH in $SHELL_RC"
    fi
fi

#==============================================================================
# Test Installation
#==============================================================================

print_status "Testing installation..."

# Test that the script is executable
if [[ -x "$INSTALL_DIR/pycli" ]]; then
    print_success "pycli script is executable"
else
    print_error "pycli script is not executable"
    exit 1
fi

# Test configuration loading
if "$INSTALL_DIR/pycli" --help >/dev/null 2>&1; then
    print_success "pycli configuration loads correctly"
else
    print_warning "pycli configuration test failed - check Python path"
fi

#==============================================================================
# Installation Summary
#==============================================================================

print_success "Installation completed successfully!"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Installation Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  • Executable:   $INSTALL_DIR/pycli"
echo "  • Config:       $INSTALL_DIR/pycli.conf"
echo "  • Vector DB:    $VECTOR_DB_DIR/"
echo "  • Logs:         $LOGS_DIR/"
echo

echo "🚀 Quick Start:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$PATH_ADDED" == true ]]; then
    echo "  1. Reload your shell configuration:"
    echo "     source $SHELL_RC"
    echo
    echo "  2. Initialize vector DB for a project:"
    echo "     cd /path/to/your/project"
    echo "     pycli --init"
    echo
    echo "  3. Start analyzing code:"
    echo "     pycli --analyze --query \"authentication patterns\" --tool gemini"
else
    echo "  1. Add pycli to your PATH manually:"
    echo "     echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> $SHELL_RC"
    echo "     source $SHELL_RC"
    echo
    echo "  2. Or create a symlink (alternative):"
    echo "     sudo ln -sf $INSTALL_DIR/pycli /usr/local/bin/pycli"
    echo
    echo "  3. Initialize vector DB for a project:"
    echo "     cd /path/to/your/project"
    echo "     pycli --init"
    echo
    echo "  4. Start analyzing code:"
    echo "     pycli --analyze --query \"authentication patterns\" --tool gemini"
fi

echo
echo "📚 Documentation:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  • Help:         pycli --help"
echo "  • Strategy:     ~/.claude/workflows/python-tools-strategy.md"
echo
echo "⚙️  Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  • Edit config:  $INSTALL_DIR/pycli.conf"
echo "  • pycli location: $INSTALL_DIR/pycli"

if [[ -z "$DETECTED_PYTHON" ]]; then
    echo "  • ⚠️  Please update PYTHON_PATH in pycli.conf"
fi

echo
print_success "Installation complete! Now you can use 'pycli' command directly! 🎉"