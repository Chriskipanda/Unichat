import 'dart:convert';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local copy of what the server last told us, so a cold start with no network
/// still opens on real chats instead of an error page.
///
/// Stores the raw server JSON rather than parsed models: parsing then lives in
/// exactly one place (the model factories), and a cached payload can never
/// disagree with a freshly fetched one about how it should be read.
class ChatCache {
  static const _roomsKey = 'cache_rooms_v1';
  static String _messagesKey(String roomId) => 'cache_msgs_v1_$roomId';
  static const _messagesIndexKey = 'cache_msgs_index_v1';

  /// Per-room cap. Chat history is unbounded but SharedPreferences is not, so
  /// keep roughly a screenful or two — enough to read offline, small enough
  /// that a long-lived room can't grow without limit.
  static const _maxCachedMessages = 60;

  /// Rooms whose history we're allowed to keep, most-recently-opened first.
  /// Without this, every room ever opened would keep its slice forever.
  static const _maxCachedRooms = 20;

  static Future<void> saveRooms(List<dynamic> rooms) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_roomsKey, jsonEncode(rooms));
  }

  static Future<List<Map<String, dynamic>>?> loadRooms() async {
    final prefs = await SharedPreferences.getInstance();
    return _decodeList(prefs.getString(_roomsKey));
  }

  static Future<void> saveMessages(String roomId, List<dynamic> messages) async {
    final prefs = await SharedPreferences.getInstance();
    // Keep the newest slice — history arrives oldest-first.
    final slice = messages.length > _maxCachedMessages
        ? messages.sublist(messages.length - _maxCachedMessages)
        : messages;
    await prefs.setString(_messagesKey(roomId), jsonEncode(slice));
    await _touchRoom(prefs, roomId);
  }

  static Future<List<Map<String, dynamic>>?> loadMessages(String roomId) async {
    final prefs = await SharedPreferences.getInstance();
    return _decodeList(prefs.getString(_messagesKey(roomId)));
  }

  /// Fold a single live message into the cache. Sockets and the send response
  /// hand back the same shape as history, so the cache stays uniformly raw —
  /// without this, anything that arrived after the last fetch would vanish the
  /// moment the network dropped.
  static Future<void> appendMessage(String roomId, Map<String, dynamic> raw) async {
    final existing = await loadMessages(roomId) ?? <Map<String, dynamic>>[];
    final id = raw['id'];
    if (id != null && existing.any((m) => m['id'] == id)) return; // echo or replay
    existing.add(raw);
    await saveMessages(roomId, existing);
  }

  /// Drop cached photos on logout. Clearing SharedPreferences takes care of the
  /// message JSON, but image files live in a separate on-disk cache — on a
  /// shared device those would otherwise outlive the session and be readable by
  /// whoever signs in next.
  static Future<void> clearMedia() async {
    try {
      await DefaultCacheManager().emptyCache();
    } catch (_) {
      // Never block sign-out on cache cleanup.
    }
  }

  /// Move a room to the front of the index, evicting history past the cap.
  static Future<void> _touchRoom(SharedPreferences prefs, String roomId) async {
    final index = prefs.getStringList(_messagesIndexKey) ?? <String>[];
    index
      ..remove(roomId)
      ..insert(0, roomId);
    for (final stale in index.skip(_maxCachedRooms)) {
      await prefs.remove(_messagesKey(stale));
    }
    await prefs.setStringList(_messagesIndexKey, index.take(_maxCachedRooms).toList());
  }

  /// Never let a malformed or half-written entry take the app down — a bad
  /// cache should degrade to "no cache", not to a crash on launch.
  static List<Map<String, dynamic>>? _decodeList(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return null;
      return decoded.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (_) {
      return null;
    }
  }
}
