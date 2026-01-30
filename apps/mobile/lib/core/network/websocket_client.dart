import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;

import '../../features/messages/domain/models/message.dart';
import '../storage/secure_storage.dart';

/// WebSocket event types
enum WebSocketEventType {
  connected,
  disconnected,
  newMessage,
  messageDelivered,
  messageRead,
  typing,
  typingStop,
  error,
}

/// WebSocket event data
class WebSocketEvent {
  final WebSocketEventType type;
  final dynamic data;

  const WebSocketEvent({required this.type, this.data});
}

/// Typing indicator data
class TypingIndicator {
  final String conversationId;
  final String userId;
  final String userName;
  final bool isTyping;

  const TypingIndicator({
    required this.conversationId,
    required this.userId,
    required this.userName,
    required this.isTyping,
  });

  factory TypingIndicator.fromJson(Map<String, dynamic> json) {
    return TypingIndicator(
      conversationId: json['conversationId'] as String,
      userId: json['userId'] as String,
      userName: json['userName'] as String? ?? '',
      isTyping: json['isTyping'] as bool? ?? false,
    );
  }
}

/// WebSocket connection state
enum ConnectionState {
  disconnected,
  connecting,
  connected,
  reconnecting,
}

/// WebSocket client for real-time messaging
class WebSocketClient {
  static const String _wsUrl = 'wss://api.skillancer.com/ws';
  static const Duration _reconnectDelay = Duration(seconds: 2);
  static const Duration _maxReconnectDelay = Duration(seconds: 30);
  static const Duration _pingInterval = Duration(seconds: 30);
  static const int _maxReconnectAttempts = 10;

  final SecureStorage _secureStorage = SecureStorage();
  final _eventController = StreamController<WebSocketEvent>.broadcast();

  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  int _reconnectAttempts = 0;
  ConnectionState _connectionState = ConnectionState.disconnected;
  bool _intentionalDisconnect = false;

  /// Stream of WebSocket events
  Stream<WebSocketEvent> get events => _eventController.stream;

  /// Current connection state
  ConnectionState get connectionState => _connectionState;

  /// Whether the client is connected
  bool get isConnected => _connectionState == ConnectionState.connected;

  /// Connect to WebSocket server
  Future<void> connect() async {
    if (_connectionState == ConnectionState.connecting ||
        _connectionState == ConnectionState.connected) {
      return;
    }

    _intentionalDisconnect = false;
    await _connect();
  }

  Future<void> _connect() async {
    _setConnectionState(ConnectionState.connecting);

    try {
      final token = await _secureStorage.getToken();
      if (token == null) {
        _setConnectionState(ConnectionState.disconnected);
        _eventController.add(const WebSocketEvent(
          type: WebSocketEventType.error,
          data: 'No authentication token',
        ));
        return;
      }

      final uri = Uri.parse('$_wsUrl?token=$token');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      _setConnectionState(ConnectionState.connected);
      _reconnectAttempts = 0;
      _startPingTimer();

      _eventController
          .add(const WebSocketEvent(type: WebSocketEventType.connected));

      debugPrint('[WebSocket] Connected successfully');
    } catch (e) {
      debugPrint('[WebSocket] Connection failed: $e');
      _setConnectionState(ConnectionState.disconnected);
      _scheduleReconnect();
    }
  }

  /// Disconnect from WebSocket server
  Future<void> disconnect() async {
    _intentionalDisconnect = true;
    await _cleanup();
  }

  Future<void> _cleanup() async {
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();

    if (_channel != null) {
      await _channel!.sink.close(status.goingAway);
      _channel = null;
    }

    _setConnectionState(ConnectionState.disconnected);
    _eventController
        .add(const WebSocketEvent(type: WebSocketEventType.disconnected));
  }

  void _setConnectionState(ConnectionState state) {
    _connectionState = state;
  }

  void _onMessage(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      final type = json['type'] as String?;

      switch (type) {
        case 'pong':
          // Server responded to ping
          break;

        case 'new_message':
          final messageData = json['data'] as Map<String, dynamic>;
          final message = Message.fromJson(messageData);
          _eventController.add(WebSocketEvent(
            type: WebSocketEventType.newMessage,
            data: message,
          ));
          break;

        case 'message_delivered':
          _eventController.add(WebSocketEvent(
            type: WebSocketEventType.messageDelivered,
            data: {
              'messageId': json['data']['messageId'] as String,
              'conversationId': json['data']['conversationId'] as String,
            },
          ));
          break;

        case 'message_read':
          _eventController.add(WebSocketEvent(
            type: WebSocketEventType.messageRead,
            data: {
              'conversationId': json['data']['conversationId'] as String,
              'readBy': json['data']['readBy'] as String,
              'readAt': json['data']['readAt'] as String,
            },
          ));
          break;

        case 'typing':
          final typingData = json['data'] as Map<String, dynamic>;
          final indicator = TypingIndicator.fromJson(typingData);
          _eventController.add(WebSocketEvent(
            type: indicator.isTyping
                ? WebSocketEventType.typing
                : WebSocketEventType.typingStop,
            data: indicator,
          ));
          break;

        case 'error':
          _eventController.add(WebSocketEvent(
            type: WebSocketEventType.error,
            data: json['message'] ?? 'Unknown error',
          ));
          break;

        default:
          debugPrint('[WebSocket] Unknown message type: $type');
      }
    } catch (e) {
      debugPrint('[WebSocket] Error parsing message: $e');
    }
  }

  void _onError(Object error) {
    debugPrint('[WebSocket] Error: $error');
    _eventController.add(WebSocketEvent(
      type: WebSocketEventType.error,
      data: error.toString(),
    ));
  }

  void _onDone() {
    debugPrint('[WebSocket] Connection closed');
    _setConnectionState(ConnectionState.disconnected);
    _pingTimer?.cancel();

    if (!_intentionalDisconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_intentionalDisconnect || _reconnectAttempts >= _maxReconnectAttempts) {
      return;
    }

    _setConnectionState(ConnectionState.reconnecting);
    _reconnectAttempts++;

    // Exponential backoff
    final delay = Duration(
      milliseconds:
          (_reconnectDelay.inMilliseconds * (1 << (_reconnectAttempts - 1)))
              .clamp(
        _reconnectDelay.inMilliseconds,
        _maxReconnectDelay.inMilliseconds,
      ),
    );

    debugPrint(
        '[WebSocket] Scheduling reconnect attempt $_reconnectAttempts in ${delay.inSeconds}s');

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(delay, () {
      _connect();
    });
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(_pingInterval, (_) {
      _sendPing();
    });
  }

  void _sendPing() {
    _send({'type': 'ping'});
  }

  void _send(Map<String, dynamic> data) {
    if (_channel != null && _connectionState == ConnectionState.connected) {
      try {
        _channel!.sink.add(jsonEncode(data));
      } catch (e) {
        debugPrint('[WebSocket] Error sending message: $e');
      }
    }
  }

  /// Send typing indicator
  void sendTypingIndicator({
    required String conversationId,
    required bool isTyping,
  }) {
    _send({
      'type': 'typing',
      'data': {
        'conversationId': conversationId,
        'isTyping': isTyping,
      },
    });
  }

  /// Send message read acknowledgement
  void sendMessageRead({
    required String conversationId,
    required String messageId,
  }) {
    _send({
      'type': 'message_read',
      'data': {
        'conversationId': conversationId,
        'messageId': messageId,
      },
    });
  }

  /// Send new message via WebSocket (for real-time delivery)
  void sendMessage(Message message) {
    _send({
      'type': 'send_message',
      'data': message.toJson(),
    });
  }

  /// Dispose resources
  void dispose() {
    _intentionalDisconnect = true;
    _reconnectTimer?.cancel();
    _pingTimer?.cancel();
    _channel?.sink.close(status.goingAway);
    _eventController.close();
  }
}
