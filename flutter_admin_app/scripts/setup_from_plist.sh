#!/bin/bash

# SSmart POS Admin - Automated Setup from GoogleService-Info.plist
# This script extracts Firebase credentials from a plist file and sets up the project automatically

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Function to extract value from plist
extract_plist_value() {
    local plist_file="$1"
    local key="$2"

    # Use plutil if available (macOS), otherwise use grep/sed
    if command -v plutil &> /dev/null; then
        local val
        if val=$(plutil -extract "$key" raw "$plist_file" 2>/dev/null); then
            echo "$val"
        else
            echo ""
        fi
    else
        # Fallback to grep/sed for Linux or if plutil is not available
        grep -A 1 "<key>$key</key>" "$plist_file" | grep "<string>" | sed 's/.*<string>\(.*\)<\/string>.*/\1/' | tr -d '\t '
    fi
}

# Main script starts here
print_header "SSmart POS Admin - Setup from GoogleService-Info.plist"

# Check if plist file path is provided
if [ -z "$1" ]; then
    print_error "No plist file provided"
    echo ""
    echo "Usage:"
    echo "  ./scripts/setup_from_plist.sh <path-to-GoogleService-Info.plist>"
    echo ""
    echo "Example:"
    echo "  ./scripts/setup_from_plist.sh ~/Downloads/GoogleService-Info.plist"
    echo ""
    exit 1
fi

PLIST_FILE="$1"

# Validate plist file exists
if [ ! -f "$PLIST_FILE" ]; then
    print_error "File not found: $PLIST_FILE"
    exit 1
fi

print_success "Found plist file: $PLIST_FILE"

# Validate it's a valid plist file
if ! grep -q "<?xml version=" "$PLIST_FILE" || ! grep -q "<plist version=" "$PLIST_FILE"; then
    print_error "Invalid plist file format"
    exit 1
fi

print_success "Plist file is valid"

# Extract values from plist
print_info "Extracting Firebase credentials from plist..."
echo ""

API_KEY=$(extract_plist_value "$PLIST_FILE" "API_KEY")
GCM_SENDER_ID=$(extract_plist_value "$PLIST_FILE" "GCM_SENDER_ID")
PROJECT_ID=$(extract_plist_value "$PLIST_FILE" "PROJECT_ID")
STORAGE_BUCKET=$(extract_plist_value "$PLIST_FILE" "STORAGE_BUCKET")
GOOGLE_APP_ID=$(extract_plist_value "$PLIST_FILE" "GOOGLE_APP_ID")
DATABASE_URL=$(extract_plist_value "$PLIST_FILE" "DATABASE_URL")
BUNDLE_ID=$(extract_plist_value "$PLIST_FILE" "BUNDLE_ID")

# Derive AUTH_DOMAIN from PROJECT_ID
AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com"

# MEASUREMENT_ID is optional (Analytics)
MEASUREMENT_ID=$(extract_plist_value "$PLIST_FILE" "MEASUREMENT_ID")
if [ -z "$MEASUREMENT_ID" ]; then
    MEASUREMENT_ID=""
    print_warning "MEASUREMENT_ID not found (Analytics not enabled)"
fi

# Validate required fields
MISSING_FIELDS=0

if [ -z "$API_KEY" ]; then
    print_error "Missing API_KEY in plist"
    MISSING_FIELDS=1
fi

if [ -z "$GCM_SENDER_ID" ]; then
    print_error "Missing GCM_SENDER_ID in plist"
    MISSING_FIELDS=1
fi

if [ -z "$PROJECT_ID" ]; then
    print_error "Missing PROJECT_ID in plist"
    MISSING_FIELDS=1
fi

if [ -z "$STORAGE_BUCKET" ]; then
    print_error "Missing STORAGE_BUCKET in plist"
    MISSING_FIELDS=1
fi

if [ -z "$GOOGLE_APP_ID" ]; then
    print_error "Missing GOOGLE_APP_ID in plist"
    MISSING_FIELDS=1
fi

if [ -z "$DATABASE_URL" ]; then
    print_error "Missing DATABASE_URL in plist"
    MISSING_FIELDS=1
fi

if [ $MISSING_FIELDS -eq 1 ]; then
    echo ""
    print_error "Some required fields are missing from the plist file"
    exit 1
fi

# Display extracted credentials
print_success "Successfully extracted all required credentials"
echo ""
print_info "Firebase Configuration:"
echo "  API_KEY: $API_KEY"
echo "  PROJECT_ID: $PROJECT_ID"
echo "  AUTH_DOMAIN: $AUTH_DOMAIN"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  STORAGE_BUCKET: $STORAGE_BUCKET"
echo "  MESSAGING_SENDER_ID: $GCM_SENDER_ID"
echo "  APP_ID: $GOOGLE_APP_ID"
echo "  MEASUREMENT_ID: $MEASUREMENT_ID"
echo "  BUNDLE_ID: $BUNDLE_ID"
echo ""

# Get the script's directory (should be in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Copy plist to ios/Runner/
print_info "Copying plist to ios/Runner/"
IOS_RUNNER_DIR="$PROJECT_ROOT/ios/Runner"

if [ ! -d "$IOS_RUNNER_DIR" ]; then
    print_error "iOS Runner directory not found: $IOS_RUNNER_DIR"
    exit 1
fi

cp "$PLIST_FILE" "$IOS_RUNNER_DIR/GoogleService-Info.plist"
print_success "Copied GoogleService-Info.plist to ios/Runner/"

# Create .env file
print_info "Creating .env file with Firebase credentials..."

cat > "$PROJECT_ROOT/.env" << EOF
# Firebase Configuration
# Auto-generated from GoogleService-Info.plist on $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

FIREBASE_API_KEY=$API_KEY
FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
FIREBASE_DATABASE_URL=$DATABASE_URL
FIREBASE_PROJECT_ID=$PROJECT_ID
FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID=$GCM_SENDER_ID
FIREBASE_APP_ID=$GOOGLE_APP_ID
FIREBASE_MEASUREMENT_ID=$MEASUREMENT_ID

# Note: MEASUREMENT_ID may be empty if Analytics is not enabled
# Bundle ID in plist: $BUNDLE_ID
# This may differ from your app's bundle ID (e.g., com.ssmartpos for admin app)
EOF

print_success "Created .env file with Firebase credentials"

# Bundle ID information
echo ""
print_info "Bundle ID Information:"
echo "  Plist Bundle ID: $BUNDLE_ID"
echo ""

if [ "$BUNDLE_ID" != "com.ssmartpos" ]; then
    print_warning "Note: The plist bundle ID ($BUNDLE_ID) differs from the admin app bundle ID"
    print_warning "The admin app uses: com.ssmartpos"
    echo ""
fi

# Validate configuration
print_info "Validating Firebase configuration..."
echo ""

if [ -f "$PROJECT_ROOT/scripts/validate_firebase.dart" ]; then
    if command -v dart &> /dev/null; then
        cd "$PROJECT_ROOT"
        if dart run scripts/validate_firebase.dart; then
            echo ""
            print_success "Firebase configuration validated successfully!"
        else
            echo ""
            print_warning "Configuration validation had warnings (see above)"
        fi
    else
        print_warning "Dart not found. Skipping validation."
        print_info "Install Flutter to validate configuration: https://flutter.dev"
    fi
else
    print_warning "Validation script not found. Skipping validation."
fi

# Summary
echo ""
print_header "Setup Complete!"

echo "What was configured:"
echo ""
print_success "GoogleService-Info.plist copied to ios/Runner/"
print_success ".env file created with Firebase credentials"
print_success "All required Firebase values extracted and configured"
echo ""

print_info "Files created/updated:"
echo "  - ios/Runner/GoogleService-Info.plist"
echo "  - .env"
echo ""

print_warning "Security Reminders:"
echo "  - The .env file is already in .gitignore"
echo "  - GoogleService-Info.plist should NOT be committed to Git"
echo "  - Keep these files secure and never share them publicly"
echo ""

print_info "Next Steps:"
echo ""
echo "1. Create a Firebase admin user (if not already done):"
echo "   - Go to Firebase Console > Authentication > Users > Add user"
echo ""
echo "2. Set up database rules:"
echo "   - Go to Firebase Console > Realtime Database > Rules"
echo "   - Ensure authenticated read/write access"
echo ""
echo "3. Run the app:"
echo "   cd $PROJECT_ROOT"
echo "   flutter pub get"
echo "   flutter run"
echo ""

print_success "Setup completed successfully!"
echo ""
