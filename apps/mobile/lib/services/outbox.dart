import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

/// A message the user sent that the server hasn't accepted yet.
class PendingMessage {
  final String tempId;
  /// Sent to the server on every attempt, unchanged across retries — lets it
  /// recognize "this exact send, retried" instead of creating a duplicate
  /// message if an earlier attempt actually succeeded but its response was
  /// lost (timeout, dropped connection).
  final String clientMessageId;
  final String roomId;
  final String content;
  final String senderId;
  final String senderName;
  final String? tenantId;
  final String? replyToId;
  final DateTime createdAt;
  final int attempts;
  final DateTime? nextRetryAt;

  const PendingMessage({
    required this.tempId,
    required this.clientMessageId,
    required this.roomId,
    required this.content,
    required this.senderId,
    required this.senderName,
    this.tenantId,
    this.replyToId,
    required this.createdAt,
    this.attempts = 0,
    this.nextRetryAt,
  });

  /// A retried attempt, backed off exponentially (2s, 4s, 8s... capped at
  /// 60s) so a genuinely offline stretch doesn't hammer the server the
  /// instant connectivity flickers back for a moment.
  PendingMessage withBackoff() {
    final nextAttempts = attempts + 1;
    final seconds = (2 << nextAttempts.clamp(0, 5)).clamp(2, 60);
    return PendingMessage(
      tempId: tempId, clientMessageId: clientMessageId, roomId: roomId, content: content,
      senderId: senderId, senderName: senderName, tenantId: tenantId, replyToId: replyToId,
      createdAt: createdAt, attempts: nextAttempts,
      nextRetryAt: DateTime.now().add(Duration(seconds: seconds)),
    );
  }

  Map<String, dynamic> toJson() => {
        'tempId': tempId,
        'clientMessageId': clientMessageId,
        'roomId': roomId,
        'content': content,
        'senderId': senderId,
        'senderName': senderName,
        'tenantId': tenantId,
        'replyToId': replyToId,
        'createdAt': createdAt.toIso8601String(),
        'attempts': attempts,
        'nextRetryAt': nextRetryAt?.toIso8601String(),
      };

  static PendingMessage? fromJson(Map<String, dynamic> j) {
    final tempId = j['tempId'] as String?;
    final roomId = j['roomId'] as String?;
    if (tempId == null || roomId == null) return null;
    return PendingMessage(
      tempId: tempId,
      // Older queued entries from before this field existed fall back to
      // tempId — still unique, just not the same value the in-flight
      // Message object may have generated; harmless, only matters for the
      // single retry of whatever was already queued at upgrade time.
      clientMessageId: j['clientMessageId'] as String? ?? tempId,
      roomId: roomId,
      content: j['content'] as String? ?? '',
      senderId: j['senderId'] as String? ?? '',
      senderName: j['senderName'] as String? ?? '',
      tenantId: j['tenantId'] as String?,
      replyToId: j['replyToId'] as String?,
      createdAt: DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
      attempts: j['attempts'] as int? ?? 0,
      nextRetryAt: j['nextRetryAt'] != null ? DateTime.tryParse(j['nextRetryAt'] as String) : null,
    );
  }
}

/// A message the server permanently rejected (4xx) — surfaced instead of
/// silently discarded, so the UI can show a real "failed to send" state
/// rather than leaving the bubble stuck on the sending clock forever with no
/// explanation.
class DeadMessage {
  final String tempId;
  final String roomId;
  final String reason;

  const DeadMessage({required this.tempId, required this.roomId, required this.reason});

  Map<String, dynamic> toJson() => {'tempId': tempId, 'roomId': roomId, 'reason': reason};

  static DeadMessage? fromJson(Map<String, dynamic> j) {
    final tempId = j['tempId'] as String?;
    final roomId = j['roomId'] as String?;
    if (tempId == null || roomId == null) return null;
    return DeadMessage(tempId: tempId, roomId: roomId, reason: j['reason'] as String? ?? 'Failed to send');
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
  static const _deadKey = 'outbox_dead_v1';

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

  static Future<List<DeadMessage>> _allDead() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_deadKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => DeadMessage.fromJson(Map<String, dynamic>.from(e)))
          .whereType<DeadMessage>()
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _writeDead(List<DeadMessage> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_deadKey, jsonEncode(items.map((e) => e.toJson()).toList()));
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

  /// Reads and clears every dead-lettered message for a room in one call —
  /// the caller (chat_screen) is expected to mark the corresponding on-screen
  /// bubble as failed right away, so there's nothing left to "re-read" later.
  static Future<List<DeadMessage>> takeDeadFor(String roomId) async {
    final all = await _allDead();
    final mine = all.where((d) => d.roomId == roomId).toList();
    if (mine.isEmpty) return mine;
    final remaining = all.where((d) => d.roomId != roomId).toList();
    await _writeDead(remaining);
    return mine;
  }

  /// Try to deliver everything queued, oldest first, skipping anything still
  /// within its backoff window from a prior failed attempt.
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
    final dead = <DeadMessage>[];
    final backedOff = <String, PendingMessage>{}; // tempId -> updated retry state
    var offline = false;
    final now = DateTime.now();

    for (final m in items) {
      if (m.nextRetryAt != null && now.isBefore(m.nextRetryAt!)) continue; // still cooling down

      try {
        final body = <String, dynamic>{
          'content': m.content,
          'clientMessageId': m.clientMessageId,
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

        // 200 = the idempotent-retry path: the server recognized
        // clientMessageId from an earlier attempt and returned what it
        // already persisted instead of creating a duplicate.
        if (res.statusCode == 201 || res.statusCode == 200) {
          final payload = (jsonDecode(res.body)['message'] as Map?)?.cast<String, dynamic>();
          if (payload != null) sent[m.tempId] = payload;
          delivered.add(m.tempId);
        } else if (res.statusCode >= 400 && res.statusCode < 500) {
          // The server understood and refused it. Retrying can't help, and a
          // poison message would stall every message queued behind it — but
          // it also must not just vanish with no trace.
          dead.add(DeadMessage(tempId: m.tempId, roomId: m.roomId, reason: 'Server rejected message (${res.statusCode})'));
        } else {
          offline = true; // 5xx — server is unwell, keep it and back off
          backedOff[m.tempId] = m.withBackoff();
          break;
        }
      } catch (_) {
        offline = true; // still no network — stop, preserve order
        backedOff[m.tempId] = m.withBackoff();
        break;
      }
    }

    if (client == null) transport.close(); // only close what we opened

    if (delivered.isNotEmpty || dead.isNotEmpty || backedOff.isNotEmpty) {
      // Re-read rather than reusing `items`: the user may have queued another
      // message while this run was in flight, and it must not be dropped.
      final deadIds = dead.map((d) => d.tempId).toSet();
      final remaining = (await _all())
          .where((e) => !delivered.contains(e.tempId) && !deadIds.contains(e.tempId))
          .map((e) => backedOff[e.tempId] ?? e)
          .toList();
      await _write(remaining);
    }
    if (dead.isNotEmpty) {
      final existingDead = await _allDead();
      await _writeDead([...existingDead, ...dead]);
    }
    return FlushResult(sent, offline);
  }
}
