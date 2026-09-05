#!/bin/bash

# Test Setup Automation Scripts
# This script verifies that all setup automation files are in place and working

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
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

# Get to project root
cd "$(dirname "$0")/.."

print_header "Testing Setup Automation Files"

TEST_PASSED=0
TEST_FAILED=0

# Test 1: Check required files exist
print_info "Checking required files..."

FILES=(
    "setup.sh"
    "quickstart.sh"
    ".env.example"
    "ENV_SETUP.md"
    "SETUP_CHECKLIST.md"
    "scripts/validate_firebase.dart"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
        ((TEST_PASSED++))
    else
        print_error "$file is missing!"
        ((TEST_FAILED++))
    fi
done

# Test 2: Check scripts are executable
print_info "Checking script permissions..."

SCRIPTS=(
    "setup.sh"
    "quickstart.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        print_success "$script is executable"
        ((TEST_PASSED++))
    else
        print_error "$script is not executable!"
        print_info "Run: chmod +x $script"
        ((TEST_FAILED++))
    fi
done

# Test 3: Check .env.example content
print_info "Checking .env.example content..."

REQUIRED_KEYS=(
    "FIREBASE_API_KEY"
    "FIREBASE_AUTH_DOMAIN"
    "FIREBASE_DATABASE_URL"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_STORAGE_BUCKET"
    "FIREBASE_MESSAGING_SENDER_ID"
    "FIREBASE_APP_ID"
    "FIREBASE_MEASUREMENT_ID"
)

for key in "${REQUIRED_KEYS[@]}"; do
    if grep -q "^${key}=" .env.example; then
        print_success "$key found in .env.example"
        ((TEST_PASSED++))
    else
        print_error "$key missing from .env.example"
        ((TEST_FAILED++))
    fi
done

# Test 4: Check documentation files
print_info "Checking documentation..."

DOCS=(
    "README.md"
    "ENV_SETUP.md"
    "SETUP_CHECKLIST.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        # Check if file is not empty
        if [ -s "$doc" ]; then
            print_success "$doc exists and has content"
            ((TEST_PASSED++))
        else
            print_error "$doc exists but is empty"
            ((TEST_FAILED++))
        fi
    else
        print_error "$doc is missing"
        ((TEST_FAILED++))
    fi
done

# Test 5: Check if .env is in .gitignore
print_info "Checking .gitignore..."

if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore; then
        print_success ".env is in .gitignore"
        ((TEST_PASSED++))
    else
        print_error ".env is not in .gitignore!"
        ((TEST_FAILED++))
    fi
else
    print_error ".gitignore file not found"
    ((TEST_FAILED++))
fi

# Test 6: Check scripts directory
print_info "Checking scripts directory..."

if [ -d "scripts" ]; then
    print_success "scripts directory exists"
    ((TEST_PASSED++))

    if [ -f "scripts/validate_firebase.dart" ]; then
        print_success "validate_firebase.dart exists"
        ((TEST_PASSED++))
    else
        print_error "validate_firebase.dart missing"
        ((TEST_FAILED++))
    fi
else
    print_error "scripts directory not found"
    ((TEST_FAILED++))
fi

# Test 7: Syntax check scripts (basic)
print_info "Checking script syntax..."

for script in "${SCRIPTS[@]}"; do
    if bash -n "$script" 2>/dev/null; then
        print_success "$script has valid syntax"
        ((TEST_PASSED++))
    else
        print_error "$script has syntax errors"
        ((TEST_FAILED++))
    fi
done

# Summary
print_header "Test Results"

echo "Tests passed: ${GREEN}$TEST_PASSED${NC}"
echo "Tests failed: ${RED}$TEST_FAILED${NC}"
echo ""

if [ $TEST_FAILED -eq 0 ]; then
    print_success "All tests passed! Setup automation is ready to use."
    echo ""
    echo "Next steps:"
    echo "  1. Run setup: ${YELLOW}./quickstart.sh${NC}"
    echo "  2. Or manual: ${YELLOW}./setup.sh${NC}"
    exit 0
else
    print_error "Some tests failed. Please fix the issues above."
    exit 1
fi
