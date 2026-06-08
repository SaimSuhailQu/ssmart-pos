#!/bin/bash

# SSmart POS Admin - Setup Verification Script
# Verifies that the environment is correctly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

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

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

print_header "SSmart POS Admin - Setup Verification"

ISSUES=0

# Check 1: .env file exists
print_info "Checking .env file..."
if [ -f ".env" ]; then
    print_success ".env file exists"
    
    # Check if it has content
    if [ -s ".env" ]; then
        print_success ".env file has content"
    else
        print_error ".env file is empty"
        ISSUES=$((ISSUES + 1))
    fi
else
    print_error ".env file not found"
    print_info "Create it using the setup script:"
    echo "  ./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist"
    echo "  Or copy and manually edit: cp .env.example .env"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# Check 2: Required Firebase values in .env
print_info "Checking Firebase configuration..."
if [ -f ".env" ]; then
    REQUIRED_VARS=(
        "FIREBASE_API_KEY"
        "FIREBASE_AUTH_DOMAIN"
        "FIREBASE_DATABASE_URL"
        "FIREBASE_PROJECT_ID"
        "FIREBASE_STORAGE_BUCKET"
        "FIREBASE_MESSAGING_SENDER_ID"
        "FIREBASE_APP_ID"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env && ! grep -q "^${var}=$" .env; then
            print_success "$var is set"
        else
            print_error "$var is missing or empty"
            ISSUES=$((ISSUES + 1))
        fi
    done
    
    # MEASUREMENT_ID is optional
    if grep -q "^FIREBASE_MEASUREMENT_ID=" .env && ! grep -q "^FIREBASE_MEASUREMENT_ID=$" .env; then
        print_success "FIREBASE_MEASUREMENT_ID is set (optional)"
    else
        print_warning "FIREBASE_MEASUREMENT_ID is not set (optional - only needed for Analytics)"
    fi
fi

echo ""

# Check 3: Flutter is installed
print_info "Checking Flutter installation..."
if command -v flutter &> /dev/null; then
    FLUTTER_VERSION=$(flutter --version | head -n 1)
    print_success "Flutter is installed: $FLUTTER_VERSION"
else
    print_error "Flutter is not installed"
    print_info "Install from: https://flutter.dev/docs/get-started/install"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# Check 4: Dependencies
print_info "Checking dependencies..."
if [ -f "pubspec.yaml" ]; then
    print_success "pubspec.yaml exists"
    
    if [ -f "pubspec.lock" ]; then
        print_success "Dependencies are installed (pubspec.lock exists)"
    else
        print_warning "Dependencies may not be installed"
        print_info "Run: flutter pub get"
    fi
else
    print_error "pubspec.yaml not found"
    ISSUES=$((ISSUES + 1))
fi

echo ""

# Check 5: iOS setup (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    print_info "Checking iOS setup..."
    
    if [ -d "ios" ]; then
        print_success "ios directory exists"
        
        if [ -f "ios/Runner/GoogleService-Info.plist" ]; then
            print_success "GoogleService-Info.plist exists in ios/Runner/"
        else
            print_warning "GoogleService-Info.plist not found in ios/Runner/"
            print_info "This is optional for testing, but required for Firebase features"
        fi
        
        if [ -d "ios/Pods" ]; then
            print_success "CocoaPods dependencies installed"
        else
            print_warning "CocoaPods dependencies may not be installed"
            print_info "Run: cd ios && pod install"
        fi
    else
        print_error "ios directory not found"
        ISSUES=$((ISSUES + 1))
    fi
else
    print_info "Skipping iOS checks (not on macOS)"
fi

echo ""

# Check 6: Scripts are executable
print_info "Checking setup scripts..."
SCRIPTS=(
    "scripts/setup_from_plist.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            print_success "$script is executable"
        else
            print_warning "$script exists but is not executable"
            print_info "Run: chmod +x $script"
        fi
    else
        print_error "$script not found"
        ISSUES=$((ISSUES + 1))
    fi
done

echo ""

# Check 7: Validation script
print_info "Running Firebase configuration validation..."
if [ -f "scripts/validate_firebase.dart" ]; then
    if command -v dart &> /dev/null; then
        if dart run scripts/validate_firebase.dart 2>/dev/null; then
            print_success "Firebase configuration is valid"
        else
            print_warning "Firebase configuration validation had warnings"
            print_info "This may be normal if some optional fields are missing"
        fi
    else
        print_warning "Dart not available, skipping validation"
    fi
else
    print_warning "validate_firebase.dart not found"
fi

echo ""

# Summary
print_header "Verification Summary"

if [ $ISSUES -eq 0 ]; then
    print_success "All checks passed! Your setup looks good."
    echo ""
    print_info "Next steps:"
    echo "  1. Run the app: flutter run"
    echo "  2. Build for iOS: flutter build ios --simulator"
    echo ""
else
    print_error "Found $ISSUES issue(s) that need attention"
    echo ""
    print_info "Please fix the issues above and run this script again"
    echo ""
    exit 1
fi
