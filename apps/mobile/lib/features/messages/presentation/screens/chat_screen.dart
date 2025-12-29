import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

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
  bool _isTyping = false;

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    // TODO: Send message via API
    _messageController.clear();
    setState(() => _isTyping = false);
  }

  @override
  Widget build(BuildContext context) {
    final conversationAsync =
        ref.watch(conversationDetailProvider(widget.conversationId));

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
                if (conversation.jobTitle != null)
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
                child: _MessagesList(conversationId: widget.conversationId),
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
                        onPressed: () {
                          // Attach file
                        },
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
                          onChanged: (value) {
                            setState(() => _isTyping = value.isNotEmpty);
                          },
                          textCapitalization: TextCapitalization.sentences,
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: _isTyping
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

class _MessagesList extends ConsumerWidget {
  final String conversationId;

  const _MessagesList({required this.conversationId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messagesAsync = ref.watch(messagesProvider(conversationId));

    return messagesAsync.when(
      data: (messages) {
        if (messages.isEmpty) {
          return const Center(child: Text('No messages yet'));
        }

        return ListView.builder(
          reverse: true,
          padding: const EdgeInsets.all(AppTheme.spacingMd),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final message = messages[messages.length - 1 - index];
            final isMe =
                message.senderId == 'current_user'; // TODO: Use actual user ID
            return _MessageBubble(message: message, isMe: isMe);
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(child: Text('Error: $error')),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const _MessageBubble({required this.message, required this.isMe});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.75,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          color: isMe ? AppTheme.primaryColor : AppTheme.neutral100,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              message.content,
              style: TextStyle(
                color: isMe ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat.jm().format(message.sentAt),
                  style: TextStyle(
                    fontSize: 10,
                    color: isMe ? Colors.white70 : AppTheme.neutral500,
                  ),
                ),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  Icon(
                    message.isRead ? Icons.done_all : Icons.done,
                    size: 14,
                    color: message.isRead
                        ? Colors.lightBlueAccent
                        : Colors.white70,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
