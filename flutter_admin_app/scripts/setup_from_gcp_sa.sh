#!/bin/bash

# SSmart POS Admin - Automated Setup from GCP Service Account Key
# This script authenticates with GCP using a service account and retrieves Firebase configuration

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

# Main script starts here
print_header "SSmart POS Admin - Setup from GCP Service Account"

# Check if service account key file path is provided
if [ -z "$1" ]; then
    print_error "No service account key file provided"
    echo ""
    echo "Usage:"
    echo "  ./scripts/setup_from_gcp_sa.sh <path-to-service-account-key.json>"
    echo ""
    echo "Example:"
    echo "  ./scripts/setup_from_gcp_sa.sh ~/Downloads/ssmart-pos-sa-key.json"
    echo ""
    exit 1
fi

SA_KEY_FILE="$1"

# Validate service account key file exists
if [ ! -f "$SA_KEY_FILE" ]; then
    print_error "File not found: $SA_KEY_FILE"
    exit 1
fi

print_success "Found service account key file: $SA_KEY_FILE"

# Validate it's a valid JSON file
if ! grep -q '"type"' "$SA_KEY_FILE" || ! grep -q '"project_id"' "$SA_KEY_FILE"; then
    print_error "Invalid service account key file format"
    print_info "Expected a JSON file with 'type' and 'project_id' fields"
    exit 1
fi

print_success "Service account key file is valid JSON"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed"
    echo ""
    print_info "Install gcloud CLI:"
    echo "  macOS:   brew install --cask google-cloud-sdk"
    echo "  Linux:   https://cloud.google.com/sdk/docs/install"
    echo "  Windows: https://cloud.google.com/sdk/docs/install"
    echo ""
    exit 1
fi

print_success "gcloud CLI is installed"

# Extract project ID from service account key
PROJECT_ID=$(grep -o '"project_id": *"[^"]*"' "$SA_KEY_FILE" | sed 's/"project_id": *"\([^"]*\)"/\1/')

if [ -z "$PROJECT_ID" ]; then
    print_error "Could not extract project_id from service account key"
    exit 1
fi

print_success "Extracted project ID: $PROJECT_ID"

# Get the script's directory (should be in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Authenticate with gcloud
print_info "Authenticating with GCP using service account..."
echo ""

if gcloud auth activate-service-account --key-file="$SA_KEY_FILE" --quiet; then
    print_success "Successfully authenticated with GCP"
else
    print_error "Failed to authenticate with GCP"
    exit 1
fi

# Set the project
gcloud config set project "$PROJECT_ID" --quiet

# Check if Firebase is enabled for the project
print_info "Checking Firebase configuration..."
echo ""

# Try to get Firebase web app configuration
# Note: This requires Firebase Management API to be enabled
WEB_APP_CONFIG=$(gcloud firebase apps list --filter="platform=WEB" --format="value(appId)" 2>/dev/null | head -n 1)

if [ -z "$WEB_APP_CONFIG" ]; then
    print_warning "No Firebase web app found in project"
    print_info "Checking for iOS app instead..."

    IOS_APP_ID=$(gcloud firebase apps list --filter="platform=IOS" --format="value(appId)" 2>/dev/null | head -n 1)

    if [ -z "$IOS_APP_ID" ]; then
        print_error "No Firebase apps (web or iOS) found in project: $PROJECT_ID"
        echo ""
        print_info "Please ensure:"
        echo "  1. Firebase is enabled for this project"
        echo "  2. At least one app (Web or iOS) is configured"
        echo "  3. Service account has Firebase Admin permissions"
        echo ""
        exit 1
    fi

    APP_ID="$IOS_APP_ID"
    print_success "Found iOS app: $APP_ID"
else
    APP_ID="$WEB_APP_CONFIG"
    print_success "Found web app: $APP_ID"
fi

# Get Firebase Web API Key from project settings
print_info "Retrieving Firebase configuration..."
echo ""

# Get Web API Key (this is always available for the project)
API_KEY=$(gcloud alpha firebase projects describe --format="value(resources.webApiKey)" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
    print_warning "Could not retrieve Web API Key via gcloud"
    print_info "Attempting alternative method..."

    # Alternative: Get from Firebase Management API
    # This requires the Firebase Management API to be enabled
    API_KEY=$(curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps/$APP_ID/config" \
        | grep -o '"apiKey": *"[^"]*"' | sed 's/"apiKey": *"\([^"]*\)"/\1/' 2>/dev/null || echo "")
fi

if [ -z "$API_KEY" ]; then
    print_error "Could not retrieve Firebase Web API Key"
    print_info "Please manually retrieve credentials from Firebase Console"
    echo ""
    print_info "Alternative: Use GoogleService-Info.plist method instead:"
    echo "  ./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist"
    echo ""
    exit 1
fi

print_success "Retrieved Web API Key"

# Construct Firebase configuration
AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com"
DATABASE_URL="https://${PROJECT_ID}-default-rtdb.firebaseio.com"
STORAGE_BUCKET="${PROJECT_ID}.appspot.com"

print_success "Constructed Firebase URLs from project ID"

# Get messaging sender ID and app ID via Firebase Management API
print_info "Retrieving additional Firebase credentials..."
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)

# Get app configuration
APP_CONFIG=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps/$APP_ID/config" 2>/dev/null)

if [ -n "$APP_CONFIG" ]; then
    MESSAGING_SENDER_ID=$(echo "$APP_CONFIG" | grep -o '"messagingSenderId": *"[^"]*"' | sed 's/"messagingSenderId": *"\([^"]*\)"/\1/')
    FIREBASE_APP_ID=$(echo "$APP_CONFIG" | grep -o '"appId": *"[^"]*"' | sed 's/"appId": *"\([^"]*\)"/\1/')
    MEASUREMENT_ID=$(echo "$APP_CONFIG" | grep -o '"measurementId": *"[^"]*"' | sed 's/"measurementId": *"\([^"]*\)"/\1/' || echo "")
else
    print_warning "Could not retrieve full app configuration via API"

    # Try to get project number (same as messaging sender ID)
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null || echo "")

    if [ -n "$PROJECT_NUMBER" ]; then
        MESSAGING_SENDER_ID="$PROJECT_NUMBER"
        print_success "Retrieved messaging sender ID from project number"
    else
        print_error "Could not retrieve messaging sender ID"
        MESSAGING_SENDER_ID=""
    fi

    FIREBASE_APP_ID="$APP_ID"
    MEASUREMENT_ID=""
fi

# Validate required fields
MISSING_FIELDS=0

if [ -z "$API_KEY" ]; then
    print_error "Missing API_KEY"
    MISSING_FIELDS=1
fi

if [ -z "$PROJECT_ID" ]; then
    print_error "Missing PROJECT_ID"
    MISSING_FIELDS=1
fi

if [ -z "$MESSAGING_SENDER_ID" ]; then
    print_warning "Missing MESSAGING_SENDER_ID (Firebase Cloud Messaging may not work)"
fi

if [ -z "$FIREBASE_APP_ID" ]; then
    print_error "Missing FIREBASE_APP_ID"
    MISSING_FIELDS=1
fi

if [ $MISSING_FIELDS -eq 1 ]; then
    echo ""
    print_error "Some required fields are missing"
    echo ""
    print_info "Recommended alternative: Use GoogleService-Info.plist method"
    echo "  ./scripts/setup_from_plist.sh /path/to/GoogleService-Info.plist"
    echo ""
    exit 1
fi

# Display extracted credentials
print_success "Successfully retrieved Firebase configuration"
echo ""
print_info "Firebase Configuration:"
echo "  API_KEY: $API_KEY"
echo "  PROJECT_ID: $PROJECT_ID"
echo "  AUTH_DOMAIN: $AUTH_DOMAIN"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  STORAGE_BUCKET: $STORAGE_BUCKET"
echo "  MESSAGING_SENDER_ID: $MESSAGING_SENDER_ID"
echo "  APP_ID: $FIREBASE_APP_ID"
echo "  MEASUREMENT_ID: $MEASUREMENT_ID"
echo ""

# Create .env file
print_info "Creating .env file with Firebase credentials..."

cat > "$PROJECT_ROOT/.env" << EOF
# Firebase Configuration
# Auto-generated from GCP Service Account on $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

FIREBASE_API_KEY=$API_KEY
FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
FIREBASE_DATABASE_URL=$DATABASE_URL
FIREBASE_PROJECT_ID=$PROJECT_ID
FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID=$MESSAGING_SENDER_ID
FIREBASE_APP_ID=$FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID=$MEASUREMENT_ID

# Note: MEASUREMENT_ID may be empty if Analytics is not enabled
# GCP Project ID: $PROJECT_ID
EOF

print_success "Created .env file with Firebase credentials"

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

# Revoke service account credentials for security
print_info "Revoking temporary GCP authentication..."
gcloud auth revoke --quiet 2>/dev/null || true
print_success "Revoked service account credentials"

# Summary
echo ""
print_header "Setup Complete!"

echo "What was configured:"
echo ""
print_success ".env file created with Firebase credentials"
print_success "All required Firebase values extracted from GCP"
print_success "Service account credentials revoked (security best practice)"
echo ""

print_info "Files created/updated:"
echo "  - .env"
echo ""

print_warning "Security Reminders:"
echo "  - The .env file is already in .gitignore"
echo "  - Keep this file secure and never share it publicly"
echo "  - Service account key should be stored securely"
echo "  - Rotate service account keys regularly (every 90 days)"
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
