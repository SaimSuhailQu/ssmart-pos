// Firebase Configuration Validator
// Validates .env file and Firebase configuration

import 'dart:io';

// ANSI color codes
const String green = '\x1B[32m';
const String red = '\x1B[31m';
const String yellow = '\x1B[33m';
const String blue = '\x1B[34m';
const String reset = '\x1B[0m';

void main() async {
  print('');
  print('$blue━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$reset');
  print('${blue}Firebase Configuration Validator$reset');
  print('$blue━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$reset');
  print('');

  var hasErrors = false;
  var hasWarnings = false;

  // Check if .env file exists
  final envFile = File('.env');
  if (!await envFile.exists()) {
    printError('.env file not found!');
    print('');
    print('${yellow}Create it from template:$reset');
    print('  cp .env.example .env');
    print('');
    print('Then edit it with your Firebase credentials.');
    print('See ENV_SETUP.md for detailed instructions.');
    exit(1);
  }

  printSuccess('.env file found');

  // Read .env file
  final envContent = await envFile.readAsString();
  final envLines = envContent.split('\n');
  final config = <String, String>{};

  // Parse .env file
  for (var line in envLines) {
    line = line.trim();
    if (line.isEmpty || line.startsWith('#')) continue;

    final parts = line.split('=');
    if (parts.length >= 2) {
      final key = parts[0].trim();
      final value = parts.sublist(1).join('=').trim();
      config[key] = value;
    }
  }

  print('');
  print('${blue}Checking required configuration keys...$reset');
  print('');

  // Required keys
  final requiredKeys = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_MEASUREMENT_ID',
  ];

  // Check each required key
  for (var key in requiredKeys) {
    if (!config.containsKey(key)) {
      printError('$key is missing');
      hasErrors = true;
      continue;
    }

    final value = config[key]!;

    // Check for placeholder values
    if (value.contains('your_') ||
        value.contains('here') ||
        value.isEmpty ||
        value == 'null') {
      printError('$key has placeholder value: "$value"');
      hasErrors = true;
      continue;
    }

    // Validate format of specific keys
    var isValid = true;
    var formatIssue = '';

    switch (key) {
      case 'FIREBASE_API_KEY':
        if (!value.startsWith('AIza') || value.length < 30) {
          isValid = false;
          formatIssue = 'Should start with "AIza" and be at least 30 characters';
        }
        break;

      case 'FIREBASE_AUTH_DOMAIN':
        if (!value.endsWith('.firebaseapp.com')) {
          isValid = false;
          formatIssue = 'Should end with ".firebaseapp.com"';
        }
        break;

      case 'FIREBASE_DATABASE_URL':
        if (!value.startsWith('https://') || !value.contains('firebaseio.com')) {
          isValid = false;
          formatIssue = 'Should be "https://yourproject-default-rtdb.firebaseio.com"';
        }
        break;

      case 'FIREBASE_STORAGE_BUCKET':
        if (!value.endsWith('.appspot.com')) {
          isValid = false;
          formatIssue = 'Should end with ".appspot.com"';
        }
        break;

      case 'FIREBASE_MESSAGING_SENDER_ID':
        if (!RegExp(r'^\d{12}$').hasMatch(value)) {
          isValid = false;
          formatIssue = 'Should be a 12-digit number';
        }
        break;

      case 'FIREBASE_APP_ID':
        if (!value.contains(':') || !value.contains('ios')) {
          hasWarnings = true;
          printWarning('$key format may be incorrect (should contain "ios" for iOS app)');
          continue;
        }
        break;

      case 'FIREBASE_MEASUREMENT_ID':
        if (!value.startsWith('G-')) {
          hasWarnings = true;
          printWarning('$key should start with "G-" (optional if Analytics not enabled)');
          continue;
        }
        break;
    }

    if (!isValid) {
      printError('$key format invalid: $formatIssue');
      hasErrors = true;
    } else {
      printSuccess('$key ✓');
    }
  }

  // Summary
  print('');
  print('$blue━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$reset');

  if (hasErrors) {
    print('');
    printError('Configuration validation FAILED!');
    print('');
    print('  Please fix the errors above and try again.');
    print('');
    print('${yellow}Need help?$reset See ENV_SETUP.md for detailed instructions:');
    print('  • How to get Firebase credentials');
    print('  • Where to find each value');
    print('  • Common troubleshooting steps');
    print('');
    exit(1);
  } else if (hasWarnings) {
    print('');
    printWarning('Configuration validation passed with warnings.');
    print('');
    print('Your configuration should work, but you may want to check the warnings above.');
    print('');
  } else {
    print('');
    printSuccess('Configuration validation PASSED!');
    print('');
    print('Your Firebase configuration looks good! ✓');
    print('');
  }

  print('${blue}Next steps:$reset');
  print('  1. Run the app: ${yellow}flutter run$reset');
  print('  2. Log in with your Firebase admin credentials');
  print('  3. Check for "Online" status in the app bar');
  print('');

  exit(0);
}

void printSuccess(String message) {
  print('$green✓$reset $message');
}

void printError(String message) {
  print('$red✗$reset $message');
}

void printWarning(String message) {
  print('$yellow⚠$reset $message');
}
