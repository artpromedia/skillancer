import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../widgets/empty_state.dart';
import '../../../../widgets/loading_indicator.dart';
import '../../../../widgets/user_avatar.dart';
import '../../../auth/domain/models/user.dart';

/// Search result user with optional job context
class _SearchUser {
  final String id;
  final String firstName;
  final String lastName;
  final String? avatarUrl;
  final UserRole role;
  final String? title;
  final String? jobContext;

  const _SearchUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.avatarUrl,
    required this.role,
    this.title,
    this.jobContext,
  });

  String get fullName => '$firstName $lastName';

  factory _SearchUser.fromJson(Map<String, dynamic> json) {
    return _SearchUser(
      id: json['id'] as String,
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      role: UserRole.values.firstWhere(
        (r) => r.name == json['role'],
        orElse: () => UserRole.freelancer,
      ),
      title: json['title'] as String?,
      jobContext: json['jobContext'] as String? ?? json['jobTitle'] as String?,
    );
  }
}

/// Screen for starting a new conversation.
///
/// Provides a search bar to find users by name, a recent contacts section
/// showing people the user has previously worked with, and search results
/// with user details. Tapping a user navigates to the chat screen, creating
/// a new conversation if one does not already exist.
class NewMessageScreen extends ConsumerStatefulWidget {
  const NewMessageScreen({super.key});

  @override
  ConsumerState<NewMessageScreen> createState() => _NewMessageScreenState();
}

class _NewMessageScreenState extends ConsumerState<NewMessageScreen> {
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();

  Timer? _debounce;
  List<_SearchUser> _searchResults = [];
  List<_SearchUser> _recentContacts = [];
  bool _isSearching = false;
  bool _isLoadingRecents = true;
  bool _isNavigating = false;
  String? _searchError;
  String? _recentsError;
  String _lastQuery = '';

  @override
  void initState() {
    super.initState();
    _loadRecentContacts();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  /// Loads recent contacts from conversations the user has participated in.
  Future<void> _loadRecentContacts() async {
    setState(() {
      _isLoadingRecents = true;
      _recentsError = null;
    });

    try {
      final messagesRepo = ref.read(messagesRepositoryProvider);
      final result = await messagesRepo.getConversations(limit: 20);

      if (!mounted) return;

      final contacts = result.conversations
          .map((c) => _SearchUser(
                id: c.participantId,
                firstName: c.participantName.split(' ').first,
                lastName: c.participantName.split(' ').length > 1
                    ? c.participantName.split(' ').sublist(1).join(' ')
                    : '',
                avatarUrl: c.participantAvatarUrl,
                role: UserRole.freelancer, // Default; API doesn't expose this on conversations
                jobContext: c.jobTitle,
              ))
          .toList();

      setState(() {
        _recentContacts = contacts;
        _isLoadingRecents = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoadingRecents = false;
        _recentsError = 'Could not load recent contacts';
      });
    }
  }

  /// Debounced search handler. Waits 400ms after the user stops typing before
  /// issuing the API request.
  void _onSearchChanged(String query) {
    _debounce?.cancel();

    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
        _searchError = null;
        _lastQuery = '';
      });
      return;
    }

    if (trimmed == _lastQuery) return;

    setState(() => _isSearching = true);

    _debounce = Timer(const Duration(milliseconds: 400), () {
      _performSearch(trimmed);
    });
  }

  /// Calls GET /users/search?q={query} and parses the response.
  Future<void> _performSearch(String query) async {
    if (!mounted) return;

    setState(() {
      _isSearching = true;
      _searchError = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.get(
        '/users/search',
        queryParameters: {'q': query},
      );

      if (!mounted) return;

      final data = response.data as Map<String, dynamic>;
      final usersJson = data['data'] as List? ?? [];

      final currentUser = ref.read(currentUserProvider);
      final users = usersJson
          .map((u) => _SearchUser.fromJson(u as Map<String, dynamic>))
          .where((u) => u.id != currentUser?.id) // Exclude self
          .toList();

      setState(() {
        _searchResults = users;
        _isSearching = false;
        _lastQuery = query;
      });
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _isSearching = false;
        _searchError = e.message;
        _lastQuery = query;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSearching = false;
        _searchError = 'Search failed. Please try again.';
        _lastQuery = query;
      });
    }
  }

  /// Handles tapping on a user. Gets or creates a conversation, then navigates
  /// to the chat screen.
  Future<void> _onUserTap(_SearchUser user) async {
    if (_isNavigating) return;

    setState(() => _isNavigating = true);

    try {
      final messagesRepo = ref.read(messagesRepositoryProvider);
      final conversation =
          await messagesRepo.getOrCreateDirectConversation(user.id);

      if (!mounted) return;

      // Invalidate conversations list so the new conversation appears
      ref.invalidate(conversationsProvider);

      context.push('/messages/${conversation.id}');
    } on ApiError catch (e) {
      if (!mounted) return;
      _showErrorSnackBar(e.message);
    } catch (e) {
      if (!mounted) return;
      _showErrorSnackBar('Could not start conversation. Please try again.');
    } finally {
      if (mounted) {
        setState(() => _isNavigating = false);
      }
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Dismiss',
          textColor: Colors.white,
          onPressed: () =>
              ScaffoldMessenger.of(context).hideCurrentSnackBar(),
        ),
      ),
    );
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _searchResults = [];
      _isSearching = false;
      _searchError = null;
      _lastQuery = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasSearchQuery = _searchController.text.trim().isNotEmpty;

    return Stack(
      children: [
        Scaffold(
          appBar: AppBar(
            title: const Text('New Message'),
          ),
          body: Column(
            children: [
              // Search bar
              _SearchBar(
                controller: _searchController,
                focusNode: _searchFocusNode,
                onChanged: _onSearchChanged,
                onClear: _clearSearch,
                hasText: hasSearchQuery,
              ),

              // Content
              Expanded(
                child: hasSearchQuery
                    ? _buildSearchContent()
                    : _buildRecentContacts(),
              ),
            ],
          ),
        ),

        // Full-screen loading overlay when navigating to a conversation
        if (_isNavigating)
          LoadingIndicator.overlay(
            message: 'Starting conversation...',
          ),
      ],
    );
  }

  /// Builds the search results area, handling loading, error, and empty states.
  Widget _buildSearchContent() {
    if (_isSearching) {
      return const LoadingIndicator(message: 'Searching users...');
    }

    if (_searchError != null) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Search failed',
        subtitle: _searchError,
        actionLabel: 'Retry',
        onAction: () => _performSearch(_searchController.text.trim()),
      );
    }

    if (_searchResults.isEmpty && _lastQuery.isNotEmpty) {
      return EmptyState.noResults(
        subtitle:
            'No users found for "$_lastQuery". Try a different name.',
      );
    }

    return _UserList(
      users: _searchResults,
      onUserTap: _onUserTap,
      header: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        child: Text(
          '${_searchResults.length} result${_searchResults.length == 1 ? '' : 's'}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }

  /// Builds the recent contacts section shown when no search query is active.
  Widget _buildRecentContacts() {
    if (_isLoadingRecents) {
      return const LoadingIndicator(message: 'Loading contacts...');
    }

    if (_recentsError != null) {
      return EmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load contacts',
        subtitle: _recentsError,
        actionLabel: 'Retry',
        onAction: _loadRecentContacts,
      );
    }

    if (_recentContacts.isEmpty) {
      return const EmptyState(
        icon: Icons.people_outline_rounded,
        title: 'No recent contacts',
        subtitle: 'Search for a user above to start a new conversation.',
      );
    }

    return _UserList(
      users: _recentContacts,
      onUserTap: _onUserTap,
      header: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        child: Text(
          'Recent',
          style: Theme.of(context).textTheme.titleSmall,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Private widgets
// ---------------------------------------------------------------------------

/// Search input field displayed at the top of the screen.
class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final bool hasText;

  const _SearchBar({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onClear,
    required this.hasText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: AppTheme.neutral200,
            width: 1,
          ),
        ),
      ),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        autofocus: true,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search by name...',
          prefixIcon: const Icon(Icons.search, size: 20),
          suffixIcon: hasText
              ? IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: onClear,
                )
              : null,
          filled: true,
          fillColor: AppTheme.neutral100,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            borderSide: const BorderSide(
              color: AppTheme.primaryColor,
              width: 1.5,
            ),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
            vertical: AppTheme.spacingSm,
          ),
        ),
        onChanged: onChanged,
      ),
    );
  }
}

/// Scrollable list of user tiles with an optional header widget.
class _UserList extends StatelessWidget {
  final List<_SearchUser> users;
  final ValueChanged<_SearchUser> onUserTap;
  final Widget? header;

  const _UserList({
    required this.users,
    required this.onUserTap,
    this.header,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingLg),
      itemCount: users.length + (header != null ? 1 : 0),
      itemBuilder: (context, index) {
        if (header != null && index == 0) {
          return header!;
        }

        final user = users[header != null ? index - 1 : index];
        return _UserTile(
          user: user,
          onTap: () => onUserTap(user),
        );
      },
    );
  }
}

/// A single user row showing avatar, name, role badge, and optional job context.
class _UserTile extends StatelessWidget {
  final _SearchUser user;
  final VoidCallback onTap;

  const _UserTile({
    required this.user,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        child: Row(
          children: [
            // Avatar
            UserAvatar(
              imageUrl: user.avatarUrl,
              name: user.fullName,
              size: AvatarSize.medium,
            ),
            const SizedBox(width: AppTheme.spacingMd),

            // Name, role, job context
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name row with role badge
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.fullName,
                          style:
                              Theme.of(context).textTheme.titleSmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                      _RoleBadge(role: user.role),
                    ],
                  ),

                  // Title or job context
                  if (user.title != null && user.title!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      user.title!,
                      style:
                          Theme.of(context).textTheme.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (user.jobContext != null &&
                      user.jobContext!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(
                          Icons.work_outline,
                          size: 12,
                          color: AppTheme.primaryColor,
                        ),
                        const SizedBox(width: AppTheme.spacingXs),
                        Expanded(
                          child: Text(
                            user.jobContext!,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: AppTheme.primaryColor,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // Chevron
            Icon(
              Icons.chevron_right,
              color: AppTheme.neutral400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

/// Small colored badge indicating the user's role (Freelancer / Client).
class _RoleBadge extends StatelessWidget {
  final UserRole role;

  const _RoleBadge({required this.role});

  @override
  Widget build(BuildContext context) {
    final Color backgroundColor;
    final Color textColor;

    switch (role) {
      case UserRole.freelancer:
        backgroundColor = AppTheme.secondaryColor.withOpacity(0.1);
        textColor = AppTheme.secondaryColor;
      case UserRole.client:
        backgroundColor = AppTheme.infoColor.withOpacity(0.1);
        textColor = AppTheme.infoColor;
      case UserRole.admin:
        backgroundColor = AppTheme.accentColor.withOpacity(0.1);
        textColor = AppTheme.accentColor;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
      ),
      child: Text(
        role.displayName,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }
}
