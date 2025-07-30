#!/bin/bash

# MCP Storage Server Management Script
# Provides build, integrate, and publish functionality

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="mcp-storage-server"

# Function to print colored output
print_info() {
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

# Function to find Claude Code config file
find_claude_config() {
    local os=$(detect_os)
    local config_file=""
    
    case $os in
        "windows")
            # Try Windows paths
            if [[ -n "$USERPROFILE" ]]; then
                config_file="$USERPROFILE/.claude.json"
            elif [[ -n "$HOME" ]]; then
                config_file="$HOME/.claude.json"
            fi
            ;;
        "macos"|"linux")
            config_file="$HOME/.claude.json"
            ;;
    esac
    
    echo "$config_file"
}

# Function to get npm global path
get_npm_global_path() {
    if command_exists npm; then
        npm root -g 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# Function to build the project
build_project() {
    print_info "Building TypeScript project..."
    
    # Check if package.json exists
    if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    # Check if node_modules exists
    if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Build the project
    print_info "Compiling TypeScript..."
    npm run build
    
    # Verify build output
    if [[ -f "$SCRIPT_DIR/dist/index.js" ]]; then
        print_success "Build completed successfully!"
        print_info "Output: $SCRIPT_DIR/dist/index.js"
    else
        print_error "Build failed - dist/index.js not found"
        exit 1
    fi
}

# Function to backup existing config
backup_config() {
    local config_file="$1"
    local backup_file="${config_file}.backup.$(date +%Y%m%d-%H%M%S)"
    
    if [[ -f "$config_file" ]]; then
        cp "$config_file" "$backup_file"
        print_info "Backed up existing config to: $backup_file"
    fi
}

# Function to integrate with Claude Code
integrate_claude() {
    print_info "Integrating with Claude Code..."
    
    # Ensure project is built
    if [[ ! -f "$SCRIPT_DIR/dist/index.js" ]]; then
        print_warning "Project not built. Building first..."
        build_project
    fi
    
    local config_file=$(find_claude_config)
    local abs_script_path="$SCRIPT_DIR/dist/index.js"
    
    # Convert to Windows path if needed
    local os=$(detect_os)
    if [[ "$os" == "windows" ]]; then
        # Convert Unix path to Windows path for Git Bash
        abs_script_path=$(cygpath -w "$abs_script_path" 2>/dev/null || echo "$abs_script_path")
        abs_script_path="${abs_script_path//\\//}"  # Convert backslashes to forward slashes
    fi
    
    print_info "Config file: $config_file"
    print_info "Script path: $abs_script_path"
    
    # Create config directory if it doesn't exist
    local config_dir=$(dirname "$config_file")
    if [[ ! -d "$config_dir" ]]; then
        mkdir -p "$config_dir"
        print_info "Created config directory: $config_dir"
    fi
    
    # Backup existing config
    backup_config "$config_file"
    
    # Create or update configuration
    local config_content
    if [[ -f "$config_file" ]] && [[ -s "$config_file" ]]; then
        # File exists and is not empty
        if command_exists jq; then
            # Use jq for safe JSON manipulation
            print_info "Updating existing configuration with jq..."
            config_content=$(jq --arg path "$abs_script_path" '
                .mcp = (.mcp // {}) |
                .mcp.servers = (.mcp.servers // {}) |
                .mcp.servers["mcp-storage"] = {
                    "command": "node",
                    "args": [$path],
                    "transport": "stdio"
                }
            ' "$config_file")
        else
            # Fallback without jq - create new config
            print_warning "jq not found, creating new configuration..."
            config_content='{
  "mcp": {
    "servers": {
      "mcp-storage": {
        "command": "node",
        "args": ["'$abs_script_path'"],
        "transport": "stdio"
      }
    }
  }
}'
        fi
    else
        # File doesn't exist or is empty
        print_info "Creating new configuration..."
        config_content='{
  "mcp": {
    "servers": {
      "mcp-storage": {
        "command": "node",
        "args": ["'$abs_script_path'"],
        "transport": "stdio"
      }
    }
  }
}'
    fi
    
    # Write configuration
    echo "$config_content" > "$config_file"
    
    # Verify JSON is valid
    if command_exists jq; then
        if jq . "$config_file" >/dev/null 2>&1; then
            print_success "Configuration updated successfully!"
        else
            print_error "Generated invalid JSON configuration"
            exit 1
        fi
    else
        print_success "Configuration updated!"
        print_warning "Install 'jq' for JSON validation"
    fi
    
    print_info "MCP Storage Server configured at: $config_file"
    print_info "Server path: $abs_script_path"
    print_warning "Restart Claude Code to load the new configuration"
    
    # Try using claude CLI if available
    if command_exists claude; then
        print_info "Attempting to verify with Claude CLI..."
        if claude mcp list 2>/dev/null | grep -q "mcp-storage"; then
            print_success "MCP server appears to be configured correctly"
        else
            print_info "Run 'claude mcp list' after restarting Claude Code to verify"
        fi
    fi
}

# Function to publish to npm
publish_npm() {
    print_info "Publishing to npm registry..."
    
    # Ensure project is built
    if [[ ! -f "$SCRIPT_DIR/dist/index.js" ]]; then
        print_warning "Project not built. Building first..."
        build_project
    fi
    
    # Check if logged in to npm
    if ! npm whoami >/dev/null 2>&1; then
        print_error "Not logged in to npm. Run 'npm login' first."
        exit 1
    fi
    
    # Check if this version already exists
    local current_version=$(node -p "require('./package.json').version")
    if npm view "$PROJECT_NAME@$current_version" version >/dev/null 2>&1; then
        print_error "Version $current_version already exists on npm"
        print_info "Update version in package.json first (npm version patch/minor/major)"
        exit 1
    fi
    
    # Run tests if available
    if npm run test >/dev/null 2>&1; then
        print_info "Running tests..."
        npm test
    fi
    
    # Publish
    print_info "Publishing version $current_version..."
    npm publish
    
    print_success "Published $PROJECT_NAME@$current_version to npm!"
    print_info "Install globally with: npm install -g $PROJECT_NAME"
}

# Function to show help
show_help() {
    echo "MCP Storage Server Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build        Build the TypeScript project"
    echo "  integrate    Remove existing config and integrate with Claude Code"
    echo "  publish      Publish package to npm registry (requires npm login)"
    echo "  help         Show this help message"
    echo ""
    echo "Features:"
    echo "  • Smart Configuration: Automatically detects and updates Claude Code MCP settings"
    echo "  • Backup Safety: Creates backups before modifying existing configurations"
    echo "  • JSON Validation: Uses 'jq' for safe JSON manipulation when available"
    echo "  • Cross-Platform: Works on Windows, macOS, and Linux"
    echo "  • Path Detection: Automatically finds correct paths for integration"
    echo ""
    echo "Examples:"
    echo "  $0 build                    # Build the project"
    echo "  $0 integrate                # Integrate with Claude Code"
    echo "  $0 build && $0 integrate    # Build and integrate in one command"
    echo "  $0 publish                  # Publish to npm (for maintainers)"
    echo ""
    echo "OS detected: $(detect_os)"
    echo "Claude config: $(find_claude_config)"
    echo "NPM global path: $(get_npm_global_path)"
}

# Main script logic
main() {
    case "${1:-help}" in
        "build")
            build_project
            ;;
        "integrate")
            integrate_claude
            ;;
        "publish")
            publish_npm
            ;;
        "help"|"--help"|"-h"|"")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"