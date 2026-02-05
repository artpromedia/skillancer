import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/mfa_setup_screen.dart';
import '../../features/auth/presentation/screens/mfa_verify_screen.dart';
import '../../features/auth/presentation/screens/signup_screen.dart';
import '../../features/auth/presentation/screens/verify_email_screen.dart';
import '../../features/contracts/presentation/screens/contract_detail_screen.dart';
import '../../features/contracts/presentation/screens/contracts_screen.dart';
import '../../features/contracts/presentation/screens/milestone_screen.dart';
import '../../features/contracts/presentation/screens/submit_work_screen.dart';
import '../../features/executive/executive.dart';
import '../../features/jobs/presentation/screens/job_detail_screen.dart';
import '../../features/jobs/presentation/screens/job_filters_screen.dart';
import '../../features/jobs/presentation/screens/jobs_screen.dart';
import '../../features/messages/presentation/screens/chat_screen.dart';
import '../../features/messages/presentation/screens/conversations_screen.dart';
import '../../features/messages/presentation/screens/new_message_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/profile/presentation/screens/edit_profile_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/settings_screen.dart';
import '../../features/proposals/presentation/screens/my_proposals_screen.dart';
import '../../features/proposals/presentation/screens/proposal_detail_screen.dart';
import '../../features/proposals/presentation/screens/submit_proposal_screen.dart';
import '../../features/time_tracking/presentation/screens/add_time_entry_screen.dart';
import '../../features/time_tracking/presentation/screens/time_tracking_screen.dart';
import '../providers/providers.dart';
import 'shell_screen.dart';

/// Route names for type-safe navigation
class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String signup = '/signup';
  static const String forgotPassword = '/forgot-password';
  static const String verifyEmail = '/verify-email';
  static const String mfaVerify = '/mfa-verify';
  static const String mfaSetup = '/mfa-setup';

  // Main tabs
  static const String jobs = '/jobs';
  static const String proposals = '/proposals';
  static const String time = '/time';
  static const String messages = '/messages';
  static const String profile = '/profile';

  // Sub-routes
  static const String jobDetail = '/jobs/:jobId';
  static const String jobFilters = '/jobs/filters';
  static const String submitProposal = '/jobs/:jobId/apply';
  static const String proposalDetail = '/proposals/:proposalId';
  static const String contracts = '/contracts';
  static const String contractDetail = '/contracts/:contractId';
  static const String milestones = '/contracts/:contractId/milestones';
  static const String submitWork = '/contracts/:contractId/milestones/:milestoneId/submit';
  static const String addTimeEntry = '/time/add';
  static const String chat = '/messages/:conversationId';
  static const String newMessage = '/messages/new';
  static const String editProfile = '/profile/edit';
  static const String notifications = '/notifications';
  static const String settings = '/settings';

  // Executive Suite routes
  static const String executive = '/executive';
  static const String executiveProfile = '/executive/profile';
  static const String executiveBrowse = '/executive/browse';
  static const String executiveEngagement = '/executive/engagement/:engagementId';
  static const String executiveView = '/executive/view/:profileId';
}

/// Router provider
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: AppRoutes.jobs,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isAuthRoute = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.signup ||
          state.matchedLocation == AppRoutes.forgotPassword ||
          state.matchedLocation == AppRoutes.verifyEmail ||
          state.matchedLocation == AppRoutes.mfaVerify;

      // Redirect to login if not authenticated and not on auth route
      if (!isAuthenticated && !isAuthRoute) {
        return AppRoutes.login;
      }

      // Redirect to jobs if authenticated and on auth route
      if (isAuthenticated && isAuthRoute) {
        return AppRoutes.jobs;
      }

      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.signup,
        name: 'signup',
        builder: (context, state) => const SignupScreen(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.verifyEmail,
        name: 'verifyEmail',
        builder: (context, state) {
          final email = state.uri.queryParameters['email'] ?? '';
          return VerifyEmailScreen(email: email);
        },
      ),
      GoRoute(
        path: AppRoutes.mfaVerify,
        name: 'mfaVerify',
        builder: (context, state) {
          final sessionToken = state.uri.queryParameters['sessionToken'];
          return MfaVerifyScreen(sessionToken: sessionToken);
        },
      ),
      GoRoute(
        path: AppRoutes.mfaSetup,
        name: 'mfaSetup',
        builder: (context, state) => const MfaSetupScreen(),
      ),

      // Main shell with bottom navigation
      ShellRoute(
        builder: (context, state, child) => ShellScreen(child: child),
        routes: [
          // Jobs tab
          GoRoute(
            path: AppRoutes.jobs,
            name: 'jobs',
            builder: (context, state) => const JobsScreen(),
            routes: [
              GoRoute(
                path: 'filters',
                name: 'jobFilters',
                pageBuilder: (context, state) => BottomSheetPage(
                  child: const JobFiltersScreen(),
                ),
              ),
              GoRoute(
                path: ':jobId',
                name: 'jobDetail',
                builder: (context, state) {
                  final jobId = state.pathParameters['jobId']!;
                  return JobDetailScreen(jobId: jobId);
                },
                routes: [
                  GoRoute(
                    path: 'apply',
                    name: 'submitProposal',
                    builder: (context, state) {
                      final jobId = state.pathParameters['jobId']!;
                      return SubmitProposalScreen(jobId: jobId);
                    },
                  ),
                ],
              ),
            ],
          ),

          // Proposals tab
          GoRoute(
            path: AppRoutes.proposals,
            name: 'proposals',
            builder: (context, state) => const MyProposalsScreen(),
            routes: [
              GoRoute(
                path: ':proposalId',
                name: 'proposalDetail',
                builder: (context, state) {
                  final proposalId = state.pathParameters['proposalId']!;
                  return ProposalDetailScreen(proposalId: proposalId);
                },
              ),
            ],
          ),

          // Time tracking tab
          GoRoute(
            path: AppRoutes.time,
            name: 'time',
            builder: (context, state) => const TimeTrackingScreen(),
            routes: [
              GoRoute(
                path: 'add',
                name: 'addTimeEntry',
                builder: (context, state) => const AddTimeEntryScreen(),
              ),
            ],
          ),

          // Messages tab
          GoRoute(
            path: AppRoutes.messages,
            name: 'messages',
            builder: (context, state) => const ConversationsScreen(),
            routes: [
              GoRoute(
                path: 'new',
                name: 'newMessage',
                builder: (context, state) => const NewMessageScreen(),
              ),
              GoRoute(
                path: ':conversationId',
                name: 'chat',
                builder: (context, state) {
                  final conversationId =
                      state.pathParameters['conversationId']!;
                  return ChatScreen(conversationId: conversationId);
                },
              ),
            ],
          ),

          // Profile tab
          GoRoute(
            path: AppRoutes.profile,
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
            routes: [
              GoRoute(
                path: 'edit',
                name: 'editProfile',
                builder: (context, state) => const EditProfileScreen(),
              ),
            ],
          ),
        ],
      ),

      // Contracts (accessible from multiple places)
      GoRoute(
        path: AppRoutes.contracts,
        name: 'contracts',
        builder: (context, state) => const ContractsScreen(),
        routes: [
          GoRoute(
            path: ':contractId',
            name: 'contractDetail',
            builder: (context, state) {
              final contractId = state.pathParameters['contractId']!;
              return ContractDetailScreen(contractId: contractId);
            },
            routes: [
              GoRoute(
                path: 'milestones',
                name: 'milestones',
                builder: (context, state) {
                  final contractId = state.pathParameters['contractId']!;
                  return MilestoneScreen(contractId: contractId);
                },
                routes: [
                  GoRoute(
                    path: ':milestoneId/submit',
                    name: 'submitWork',
                    builder: (context, state) {
                      final contractId = state.pathParameters['contractId']!;
                      final milestoneId = state.pathParameters['milestoneId']!;
                      return SubmitWorkScreen(
                        contractId: contractId,
                        milestoneId: milestoneId,
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),

      // Settings
      GoRoute(
        path: AppRoutes.settings,
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
      ),

      // Notifications
      GoRoute(
        path: AppRoutes.notifications,
        name: 'notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),

      // Executive Suite routes
      GoRoute(
        path: AppRoutes.executive,
        name: 'executive',
        builder: (context, state) => const ExecutiveDashboardScreen(),
        routes: [
          GoRoute(
            path: 'profile',
            name: 'executiveProfile',
            builder: (context, state) => const ExecutiveProfileScreen(),
          ),
          GoRoute(
            path: 'browse',
            name: 'executiveBrowse',
            builder: (context, state) => const ExecutiveMarketplaceScreen(),
          ),
          GoRoute(
            path: 'view/:profileId',
            name: 'executiveView',
            builder: (context, state) {
              final profileId = state.pathParameters['profileId']!;
              return ExecutiveProfileScreen(profileId: profileId);
            },
          ),
          GoRoute(
            path: 'engagement/:engagementId',
            name: 'executiveEngagement',
            builder: (context, state) {
              final engagementId = state.pathParameters['engagementId']!;
              return EngagementDetailScreen(engagementId: engagementId);
            },
          ),
          GoRoute(
            path: 'engagements',
            name: 'executiveEngagements',
            builder: (context, state) => const ExecutiveDashboardScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(state.matchedLocation),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go(AppRoutes.jobs),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
});

/// Custom page for bottom sheets
class BottomSheetPage<T> extends Page<T> {
  final Widget child;

  const BottomSheetPage({required this.child});

  @override
  Route<T> createRoute(BuildContext context) {
    return ModalBottomSheetRoute<T>(
      settings: this,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => child,
      ),
    );
  }
}
