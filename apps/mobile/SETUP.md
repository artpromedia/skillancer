# Skillancer Mobile App Setup Guide

This guide will help you set up the Flutter mobile app for development and production.

## Prerequisites

- Flutter SDK 3.2.0 or higher
- Dart SDK 3.2.0 or higher
- Android Studio (for Android development)
- Xcode 15+ (for iOS development, macOS only)
- Firebase project

## Quick Start

1. Install dependencies:

```bash
flutter pub get
```

2. Run code generation:

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

3. Run the app:

```bash
flutter run
```

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Enable the following services:
   - Authentication
   - Cloud Firestore (or your preferred database)
   - Cloud Messaging (for push notifications)
   - Crashlytics
   - Analytics

### 2. Android Configuration

1. In Firebase Console, add an Android app with package name: `com.skillancer.mobile`
2. Download `google-services.json`
3. Place it in `android/app/google-services.json`
4. The file should NOT be committed to git (it's in .gitignore)

### 3. iOS Configuration

1. In Firebase Console, add an iOS app with bundle ID: `com.skillancer.mobile`
2. Download `GoogleService-Info.plist`
3. Place it in `ios/Runner/GoogleService-Info.plist`
4. The file should NOT be committed to git (it's in .gitignore)

## App Icons

Replace the placeholder app icons with your actual icons:

### Android

Add icons to the following directories:

- `android/app/src/main/res/mipmap-mdpi/` (48x48)
- `android/app/src/main/res/mipmap-hdpi/` (72x72)
- `android/app/src/main/res/mipmap-xhdpi/` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/` (192x192)

Files needed: `ic_launcher.png` and `ic_launcher_round.png`

### iOS

Add icons to `ios/Runner/Assets.xcassets/AppIcon.appiconset/`

See `Contents.json` in that directory for required sizes.

**Recommended tool:** Use [AppIcon.co](https://appicon.co) to generate all icon sizes from a single 1024x1024 image.

## Fonts

Download the Inter font family from [Google Fonts](https://fonts.google.com/specimen/Inter) and add to `assets/fonts/`:

- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Bold.ttf`

## Assets

Add your app images and icons to:

- `assets/images/` - PNG/JPG images
- `assets/icons/` - SVG icons

## Android Release Build

### 1. Create Keystore

```bash
keytool -genkey -v -keystore android/app/skillancer-release.keystore \
  -alias skillancer -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Create key.properties

Create `android/key.properties`:

```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=skillancer
storeFile=skillancer-release.keystore
```

### 3. Build Release APK

```bash
flutter build apk --release
```

### 4. Build App Bundle (for Play Store)

```bash
flutter build appbundle --release
```

## iOS Release Build

### 1. Open in Xcode

```bash
open ios/Runner.xcworkspace
```

### 2. Configure Signing

1. Select the Runner target
2. Go to "Signing & Capabilities"
3. Select your development team
4. Configure bundle identifier: `com.skillancer.mobile`

### 3. Archive for Distribution

1. Select "Any iOS Device" as the target
2. Product > Archive
3. Distribute App > App Store Connect

## Running Tests

```bash
# Unit tests
flutter test

# Integration tests
flutter test integration_test
```

## Troubleshooting

### Pod install fails on iOS

```bash
cd ios
pod deintegrate
pod install --repo-update
```

### Build fails after updating dependencies

```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

### Firebase initialization error

Ensure `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) is properly placed and the package/bundle ID matches your Firebase configuration.

## Environment Variables

For different environments (dev/staging/prod), consider using:

- [flutter_dotenv](https://pub.dev/packages/flutter_dotenv)
- Flavor configurations

## CI/CD

For automated builds, use:

- **GitHub Actions** with [flutter-action](https://github.com/subosito/flutter-action)
- **Codemagic** for Flutter-specific CI/CD
- **Fastlane** for iOS/Android deployment automation
