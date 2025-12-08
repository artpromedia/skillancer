# Skillancer Mobile App

Cross-platform mobile application built with Flutter.

## Tech Stack

- **Framework**: Flutter
- **Language**: Dart
- **State Management**: Riverpod / Bloc

## Prerequisites

- Flutter SDK >= 3.16.0
- Dart >= 3.2.0
- Android Studio / Xcode

## Getting Started

```bash
# Install dependencies
flutter pub get

# Run on device/emulator
flutter run

# Build for production
flutter build apk --release
flutter build ios --release
```

## Structure

```
mobile/
├── lib/
│   ├── main.dart
│   ├── app/
│   ├── features/
│   ├── shared/
│   └── core/
├── test/
├── android/
├── ios/
└── pubspec.yaml
```

## Features

- Authentication
- Push notifications
- Offline support
- Biometric authentication
