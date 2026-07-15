import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unichat_mobile/services/chat_cache.dart';

Map<String, dynamic> msg(String id, [String content = 'hi']) =>
    {'id': id, 'content': content, 'senderId': 'u1', 'senderName': 'A', 'type': 'text'};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('returns null before anything is cached', () async {
    expect(await ChatCache.loadRooms(), isNull);
    expect(await ChatCache.loadMessages('room-1'), isNull);
  });

  test('rooms survive a round trip', () async {
    await ChatCache.saveRooms([
      {'id': 'r1', 'name': 'Second Student', 'lastMessage': 'yo', 'lastMessageType': 'text'},
    ]);
    final loaded = await ChatCache.loadRooms();
    expect(loaded, hasLength(1));
    expect(loaded!.first['name'], 'Second Student');
    expect(loaded.first['lastMessageType'], 'text');
  });

  test('messages survive a round trip', () async {
    await ChatCache.saveMessages('room-1', [msg('m1', 'hello'), msg('m2', 'world')]);
    final loaded = await ChatCache.loadMessages('room-1');
    expect(loaded, hasLength(2));
    expect(loaded!.last['content'], 'world');
  });

  test('keeps only the newest 60 messages, oldest dropped first', () async {
    await ChatCache.saveMessages('room-1', [for (var i = 0; i < 100; i++) msg('m$i', 'body$i')]);
    final loaded = await ChatCache.loadMessages('room-1');
    expect(loaded, hasLength(60));
    // History arrives oldest-first, so the tail is what matters.
    expect(loaded!.first['id'], 'm40');
    expect(loaded.last['id'], 'm99');
  });

  test('appendMessage adds a live message', () async {
    await ChatCache.saveMessages('room-1', [msg('m1')]);
    await ChatCache.appendMessage('room-1', msg('m2', 'live'));
    final loaded = await ChatCache.loadMessages('room-1');
    expect(loaded, hasLength(2));
    expect(loaded!.last['content'], 'live');
  });

  test('appendMessage ignores a duplicate id', () async {
    await ChatCache.saveMessages('room-1', [msg('m1')]);
    await ChatCache.appendMessage('room-1', msg('m1'));
    await ChatCache.appendMessage('room-1', msg('m1'));
    expect(await ChatCache.loadMessages('room-1'), hasLength(1));
  });

  test('appendMessage works on a room with no cache yet', () async {
    await ChatCache.appendMessage('fresh-room', msg('m1', 'first'));
    final loaded = await ChatCache.loadMessages('fresh-room');
    expect(loaded, hasLength(1));
    expect(loaded!.first['content'], 'first');
  });

  test('appending past the cap still keeps the newest', () async {
    await ChatCache.saveMessages('room-1', [for (var i = 0; i < 60; i++) msg('m$i')]);
    await ChatCache.appendMessage('room-1', msg('newest', 'latest'));
    final loaded = await ChatCache.loadMessages('room-1');
    expect(loaded, hasLength(60));
    expect(loaded!.last['id'], 'newest');
    expect(loaded.any((m) => m['id'] == 'm0'), isFalse, reason: 'oldest should be evicted');
  });

  test('history for more than 20 rooms evicts the least recently opened', () async {
    for (var i = 0; i < 25; i++) {
      await ChatCache.saveMessages('room-$i', [msg('m$i')]);
    }
    // room-0..room-4 were touched first, so they fall outside the 20 kept.
    expect(await ChatCache.loadMessages('room-0'), isNull);
    expect(await ChatCache.loadMessages('room-4'), isNull);
    expect(await ChatCache.loadMessages('room-5'), isNotNull);
    expect(await ChatCache.loadMessages('room-24'), isNotNull);
  });

  test('re-touching a room keeps it from being evicted', () async {
    for (var i = 0; i < 20; i++) {
      await ChatCache.saveMessages('room-$i', [msg('m$i')]);
    }
    await ChatCache.saveMessages('room-0', [msg('again')]); // re-open the oldest
    await ChatCache.saveMessages('room-99', [msg('new')]);  // push one out
    expect(await ChatCache.loadMessages('room-0'), isNotNull,
        reason: 'recently reopened room must survive');
    expect(await ChatCache.loadMessages('room-1'), isNull,
        reason: 'room-1 is now the least recent');
  });

  test('corrupt cache degrades to null instead of throwing', () async {
    SharedPreferences.setMockInitialValues({
      'cache_rooms_v1': 'not json at all',
      'cache_msgs_v1_room-1': '{"not":"a list"}',
    });
    expect(await ChatCache.loadRooms(), isNull);
    expect(await ChatCache.loadMessages('room-1'), isNull);
  });
}
