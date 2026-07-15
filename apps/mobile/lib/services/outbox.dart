import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// A message the user sent that the server hasn't accepted yet.
class PendingMessage {
  final String tempId;
  final String roomId;
  final String content;
  final String senderId;
  final String senderName;
  final String? tenantId;
  final String? replyToId;
  final DateTime createdAt;

  const PendingMessage({
    required this.tempId,
    required this.roomId,
    required this.content,
    required this.senderId,
    required this.senderName,
    this.tenantId,
    this.replyToId,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'tempId': tempId,
        'roomId': roomId,
        'content': content,
        'senderId': senderId,
        'senderName': senderName,
        'tenantId': tenantId,
        'replyToId': replyToId,
        'createdAt': createdAt.toIso8601String(),
      };

  static PendingMessage? fromJson(Map<String, dynamic> j) {
    final tempId = j['tempId'] as String?;
    final roomId = j['roomId'] as String?;
    if (tempId == null || roomId == null) return null;
    return PendingMessage(
      tempId: tempId,
      roomId: roomId,
      content: j['content'] as String? ?? '',
      senderId: j['senderId'] as String? ?? '',
      senderName: j['senderName'] as String? ?? '',
      tenantId: j['tenantId'] as String?,
      replyToId: j['replyToId'] as String?,
      createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// The result of a single flush attempt.
class FlushResult {
  /// tempId -> the server's message payload, for messages that got through.
  final Map<String, Map<String, dynamic>> sent;

  /// True when the network is still unreachable, so the queue was left intact.
  final bool stillOffline;

  const FlushResult(this.sent, this.stillOffline);
}

/// Messages typed while offline. Without this a send that fails is simply lost:
/// it sits at "sending" forever and disappears on the next launch, which is the
/// one outcome a chat app must never have.
///
/// Text only. An image send needs its file to still exist at flush time, and
/// silently losing a photo would be worse than failing while the user can see
/// it — so those still require a connection.
class Outbox {
  static const _key = 'outbox_v1';

  static Future<List<PendingMessage>> _all() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => PendingMessage.fromJson(Map<String, dynamic>.from(e)))
          .whereType<PendingMessage>()
          .toList();
    } catch (_) {
      return []; // a corrupt queue must not brick the composer
    }
  }

  static Future<void> _write(List<PendingMessage> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(items.map((e) => e.toJson()).toList()));
  }

  static Future<void> enqueue(PendingMessage m) async {
    final items = await _all();
    if (items.any((e) => e.tempId == m.tempId)) return;
    items.add(m);
    await _write(items);
  }

  static Future<void> remove(String tempId) async {
    final items = await _all();
    items.removeWhere((e) => e.tempId == tempId);
    await _write(items);
  }

  /// Queued messages for one room, oldest first.
  static Future<List<PendingMessage>> pendingFor(String roomId) async =>
      (await _all()).where((e) => e.roomId == roomId).toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  static Future<bool> hasPending() async => (await _all()).isNotEmpty;

  /// Try to deliver everything queued, oldest first.
  ///
  /// Order matters: a chat that reorders itself on reconnect is worse than a
  /// slow one, so a network failure stops the run and leaves the rest queued
  /// rather than racing ahead to later messages.
  ///
  /// [client] exists so tests can drive the failure paths; production passes
  /// nothing and gets a normal client.
  static Future<FlushResult> flush(String token, {http.Client? client}) async {
    final items = await _all();
    if (items.isEmpty) return const FlushResult({}, false);
    items.sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final transport = client ?? http.Client();

    final sent = <String, Map<String, dynamic>>{};
    final delivered = <String>{};
    final dropped = <String>{};
    var offline = false;

    for (final m in items) {
      try {
        final body = <String, dynamic>{
          'content': m.content,
          'senderId': m.senderId,
          'senderName': m.senderName,
          if (m.tenantId != null) 'tenantId': m.tenantId,
          if (m.replyToId != null) 'replyToId': m.replyToId,
        };
        final res = await transport
            .post(
              Uri.parse('http://${Config.baseUrl}/api/v1/messages/${m.roomId}'),
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
              body: jsonEncode(body),
            )
            .timeout(const Duration(seconds: 15));

        if (res.statusCode == 201) {
          final payload = (jsonDecode(res.body)['message'] as Map?)?.cast<String, dynamic>();
          if (payload != null) sent[m.tempId] = payload;
          delivered.add(m.tempId);
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          // The server understood and refused it. Retrying can't help, and a
          // poison message would stall every message queued behind it.
          dropped.add(m.tempId);
        } else {
          offline = true; // 5xx — server is unwell, keep it and back off
          break;
        }
      } catch (_) {
        offline = true; // still no network — stop, preserve order
        break;
      }
    }

    if (client == null) transport.close(); // only close what we opened

    if (delivered.isNotEmpty || dropped.isNotEmpty) {
      // Re-read rather than reusing `items`: the user may have queued another
      // message while this run was in flight, and it must not be dropped.
      final remaining = (await _all())
          .where((e) => !delivered.contains(e.tempId) && !dropped.contains(e.tempId))
          .toList();
      await _write(remaining);
    }
    return FlushResult(sent, offline);
  }
}
