# Skillancer Mobile App

The Skillancer mobile application built with Flutter, providing a seamless freelancing experience for iOS and Android users.

## 🚀 Features

### Core Features

- **Authentication**: Email/password, social login (Google, Apple, GitHub), biometric authentication
- **Jobs**: Browse, search, filter, and save jobs with SmartMatch recommendations
- **Proposals**: Submit proposals with milestones, track status, manage bids
- **Time Tracking**: Built-in timer, weekly summaries, offline support
- **Contracts**: View active/completed contracts, milestone progress, payments
- **Messages**: Real-time chat with clients, file attachments, read receipts
- **Profile**: Edit profile, skills, portfolio, verification status
- **Notifications**: Push notifications for proposals, messages, payments

### Technical Highlights

- **Offline-First**: Hive-based local caching for jobs, proposals, contracts
- **State Management**: Riverpod with StateNotifier pattern
- **Navigation**: go_router with deep linking and auth guards
- **Networking**: Dio with interceptors for auth, retry, and error handling
- **Security**: Secure token storage, biometric authentication
- **Push Notifications**: Firebase Cloud Messaging integration

## 📁 Project Structure

```
lib/
├── main.dart                    # App entry point
├── app.dart                     # Root MaterialApp configuration
├── core/
│   ├── theme/                   # App theming
│   │   └── app_theme.dart       # Colors, typography, spacing
│   ├── navigation/              # Routing
│   │   ├── app_router.dart      # GoRouter configuration
│   │   └── shell_screen.dart    # Bottom navigation shell
│   ├── network/                 # API layer
│   │   └── api_client.dart      # Dio client with interceptors
│   ├── storage/                 # Local storage
│   │   ├── secure_storage.dart  # Encrypted token storage
│   │   └── local_cache.dart     # Hive-based caching
│   ├── connectivity/            # Network monitoring
│   │   └── connectivity_service.dart
│   ├── services/                # Core services
│   │   └── crash_reporting_service.dart
│   └── providers/               # Riverpod providers
│       └── providers.dart
├── features/
│   ├── auth/                    # Login, Signup, AuthService
│   ├── jobs/                    # JobsScreen, JobDetailScreen
│   ├── proposals/               # MyProposals, SubmitProposal
│   ├── time_tracking/           # TimeTrackingScreen, FloatingTimer
│   ├── contracts/               # ContractsScreen
│   ├── messages/                # MessagesScreen, ChatScreen
│   ├── profile/                 # ProfileScreen
│   └── notifications/           # NotificationsScreen, PushService
```

## 🛠 Getting Started

### Prerequisites

- Flutter SDK 3.2.0+
- Dart SDK 3.2.0+
- Android Studio / Xcode
- Firebase project (for push notifications)

### Installation

```bash
# Install dependencies
flutter pub get

# Configure Firebase (add google-services.json and GoogleService-Info.plist)

# Run the app
flutter run
```

## 📱 Screens

| Screen        | Route        | Description                     |
| ------------- | ------------ | ------------------------------- |
| Login         | `/login`     | Email/password and social login |
| Jobs          | `/jobs`      | Browse and search jobs          |
| Proposals     | `/proposals` | My submitted proposals          |
| Time Tracking | `/time`      | Timer and time entries          |
| Contracts     | `/contracts` | Active and completed contracts  |
| Messages      | `/messages`  | Conversations list              |
| Profile       | `/profile`   | User profile and settings       |

## 🎨 Design System

- **Primary**: `#6366F1` (Indigo)
- **Accent**: `#EC4899` (Pink)
- **Success**: `#10B981`
- **Warning**: `#F59E0B`
- **Error**: `#EF4444`

## 📦 Key Dependencies

| Package                  | Purpose            |
| ------------------------ | ------------------ |
| `flutter_riverpod`       | State management   |
| `go_router`              | Navigation         |
| `dio`                    | HTTP client        |
| `hive_flutter`           | Local storage      |
| `flutter_secure_storage` | Secure storage     |
| `firebase_messaging`     | Push notifications |
| `local_auth`             | Biometrics         |

## 🧪 Testing

```bash
flutter test
flutter test --coverage
```

## 🚀 Building

```bash
flutter build apk --release
flutter build ios --release
```

- Offline support
- Biometric authentication
