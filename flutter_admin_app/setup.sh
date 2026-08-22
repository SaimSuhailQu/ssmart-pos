#!/bin/bash

# SSmart POS Flutter Admin App - Setup Script
# This script automates the initial setup of the development environment

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_header "SSmart POS Flutter Admin - Environment Setup"

echo "This script will set up your development environment for the Flutter iOS Admin App."
echo ""

# Step 1: Check Prerequisites
print_header "Step 1: Checking Prerequisites"

# Check Flutter
print_info "Checking Flutter installation..."
if command -v flutter &> /dev/null; then
    FLUTTER_VERSION=$(flutter --version | head -n 1)
    print_success "Flutter found: $FLUTTER_VERSION"

    # Check Flutter version (minimum 3.0.0)
    FLUTTER_VER=$(flutter --version | grep -oP 'Flutter \K[0-9]+\.[0-9]+' | head -1)
    MAJOR_VER=$(echo $FLUTTER_VER | cut -d'.' -f1)
    MINOR_VER=$(echo $FLUTTER_VER | cut -d'.' -f2)

    if [ "$MAJOR_VER" -lt 3 ]; then
        print_error "Flutter version 3.0.0 or higher is required. Current: $FLUTTER_VER"
        print_info "Please upgrade Flutter: flutter upgrade"
        exit 1
    fi
else
    print_error "Flutter is not installed or not in PATH"
    print_info "Please install Flutter from: https://flutter.dev/docs/get-started/install"
    exit 1
fi

# Check Git
print_info "Checking Git installation..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    print_success "Git found: $GIT_VERSION"
else
    print_error "Git is not installed"
    print_info "Please install Git from: https://git-scm.com/downloads"
    exit 1
fi

# Check for macOS and Xcode (optional but recommended for iOS development)
if [[ "$OSTYPE" == "darwin"* ]]; then
    print_info "Checking Xcode installation..."
    if command -v xcodebuild &> /dev/null; then
        XCODE_VERSION=$(xcodebuild -version | head -n 1)
        print_success "Xcode found: $XCODE_VERSION"
    else
        print_warning "Xcode not found. Install from Mac App Store for iOS development."
    fi
else
    print_warning "Not running on macOS. iOS development requires a Mac with Xcode."
    print_info "You can still set up the project, but you won't be able to build for iOS."
fi

# Step 2: Create .env file
print_header "Step 2: Setting Up Environment Configuration"

echo "This script sets up .env file for LOCAL DEVELOPMENT."
echo ""
echo "For CI/CD (GitHub Actions), use GitHub Secrets instead:"
echo "  • More secure (encrypted)"
echo "  • No .env file needed"
echo "  • See GITHUB_SECRETS_SETUP.md for guide"
echo ""

if [ -f ".env" ]; then
    print_warning ".env file already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Keeping existing .env file"
    else
        cp .env.example .env
        print_success "Created new .env file from template"
        print_warning "Please edit .env and add your Firebase credentials"
    fi
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "You need to edit .env and add your Firebase credentials"
        print_info "See ENV_SETUP.md for detailed instructions on getting Firebase credentials"
    else
        print_error ".env.example file not found!"
        exit 1
    fi
fi

# Step 3: Install Flutter dependencies
print_header "Step 3: Installing Flutter Dependencies"

print_info "Running flutter pub get..."
if flutter pub get; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 4: Verify Flutter setup
print_header "Step 4: Verifying Flutter Setup"

print_info "Running flutter doctor..."
echo ""
flutter doctor
echo ""

# Step 5: Check if scripts directory exists
print_header "Step 5: Setting Up Validation Scripts"

if [ ! -d "scripts" ]; then
    mkdir scripts
    print_success "Created scripts directory"
fi

# Step 6: Final checks and next steps
print_header "Setup Complete!"

print_success "Environment setup completed successfully!"
echo ""

# Check if .env has default values
if grep -q "your_api_key_here" .env 2>/dev/null; then
    print_warning "IMPORTANT: Your .env file still contains placeholder values!"
    echo ""
    echo "Next steps:"
    echo "1. Edit the .env file and add your Firebase credentials"
    echo "   ${YELLOW}nano .env${NC}  or  ${YELLOW}open .env${NC}"
    echo ""
    echo "2. Get Firebase credentials from:"
    echo "   https://console.firebase.google.com"
    echo ""
    echo "3. See ENV_SETUP.md for detailed instructions"
    echo ""
    echo "4. Validate your configuration:"
    echo "   ${YELLOW}dart run scripts/validate_firebase.dart${NC}"
    echo ""
    echo "5. Run the app:"
    echo "   ${YELLOW}flutter run${NC}"
else
    print_success "Your .env file appears to be configured!"
    echo ""
    echo "Next steps:"
    echo "1. Validate your Firebase configuration:"
    echo "   ${YELLOW}dart run scripts/validate_firebase.dart${NC}"
    echo ""
    echo "2. Run the app:"
    echo "   ${YELLOW}flutter run${NC}"
    echo ""
    echo "3. For simulator builds:"
    echo "   ${YELLOW}flutter build ios --simulator${NC}"
fi

echo ""
echo "Documentation:"
echo "  • Local setup: ${YELLOW}ENV_SETUP.md${NC}"
echo "  • CI/CD setup: ${YELLOW}GITHUB_SECRETS_SETUP.md${NC}"
echo "  • Quick reference: ${YELLOW}README.md${NC}"
echo ""
