import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../../core/providers/providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models/message.dart';

/// Chat screen for a conversation
class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;

  const ChatScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _imagePicker = ImagePicker();
  bool _isTyping = false;
  bool _isSending = false;
  List<File> _attachments = [];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    // Stop typing indicator when leaving
    ref
        .read(messagesStateProvider(widget.conversationId).notifier)
        .setTyping(false);
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    // Load more when near the bottom (oldest messages)
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref
          .read(messagesStateProvider(widget.conversationId).notifier)
          .loadMoreMessages();
    }
  }

  void _onTextChanged(String value) {
    final wasTyping = _isTyping;
    setState(() => _isTyping = value.isNotEmpty);

    // Send typing indicator
    if (_isTyping && !wasTyping) {
      ref
          .read(messagesStateProvider(widget.conversationId).notifier)
          .setTyping(true);
    } else if (!_isTyping && wasTyping) {
      ref
          .read(messagesStateProvider(widget.conversationId).notifier)
          .setTyping(false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty && _attachments.isEmpty) return;
    if (_isSending) return;

    setState(() => _isSending = true);

    // Stop typing indicator
    ref
        .read(messagesStateProvider(widget.conversationId).notifier)
        .setTyping(false);

    bool success;
    if (_attachments.isNotEmpty) {
      success = await ref
          .read(messagesStateProvider(widget.conversationId).notifier)
          .sendMessageWithAttachments(text, _attachments);
    } else {
      success = await ref
          .read(messagesStateProvider(widget.conversationId).notifier)
          .sendMessage(text);
    }

    if (success) {
      _messageController.clear();
      setState(() {
        _isTyping = false;
        _attachments = [];
      });
      // Scroll to top to show new message
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    }

    if (mounted) {
      setState(() => _isSending = false);
    }
  }

  Future<void> _pickImage() async {
    final result = await _imagePicker.pickImage(source: ImageSource.gallery);
    if (result != null) {
      setState(() {
        _attachments.add(File(result.path));
      });
    }
  }

  Future<void> _takePhoto() async {
    final result = await _imagePicker.pickImage(source: ImageSource.camera);
    if (result != null) {
      setState(() {
        _attachments.add(File(result.path));
      });
    }
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: true,
    );
    if (result != null) {
      setState(() {
        _attachments
            .addAll(result.paths.whereType<String>().map((p) => File(p)));
      });
    }
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Photo from Gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickImage();
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo'),
              onTap: () {
                Navigator.pop(context);
                _takePhoto();
              },
            ),
            ListTile(
              leading: const Icon(Icons.attach_file),
              title: const Text('File'),
              onTap: () {
                Navigator.pop(context);
                _pickFile();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _removeAttachment(int index) {
    setState(() {
      _attachments.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final conversationAsync =
        ref.watch(conversationDetailProvider(widget.conversationId));
    final typingState = ref.watch(typingStateProvider(widget.conversationId));

    return conversationAsync.when(
      data: (conversation) {
        if (conversation == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Conversation not found')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(conversation.participantName),
                if (typingState.hasTypingUsers)
                  Text(
                    '${typingState.typingUserNames.join(", ")} typing...',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontStyle: FontStyle.italic,
                          color: AppTheme.primaryColor,
                        ),
                  )
                else if (conversation.jobTitle != null)
                  Text(
                    conversation.jobTitle!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.more_vert),
                onPressed: () {},
              ),
            ],
          ),
          body: Column(
            children: [
              // Messages list
              Expanded(
                child: _MessagesList(
                  conversationId: widget.conversationId,
                  scrollController: _scrollController,
                ),
              ),

              // Typing indicator
              if (typingState.hasTypingUsers)
                _TypingIndicatorBubble(
                  typingUsers: typingState.typingUserNames,
                ),

              // Attachment preview
              if (_attachments.isNotEmpty)
                _AttachmentPreview(
                  attachments: _attachments,
                  onRemove: _removeAttachment,
                ),

              // Input bar
              Container(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -5),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.attach_file),
                        onPressed: _showAttachmentOptions,
                      ),
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          decoration: InputDecoration(
                            hintText: 'Type a message...',
                            filled: true,
                            fillColor: AppTheme.neutral100,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: AppTheme.spacingMd,
                              vertical: AppTheme.spacingSm,
                            ),
                          ),
                          maxLines: 4,
                          minLines: 1,
                          onChanged: _onTextChanged,
                          textCapitalization: TextCapitalization.sentences,
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: _isSending
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : (_isTyping || _attachments.isNotEmpty)
                                ? IconButton(
                                    key: const ValueKey('send'),
                                    icon: const Icon(Icons.send),
                                    color: AppTheme.primaryColor,
                                    onPressed: _sendMessage,
                                  )
                                : IconButton(
                                    key: const ValueKey('mic'),
                                    icon: const Icon(Icons.mic),
                                    onPressed: () {
                                      // Voice message
                                    },
                                  ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Error: $error')),
      ),
    );
  }
}

/// Typing indicator bubble
class _TypingIndicatorBubble extends StatelessWidget {
  final List<String> typingUsers;

  const _TypingIndicatorBubble({required this.typingUsers});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(
          left: AppTheme.spacingMd,
          bottom: AppTheme.spacingSm,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          color: AppTheme.neutral100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _TypingDots(),
            const SizedBox(width: AppTheme.spacingSm),
            Text(
              typingUsers.length == 1
                  ? '${typingUsers.first} is typing'
                  : '${typingUsers.length} people are typing',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontStyle: FontStyle.italic,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Animated typing dots
class _TypingDots extends StatefulWidget {
  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            final delay = index * 0.2;
            final value = ((_controller.value + delay) % 1.0);
            final scale = 0.5 + (0.5 * (1 - (value - 0.5).abs() * 2));
            return Container(
              margin: EdgeInsets.only(right: index < 2 ? 4 : 0),
              child: Transform.scale(
                scale: scale,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: AppTheme.neutral500,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}

/// Attachment preview widget
class _AttachmentPreview extends StatelessWidget {
  final List<File> attachments;
  final void Function(int index) onRemove;

  const _AttachmentPreview({
    required this.attachments,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 80,
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: attachments.length,
        itemBuilder: (context, index) {
          final file = attachments[index];
          final isImage = _isImageFile(file.path);

          return Container(
            width: 70,
            margin: const EdgeInsets.only(right: AppTheme.spacingSm),
            child: Stack(
              children: [
                Container(
                  width: 70,
                  height: 70,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.neutral200),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: isImage
                        ? Image.file(file, fit: BoxFit.cover)
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _getFileIcon(file.path),
                                color: AppTheme.neutral500,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                file.path.split('/').last,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                  ),
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: () => onRemove(index),
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  bool _isImageFile(String path) {
    final ext = path.split('.').last.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext);
  }

  IconData _getFileIcon(String path) {
    final ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'pdf':
        return Icons.picture_as_pdf;
      case 'doc':
      case 'docx':
        return Icons.description;
      case 'xls':
      case 'xlsx':
        return Icons.table_chart;
      case 'mp3':
      case 'wav':
        return Icons.audiotrack;
      case 'mp4':
      case 'mov':
        return Icons.video_file;
      default:
        return Icons.insert_drive_file;
    }
  }
}

class _MessagesList extends ConsumerWidget {
  final String conversationId;
  final ScrollController scrollController;

  const _MessagesList({
    required this.conversationId,
    required this.scrollController,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagesState = ref.watch(messagesStateProvider(conversationId));
    final currentUser = ref.watch(currentUserProvider);
    final currentUserId = currentUser?.id ?? '';

    // Use allMessages to include pending messages
    final allMessages = messagesState.allMessages;

    if (messagesState.error != null && allMessages.isEmpty) {
      return _ErrorState(
        error: messagesState.error!,
        onRetry: () =>
            ref.read(messagesStateProvider(conversationId).notifier).refresh(),
      );
    }

    if (messagesState.isLoading && allMessages.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (allMessages.isEmpty) {
      return const _EmptyMessagesState();
    }

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(messagesStateProvider(conversationId).notifier).refresh(),
      child: ListView.builder(
        controller: scrollController,
        reverse: true,
        padding: const EdgeInsets.all(AppTheme.spacingMd),
        itemCount: allMessages.length + (messagesState.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          // Show loading indicator at the bottom when loading more
          if (index == allMessages.length) {
            return const Padding(
              padding: EdgeInsets.all(AppTheme.spacingMd),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          }

          final message = allMessages[index];
          final isMe = message.senderId == currentUserId;
          return _MessageBubble(
            message: message,
            isMe: isMe,
            onRetry: message.status == MessageStatus.failed
                ? () => ref
                    .read(messagesStateProvider(conversationId).notifier)
                    .retryMessage(message.localId!)
                : null,
            onDelete: message.status == MessageStatus.failed
                ? () => ref
                    .read(messagesStateProvider(conversationId).notifier)
                    .deleteFailedMessage(message.localId!)
                : null,
          );
        },
      ),
    );
  }
}

class _EmptyMessagesState extends StatelessWidget {
  const _EmptyMessagesState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.chat_bubble_outline,
            size: 48,
            color: AppTheme.neutral400,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          Text(
            'No messages yet',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'Start the conversation!',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorState({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 48,
              color: AppTheme.errorColor,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              'Failed to load messages',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppTheme.spacingSm),
            Text(
              error,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppTheme.spacingMd),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;
  final VoidCallback? onRetry;
  final VoidCallback? onDelete;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    this.onRetry,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isFailed = message.status == MessageStatus.failed;
    final isPending = message.status == MessageStatus.pending ||
        message.status == MessageStatus.sending;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        child: Column(
          crossAxisAlignment:
              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            // Message content
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
                vertical: AppTheme.spacingSm,
              ),
              decoration: BoxDecoration(
                color: isFailed
                    ? AppTheme.errorColor.withOpacity(0.1)
                    : isPending
                        ? (isMe
                            ? AppTheme.primaryColor.withOpacity(0.7)
                            : AppTheme.neutral100)
                        : (isMe ? AppTheme.primaryColor : AppTheme.neutral100),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMe ? 16 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 16),
                ),
                border:
                    isFailed ? Border.all(color: AppTheme.errorColor) : null,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Attachments
                  if (message.attachments != null &&
                      message.attachments!.isNotEmpty)
                    _AttachmentContent(
                      attachments: message.attachments!,
                      isMe: isMe,
                    ),

                  // Text content
                  if (message.content.isNotEmpty)
                    Text(
                      message.content,
                      style: TextStyle(
                        color: isFailed
                            ? AppTheme.errorColor
                            : (isMe ? Colors.white : Colors.black87),
                      ),
                    ),
                  const SizedBox(height: 2),

                  // Time and status
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        DateFormat.jm().format(message.sentAt),
                        style: TextStyle(
                          fontSize: 10,
                          color: isFailed
                              ? AppTheme.errorColor
                              : (isMe ? Colors.white70 : AppTheme.neutral500),
                        ),
                      ),
                      if (isMe) ...[
                        const SizedBox(width: 4),
                        _StatusIcon(
                          status: message.status,
                          isRead: message.isRead,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),

            // Error message and retry button for failed messages
            if (isFailed) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Failed to send',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.errorColor,
                        ),
                  ),
                  if (message.canRetry && onRetry != null) ...[
                    const SizedBox(width: AppTheme.spacingSm),
                    GestureDetector(
                      onTap: onRetry,
                      child: Text(
                        'Retry',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.primaryColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ],
                  if (onDelete != null) ...[
                    const SizedBox(width: AppTheme.spacingSm),
                    GestureDetector(
                      onTap: onDelete,
                      child: Text(
                        'Delete',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.neutral500,
                            ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Status icon for message delivery status
class _StatusIcon extends StatelessWidget {
  final MessageStatus status;
  final bool isRead;

  const _StatusIcon({
    required this.status,
    required this.isRead,
  });

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case MessageStatus.pending:
        return const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
          ),
        );
      case MessageStatus.sending:
        return const Icon(
          Icons.schedule,
          size: 14,
          color: Colors.white70,
        );
      case MessageStatus.sent:
        return const Icon(
          Icons.done,
          size: 14,
          color: Colors.white70,
        );
      case MessageStatus.delivered:
        return const Icon(
          Icons.done_all,
          size: 14,
          color: Colors.white70,
        );
      case MessageStatus.read:
        return const Icon(
          Icons.done_all,
          size: 14,
          color: Colors.lightBlueAccent,
        );
      case MessageStatus.failed:
        return const Icon(
          Icons.error_outline,
          size: 14,
          color: AppTheme.errorColor,
        );
    }
  }
}

/// Attachment content display
class _AttachmentContent extends StatelessWidget {
  final List<Attachment> attachments;
  final bool isMe;

  const _AttachmentContent({
    required this.attachments,
    required this.isMe,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final attachment in attachments)
          Container(
            margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
            child: _buildAttachmentWidget(context, attachment),
          ),
      ],
    );
  }

  Widget _buildAttachmentWidget(BuildContext context, Attachment attachment) {
    if (_isImage(attachment.mimeType)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          attachment.url,
          fit: BoxFit.cover,
          width: 200,
          errorBuilder: (context, error, stack) => Container(
            width: 200,
            height: 100,
            color: AppTheme.neutral200,
            child: const Center(
              child: Icon(Icons.broken_image),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingSm),
      decoration: BoxDecoration(
        color: isMe ? Colors.white24 : AppTheme.neutral200,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _getFileIcon(attachment.mimeType),
            color: isMe ? Colors.white : AppTheme.neutral600,
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attachment.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: isMe ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  _formatFileSize(attachment.size),
                  style: TextStyle(
                    fontSize: 12,
                    color: isMe ? Colors.white70 : AppTheme.neutral500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool _isImage(String mimeType) {
    return mimeType.startsWith('image/');
  }

  IconData _getFileIcon(String mimeType) {
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf;
    if (mimeType.contains('word') || mimeType.contains('document')) {
      return Icons.description;
    }
    if (mimeType.contains('sheet') || mimeType.contains('excel')) {
      return Icons.table_chart;
    }
    if (mimeType.startsWith('audio/')) return Icons.audiotrack;
    if (mimeType.startsWith('video/')) return Icons.video_file;
    return Icons.insert_drive_file;
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
