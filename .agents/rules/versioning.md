# Mobile & Desktop Version Alignment Rule

Whenever updating or bumping the desktop application version in `package.json`, always update the mobile app version as well in both:
1. `flutter_admin_app/pubspec.yaml`
2. `flutter_admin_app_iphone7/pubspec.yaml`

Ensure both the semver string and the build number (e.g. `version: 1.0.x+N`) are bumped together so mobile and desktop releases remain consistent.
