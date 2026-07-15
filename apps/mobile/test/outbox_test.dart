import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unichat_mobile/services/outbox.dart';

PendingMessage pending(String tempId, {String roomId = 'room-1', String content = 'hi', int at = 0}) =>
    PendingMessage(
      tempId: tempId,
      roomId: roomId,
      content: content,
      senderId: 'u1',
      senderName: 'Alice',
      tenantId: 't1',
      createdAt: DateTime(2026, 1, 1).add(Duration(minutes: at)),
    );

/// Accepts everything, recording the order it saw.
MockClient acceptAll(List<String> seen) => MockClient((req) async {
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      seen.add(body['content'] as String);
      return http.Response(
        jsonEncode({'message': {'id': 'server-${body['content']}', 'content': body['content'], 'type': 'text'}}),
        201,
      );
    });

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('starts empty', () async {
    expect(await Outbox.hasPending(), isFalse);
    expect(await Outbox.pendingFor('room-1'), isEmpty);
  });

  test('enqueue then read back', () async {
    await Outbox.enqueue(pending('t1', content: 'queued'));
    expect(await Outbox.hasPending(), isTrue);
    final items = await Outbox.pendingFor('room-1');
    expect(items, hasLength(1));
    expect(items.first.content, 'queued');
  });

  test('enqueue ignores a duplicate tempId', () async {
    await Outbox.enqueue(pending('t1'));
    await Outbox.enqueue(pending('t1'));
    expect(await Outbox.pendingFor('room-1'), hasLength(1));
  });

  test('pendingFor only returns that room, oldest first', () async {
    await Outbox.enqueue(pending('t2', at: 2));
    await Outbox.enqueue(pending('t1', at: 1));
    await Outbox.enqueue(pending('other', roomId: 'room-2'));
    final items = await Outbox.pendingFor('room-1');
    expect(items.map((e) => e.tempId), ['t1', 't2']);
  });

  test('remove drops one message', () async {
    await Outbox.enqueue(pending('t1'));
    await Outbox.enqueue(pending('t2', at: 1));
    await Outbox.remove('t1');
    expect((await Outbox.pendingFor('room-1')).map((e) => e.tempId), ['t2']);
  });

  test('flush delivers in order and empties the queue', () async {
    await Outbox.enqueue(pending('t2', content: 'second', at: 2));
    await Outbox.enqueue(pending('t1', content: 'first', at: 1));

    final seen = <String>[];
    final result = await Outbox.flush('token', client: acceptAll(seen));

    expect(seen, ['first', 'second'], reason: 'must send oldest first');
    expect(result.sent.keys, containsAll(['t1', 't2']));
    expect(result.stillOffline, isFalse);
    expect(await Outbox.hasPending(), isFalse);
  });

  test('flush returns the server payload so the UI can adopt the real id', () async {
    await Outbox.enqueue(pending('t1', content: 'hello'));
    final result = await Outbox.flush('token', client: acceptAll([]));
    expect(result.sent['t1']!['id'], 'server-hello');
  });

  test('still offline: queue is kept intact and order preserved', () async {
    await Outbox.enqueue(pending('t1', content: 'first', at: 1));
    await Outbox.enqueue(pending('t2', content: 'second', at: 2));

    final result = await Outbox.flush('token', client: MockClient((_) async {
      throw const SocketExceptionStub();
    }));

    expect(result.stillOffline, isTrue);
    expect(result.sent, isEmpty);
    expect((await Outbox.pendingFor('room-1')).map((e) => e.tempId), ['t1', 't2']);
  });

  test('a network drop mid-run keeps the undelivered tail queued', () async {
    await Outbox.enqueue(pending('t1', content: 'first', at: 1));
    await Outbox.enqueue(pending('t2', content: 'second', at: 2));
    await Outbox.enqueue(pending('t3', content: 'third', at: 3));

    var calls = 0;
    final result = await Outbox.flush('token', client: MockClient((req) async {
      calls++;
      if (calls == 1) {
        return http.Response(jsonEncode({'message': {'id': 's1'}}), 201);
      }
      throw const SocketExceptionStub();
    }));

    expect(result.sent.keys, ['t1']);
    expect(result.stillOffline, isTrue);
    // t2 must not be skipped just because it failed once.
    expect((await Outbox.pendingFor('room-1')).map((e) => e.tempId), ['t2', 't3']);
  });

  test('a rejected message is dropped so it cannot stall the queue', () async {
    await Outbox.enqueue(pending('bad', content: 'rejected', at: 1));
    await Outbox.enqueue(pending('good', content: 'fine', at: 2));

    final result = await Outbox.flush('token', client: MockClient((req) async {
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      if (body['content'] == 'rejected') {
        return http.Response(jsonEncode({'error': 'content required'}), 400);
      }
      return http.Response(jsonEncode({'message': {'id': 'ok'}}), 201);
    }));

    expect(result.sent.keys, ['good'], reason: 'the good message still goes');
    expect(await Outbox.hasPending(), isFalse, reason: 'poison message must not linger');
  });

  test('a 5xx keeps the message for a later retry', () async {
    await Outbox.enqueue(pending('t1'));
    final result = await Outbox.flush('token',
        client: MockClient((_) async => http.Response('boom', 500)));
    expect(result.stillOffline, isTrue);
    expect(await Outbox.hasPending(), isTrue, reason: 'server fault is temporary');
  });

  test('corrupt queue degrades to empty instead of throwing', () async {
    SharedPreferences.setMockInitialValues({'outbox_v1': 'garbage'});
    expect(await Outbox.pendingFor('room-1'), isEmpty);
    expect(await Outbox.hasPending(), isFalse);
  });

  test('flush on an empty queue is a no-op', () async {
    final result = await Outbox.flush('token', client: acceptAll([]));
    expect(result.sent, isEmpty);
    expect(result.stillOffline, isFalse);
  });
}

/// Stands in for a real socket failure without importing dart:io.
class SocketExceptionStub implements Exception {
  const SocketExceptionStub();
}
