#!/usr/bin/env bash
# Claude Code Workflow (CCW) - Remote Installation Script
# One-liner remote installation for Claude Code Workflow system

set -e  # Exit on error

# Script metadata
SCRIPT_NAME="Claude Code Workflow (CCW) Remote Installer"
INSTALLER_VERSION="2.2.0"
BRANCH="${BRANCH:-main}"

# Version control
VERSION_TYPE="${VERSION_TYPE:-stable}"  # stable, latest, branch
TAG_VERSION=""

# Colors for output
COLOR_RESET='\033[0m'
COLOR_SUCCESS='\033[0;32m'
COLOR_INFO='\033[0;36m'
COLOR_WARNING='\033[0;33m'
COLOR_ERROR='\033[0;31m'

# Variables
INSTALL_GLOBAL=false
INSTALL_DIR=""
FORCE=false
NO_BACKUP=false
NON_INTERACTIVE=false
BACKUP_ALL=false

# Functions
function write_color() {
    local message="$1"
    local color="${2:-$COLOR_RESET}"
    echo -e "${color}${message}${COLOR_RESET}"
}

function show_header() {
    write_color "==== $SCRIPT_NAME v$INSTALLER_VERSION ====" "$COLOR_INFO"
    write_color "========================================================" "$COLOR_INFO"
    echo ""
}

function test_prerequisites() {
    # Test bash version
    if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
        write_color "ERROR: Bash 4.0 or higher is required" "$COLOR_ERROR"
        write_color "Current version: ${BASH_VERSION}" "$COLOR_ERROR"
        return 1
    fi

    # Test required commands
    for cmd in curl unzip; do
        if ! command -v "$cmd" &> /dev/null; then
            write_color "ERROR: Required command '$cmd' not found" "$COLOR_ERROR"
            write_color "Please install: $cmd" "$COLOR_ERROR"
            return 1
        fi
    done

    # Test internet connectivity
    if curl -sSf --connect-timeout 10 "https://github.com" &> /dev/null; then
        write_color "✓ Network connection OK" "$COLOR_SUCCESS"
    else
        write_color "ERROR: Cannot connect to GitHub" "$COLOR_ERROR"
        write_color "Please check your network connection" "$COLOR_ERROR"
        return 1
    fi

    return 0
}

function get_temp_directory() {
    local temp_dir
    temp_dir=$(mktemp -d -t claude-code-workflow-install.XXXXXX)
    echo "$temp_dir"
}

function get_latest_release() {
    local api_url="https://api.github.com/repos/catlog22/Claude-Code-Workflow/releases/latest"

    if command -v jq &> /dev/null; then
        # Use jq if available
        local tag
        tag=$(curl -fsSL "$api_url" 2>/dev/null | jq -r '.tag_name' 2>/dev/null)
        if [ -n "$tag" ] && [ "$tag" != "null" ]; then
            echo "$tag"
            return 0
        fi
    else
        # Fallback: parse JSON with grep/sed
        local tag
        tag=$(curl -fsSL "$api_url" 2>/dev/null | grep -o '"tag_name":\s*"[^"]*"' | sed 's/"tag_name":\s*"\([^"]*\)"/\1/')
        if [ -n "$tag" ]; then
            echo "$tag"
            return 0
        fi
    fi

    write_color "WARNING: Failed to fetch latest release, using 'main' branch" "$COLOR_WARNING" >&2
    return 1
}

function download_repository() {
    local temp_dir="$1"
    local version_type="${2:-stable}"
    local branch="${3:-main}"
    local tag="${4:-}"
    local repo_url="https://github.com/catlog22/Claude-Code-Workflow"
    local zip_url=""
    local download_type=""

    # Determine download URL based on version type
    case "$version_type" in
        stable)
            # Download latest stable release
            if [ -z "$tag" ]; then
                tag=$(get_latest_release)
                if [ -z "$tag" ]; then
                    # Fallback to main branch if API fails
                    zip_url="${repo_url}/archive/refs/heads/main.zip"
                    download_type="main branch (fallback)"
                else
                    zip_url="${repo_url}/archive/refs/tags/${tag}.zip"
                    download_type="stable release $tag"
                fi
            else
                zip_url="${repo_url}/archive/refs/tags/${tag}.zip"
                download_type="stable release $tag"
            fi
            ;;
        latest)
            # Download latest main branch
            zip_url="${repo_url}/archive/refs/heads/main.zip"
            download_type="latest main branch"
            ;;
        branch)
            # Download specific branch
            zip_url="${repo_url}/archive/refs/heads/${branch}.zip"
            download_type="branch $branch"
            ;;
        *)
            write_color "ERROR: Invalid version type: $version_type" "$COLOR_ERROR" >&2
            return 1
            ;;
    esac

    local zip_path="${temp_dir}/repo.zip"

    write_color "Downloading from GitHub..." "$COLOR_INFO" >&2
    write_color "Source: $repo_url" "$COLOR_INFO" >&2
    write_color "Type: $download_type" "$COLOR_INFO" >&2

    # Download with curl
    if curl -fsSL -o "$zip_path" "$zip_url" 2>&1 >&2; then
        # Verify the download
        if [ -f "$zip_path" ]; then
            local file_size
            file_size=$(du -h "$zip_path" 2>/dev/null | cut -f1)
            write_color "✓ Download complete ($file_size)" "$COLOR_SUCCESS" >&2

            # Output path to stdout for capture
            echo "$zip_path"
            return 0
        else
            write_color "ERROR: Downloaded file does not exist" "$COLOR_ERROR" >&2
            return 1
        fi
    else
        write_color "ERROR: Download failed" "$COLOR_ERROR" >&2
        return 1
    fi
}

function extract_repository() {
    local zip_path="$1"
    local temp_dir="$2"

    write_color "Extracting files..." "$COLOR_INFO" >&2

    # Verify zip file exists
    if [ ! -f "$zip_path" ]; then
        write_color "ERROR: ZIP file not found: $zip_path" "$COLOR_ERROR" >&2
        return 1
    fi

    # Extract with unzip
    if unzip -q "$zip_path" -d "$temp_dir" >&2 2>&1; then
        # Find the extracted directory
        local repo_dir
        repo_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "Claude-Code-Workflow-*" 2>/dev/null | head -n 1)

        if [ -n "$repo_dir" ] && [ -d "$repo_dir" ]; then
            write_color "✓ Extraction complete: $repo_dir" "$COLOR_SUCCESS" >&2
            # Output path to stdout for capture
            echo "$repo_dir"
            return 0
        else
            write_color "ERROR: Could not find extracted repository directory" "$COLOR_ERROR" >&2
            write_color "Temp directory contents:" "$COLOR_INFO" >&2
            ls -la "$temp_dir" >&2
            return 1
        fi
    else
        write_color "ERROR: Extraction failed" "$COLOR_ERROR" >&2
        return 1
    fi
}

function invoke_local_installer() {
    local repo_dir="$1"
    local installer_path="${repo_dir}/Install-Claude.sh"

    # Make installer executable
    if [ -f "$installer_path" ]; then
        chmod +x "$installer_path"
    else
        write_color "ERROR: Install-Claude.sh not found" "$COLOR_ERROR"
        return 1
    fi

    write_color "Running local installer..." "$COLOR_INFO"
    echo ""

    # Build parameters for local installer
    local params=()

    if [ "$INSTALL_GLOBAL" = true ]; then
        params+=("-InstallMode" "Global")
    fi

    if [ -n "$INSTALL_DIR" ]; then
        params+=("-InstallMode" "Path" "-TargetPath" "$INSTALL_DIR")
    fi

    if [ "$FORCE" = true ]; then
        params+=("-Force")
    fi

    if [ "$NO_BACKUP" = true ]; then
        params+=("-NoBackup")
    fi

    if [ "$NON_INTERACTIVE" = true ]; then
        params+=("-NonInteractive")
    fi

    if [ "$BACKUP_ALL" = true ]; then
        params+=("-BackupAll")
    fi

    # Execute installer
    if (cd "$repo_dir" && "$installer_path" "${params[@]}"); then
        return 0
    else
        write_color "Installation script failed" "$COLOR_ERROR"
        return 1
    fi
}

function cleanup_temp_files() {
    local temp_dir="$1"

    if [ -d "$temp_dir" ]; then
        if rm -rf "$temp_dir"; then
            write_color "✓ Temporary files cleaned up" "$COLOR_INFO"
        else
            write_color "WARNING: Failed to clean temporary files" "$COLOR_WARNING"
        fi
    fi
}

function wait_for_user() {
    local message="${1:-Press Enter to continue...}"

    if [ "$NON_INTERACTIVE" != true ]; then
        echo ""
        write_color "$message" "$COLOR_INFO"
        read -r
        echo ""
    fi
}

function parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --version)
                VERSION_TYPE="$2"
                if [[ ! "$VERSION_TYPE" =~ ^(stable|latest|branch)$ ]]; then
                    write_color "ERROR: Invalid version type: $VERSION_TYPE" "$COLOR_ERROR"
                    write_color "Valid options: stable, latest, branch" "$COLOR_ERROR"
                    exit 1
                fi
                shift 2
                ;;
            --tag)
                TAG_VERSION="$2"
                shift 2
                ;;
            --branch)
                BRANCH="$2"
                shift 2
                ;;
            --global)
                INSTALL_GLOBAL=true
                shift
                ;;
            --directory)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --no-backup)
                NO_BACKUP=true
                shift
                ;;
            --non-interactive)
                NON_INTERACTIVE=true
                shift
                ;;
            --backup-all)
                BACKUP_ALL=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                write_color "Unknown option: $1" "$COLOR_ERROR"
                show_help
                exit 1
                ;;
        esac
    done
}

function show_help() {
    cat << EOF
$SCRIPT_NAME v$INSTALLER_VERSION

Usage: $0 [OPTIONS]

Version Options:
    --version TYPE        Version type: stable (default), latest, or branch
    --tag TAG             Specific release tag (e.g., v3.2.0) - for stable version
    --branch BRANCH       Branch name (default: main) - for branch version

Installation Options:
    --global              Install to global user directory (~/.claude)
    --directory DIR       Install to custom directory
    --force               Force installation without prompts
    --no-backup           Skip backup creation
    --non-interactive     Non-interactive mode (no prompts)
    --backup-all          Backup all files before installation
    --help                Show this help message

Examples:
    # Install latest stable release (recommended)
    $0

    # Install specific stable version
    $0 --version stable --tag v3.2.0

    # Install latest development version
    $0 --version latest

    # Install from specific branch
    $0 --version branch --branch feature/new-feature

    # Global installation without prompts
    $0 --global --non-interactive

    # Custom directory installation
    $0 --directory /opt/claude-code-workflow

Repository: https://github.com/catlog22/Claude-Code-Workflow

EOF
}

function main() {
    show_header

    write_color "This will download and install Claude Code Workflow System from GitHub." "$COLOR_INFO"
    echo ""

    # Test prerequisites
    write_color "Checking system requirements..." "$COLOR_INFO"
    if ! test_prerequisites; then
        wait_for_user "System check failed! Press Enter to exit..."
        exit 1
    fi

    # Determine version information for display
    local version_info=""
    case "$VERSION_TYPE" in
        stable)
            if [ -n "$TAG_VERSION" ]; then
                version_info="Stable release: $TAG_VERSION"
            else
                version_info="Latest stable release (auto-detected)"
            fi
            ;;
        latest)
            version_info="Latest main branch (development)"
            ;;
        branch)
            version_info="Custom branch: $BRANCH"
            ;;
    esac

    # Confirm installation
    if [ "$NON_INTERACTIVE" != true ] && [ "$FORCE" != true ]; then
        echo ""
        write_color "INSTALLATION DETAILS:" "$COLOR_INFO"
        echo "- Repository: https://github.com/catlog22/Claude-Code-Workflow"
        echo "- Version: $version_info"
        echo "- Features: Intelligent workflow orchestration with multi-agent coordination"
        echo ""
        write_color "SECURITY NOTE:" "$COLOR_WARNING"
        echo "- This script will download and execute code from GitHub"
        echo "- Please ensure you trust this source"
        echo ""

        read -p "Continue with installation? (y/N) " -r choice
        if [[ ! $choice =~ ^[Yy]$ ]]; then
            write_color "Installation cancelled" "$COLOR_WARNING"
            exit 0
        fi
    fi

    # Create temp directory
    local temp_dir
    temp_dir=$(get_temp_directory)
    write_color "Temporary directory: $temp_dir" "$COLOR_INFO"

    local success=false

    # Download repository
    local zip_path
    write_color "Starting download process..." "$COLOR_INFO"
    zip_path=$(download_repository "$temp_dir" "$VERSION_TYPE" "$BRANCH" "$TAG_VERSION")
    local download_status=$?

    if [ $download_status -eq 0 ] && [ -n "$zip_path" ] && [ -f "$zip_path" ]; then
        write_color "Download successful: $zip_path" "$COLOR_SUCCESS"

        # Extract repository
        local repo_dir
        write_color "Starting extraction process..." "$COLOR_INFO"
        repo_dir=$(extract_repository "$zip_path" "$temp_dir")
        local extract_status=$?

        if [ $extract_status -eq 0 ] && [ -n "$repo_dir" ] && [ -d "$repo_dir" ]; then
            write_color "Extraction successful: $repo_dir" "$COLOR_SUCCESS"

            # Run local installer
            if invoke_local_installer "$repo_dir"; then
                success=true
                echo ""
                write_color "✓ Remote installation completed successfully!" "$COLOR_SUCCESS"
            else
                write_color "ERROR: Installation script failed" "$COLOR_ERROR"
            fi
        else
            write_color "ERROR: Extraction failed (status: $extract_status)" "$COLOR_ERROR"
            if [ ! -f "$zip_path" ]; then
                write_color "ZIP file does not exist: $zip_path" "$COLOR_ERROR"
            elif [ ! -s "$zip_path" ]; then
                write_color "ZIP file is empty: $zip_path" "$COLOR_ERROR"
            fi
        fi
    else
        write_color "ERROR: Download failed (status: $download_status)" "$COLOR_ERROR"
        if [ -z "$zip_path" ]; then
            write_color "Download did not return a file path" "$COLOR_ERROR"
        elif [ ! -f "$zip_path" ]; then
            write_color "Downloaded file does not exist: $zip_path" "$COLOR_ERROR"
        fi
    fi

    # Cleanup
    cleanup_temp_files "$temp_dir"

    if [ "$success" = true ]; then
        echo ""
        write_color "Next steps:" "$COLOR_INFO"
        echo "1. Review CLAUDE.md for project-specific guidelines"
        echo "2. Try /workflow commands for Agent coordination"
        echo "3. Use /update-memory to manage distributed documentation"

        wait_for_user "Remote installation done! Press Enter to exit..."
        exit 0
    else
        echo ""
        wait_for_user "Installation failed! Press Enter to exit..."
        exit 1
    fi
}

# Parse command line arguments
parse_arguments "$@"

# Run main function
main
