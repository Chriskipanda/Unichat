import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:photo_manager/photo_manager.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config.dart';
import '../models/models.dart';
import '../services/active_chat_tracker.dart';
import '../services/chat_cache.dart';
import '../services/outbox.dart';
import '../widgets/attachment_sheet.dart';
import '../widgets/chat_wallpaper.dart';

class ChatScreen extends StatefulWidget {
  final String roomId;
  final String roomName;
  final String subtitle;
  final bool isGroup;
  final bool isOnline;
  final String? avatarUrl;
  final bool canEditAvatar;
  final bool muted;
  final UserModel user;
  final String token;

  const ChatScreen({
    super.key,
    required this.roomId, required this.roomName, required this.subtitle,
    required this.isGroup, required this.isOnline,
    this.avatarUrl, this.canEditAvatar = false, this.muted = false,
    required this.user, required this.token,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> with TickerProviderStateMixin {
  final _msgCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _imagePicker = ImagePicker();
  final List<Message> _messages = [];
  bool _isTyping = false;
  bool _loadingHistory = true;
  bool _isOffline = false; // history came from cache, not the server
  bool _showAttachPanel = false;
  String _typingUser = '';
  Message? _replyingTo;
  Message? _editingMessage;
  String? _avatarUrl;
  bool _uploadingAvatar = false;
  io.Socket? _socket;
  io.Socket? _presenceSocket;
  Timer? _typingClearTimer;   // receiver side: drops a stale "is typing…"
  DateTime? _lastTypingEmit;  // sender side: throttles the typing event
  bool _muted = false;
  bool _searching = false;
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _searchLoading = false;
  // Per-room monotonic counter from the server — a gap between consecutive
  // values (expected n+1, got n+3) means at least one broadcast was missed
  // while disconnected. There's no way to replay just the gap, so the
  // correct response is the same one a manual reopen already does: reload
  // history from the server, which is authoritative regardless of what the
  // socket did or didn't deliver in between.
  int? _lastSeq;

  late AnimationController _typingCtrl;
  late List<Animation<double>> _dotAnims;

  @override
  void initState() {
    super.initState();
    ActiveChatTracker.currentRoomId = widget.roomId;
    _avatarUrl = widget.avatarUrl;
    _muted = widget.muted;
    _setupTypingAnimation();
    _connectSocket();
    _loadHistory();
  }

  void _setupTypingAnimation() {
    _typingCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();
    _dotAnims = List.generate(3, (i) {
      final start = i * 0.2;
      return Tween<double>(begin: 0, end: -6).animate(
        CurvedAnimation(parent: _typingCtrl, curve: Interval(start, start + 0.4, curve: Curves.easeInOut)),
      );
    });
  }

  Future<void> _loadHistory() async {
    setState(() => _loadingHistory = true);

    // Paint the last synced copy first so the thread is readable immediately —
    // offline it's all we'll ever have, and online it covers the fetch.
    final cached = await ChatCache.loadMessages(widget.roomId);
    if (!mounted) return;
    if (cached != null && cached.isNotEmpty) {
      setState(() {
        _messages
          ..clear()
          ..addAll(cached.map(_messageFrom));
        _loadingHistory = false;
      });
      _scrollToBottom();
    }

    try {
      final res = await http.get(
        Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}?limit=60'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (data['messages'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        // A fresh, authoritative snapshot — any gap the live socket missed is
        // resolved by this fetch, so the next new_message just re-establishes
        // the baseline rather than comparing against a now-stale value.
        _lastSeq = null;
        setState(() {
          _messages
            ..clear()
            ..addAll(list.map(_messageFrom));
          _loadingHistory = false;
          _isOffline = false;
        });
        _scrollToBottom();
        await ChatCache.saveMessages(widget.roomId, list);
      } else {
        setState(() => _loadingHistory = false);
      }
    } catch (_) {
      if (!mounted) return;
      // Keep whatever the cache gave us; only flag that it may be stale.
      setState(() {
        _loadingHistory = false;
        _isOffline = true;
      });
    }

    await _restorePending();
  }

  /// Re-attach messages still waiting to send. History comes from the server so
  /// it can't contain them, and dropping them here would make a queued message
  /// look lost every time the user reopened the chat.
  Future<void> _restorePending() async {
    final pending = await Outbox.pendingFor(widget.roomId);
    if (mounted && pending.isNotEmpty) {
      setState(() {
        for (final p in pending) {
          if (_messages.any((m) => m.id == p.tempId)) continue;
          _messages.add(Message(
            id: p.tempId,
            clientMessageId: p.clientMessageId,
            content: p.content,
            senderId: p.senderId,
            senderName: p.senderName,
            timestamp: p.createdAt,
            status: MessageStatus.sending,
          ));
        }
        _messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      });
      _scrollToBottom();
    }
    await _applyDeadLetters();
  }

  /// Anything the server permanently rejected (4xx) since this screen was
  /// last open — previously these just silently vanished from the queue
  /// while their bubble stayed stuck on the sending clock forever.
  Future<void> _applyDeadLetters() async {
    final dead = await Outbox.takeDeadFor(widget.roomId);
    if (!mounted || dead.isEmpty) return;
    setState(() {
      for (final d in dead) {
        final idx = _messages.indexWhere((m) => m.id == d.tempId);
        if (idx != -1) _messages[idx].failed = true;
      }
    });
  }

  /// Server now returns a real per-message `status` (from persisted
  /// MessageReceipt rows) directly — no more client-side timestamp math
  /// against a room-level approximation.
  Message _messageFrom(Map<String, dynamic> json) {
    MessageStatus status;
    if (json['senderId'] == widget.user.id) {
      switch (json['status']) {
        case 'read': status = MessageStatus.read; break;
        case 'delivered': status = MessageStatus.delivered; break;
        default: status = MessageStatus.sent;
      }
    } else {
      status = MessageStatus.delivered;
    }
    return Message.fromJson(json, status: status);
  }

  void _connectSocket() {
    try {
      _socket = io.io('http://${Config.baseUrl}', <String, dynamic>{
        // Polling as a fallback, not just websocket: some networks/proxies
        // block the websocket upgrade outright, which otherwise means this
        // socket never connects at all rather than degrading gracefully.
        'transports': ['websocket', 'polling'], 'autoConnect': true,
        'reconnection': true, 'reconnectionAttempts': 1000000,
        'reconnectionDelay': 1000, 'reconnectionDelayMax': 5000,
        // 'auth' (not just extraHeaders) because browsers strip custom
        // headers off the actual websocket upgrade — auth.token is part of
        // the socket.io handshake payload itself, so it survives on every
        // transport. The server now rejects any socket without it.
        'auth': {'token': widget.token},
        'extraHeaders': {'Authorization': 'Bearer ${widget.token}'},
      });
      // Re-join on every connect, not just the first — a reconnect starts a new
      // socket id with no room membership, which would silently stop delivery.
      // A connect is also the earliest reliable sign the network is back, so
      // it's when queued messages get another chance.
      _socket!.onConnect((_) {
        _socket!.emit('join_room', widget.roomId);
        _flushOutbox();
        // This screen being open and connected IS "viewing the room" — tell
        // the server so the peer's own sent messages flip to a blue tick.
        _socket!.emit('room_read', {'roomId': widget.roomId, 'userId': widget.user.id});
      });
      _socket!.on('new_message', (data) {
        if (!mounted) return;
        final raw = Map<String, dynamic>.from(data);
        final seq = raw['seq'] is int ? raw['seq'] as int : int.tryParse('${raw['seq']}');
        if (seq != null) {
          if (_lastSeq != null && seq > _lastSeq! + 1) {
            // Gap detected — something broadcast while this socket was
            // disconnected/reconnecting and was never replayed. A full
            // reload is the only correct recovery; the fresh history fetch
            // this triggers will also pick up whatever caused the gap.
            _lastSeq = seq;
            _loadHistory();
            return;
          }
          _lastSeq = seq;
        }
        final msg = Message.fromSocket(raw);
        if (msg.senderId == widget.user.id) return; // our own echo — already shown optimistically
        if (_messages.any((m) => m.id == msg.id)) return; // duplicate after reconnect/history overlap
        setState(() => _messages.add(msg));
        _scrollToBottom();
        ChatCache.appendMessage(widget.roomId, raw);
        // The screen is open and the new message just got painted — that's a
        // read, not just a delivery, so tell the sender right away.
        _socket!.emit('room_read', {'roomId': widget.roomId, 'userId': widget.user.id});
      });
      // The sender edited this message — update it in place wherever it
      // currently sits in the list.
      _socket!.on('message_edited', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m.id == d['messageId']);
          if (idx != -1) {
            _messages[idx].content = d['content'] as String? ?? _messages[idx].content;
            _messages[idx].isEdited = true;
            _messages[idx].editedAt = DateTime.tryParse(d['editedAt']?.toString() ?? '')?.toLocal();
          }
        });
      });
      // Deleted for everyone — render as a tombstone rather than removing it,
      // matching what every other client in the room now sees.
      _socket!.on('message_deleted', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m.id == d['messageId']);
          if (idx != -1) { _messages[idx].deleted = true; _messages[idx].content = ''; }
        });
      });
      _socket!.on('reaction_added', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m.id == d['messageId']);
          if (idx != -1) _messages[idx].reactions[d['userId'].toString()] = d['emoji'].toString();
        });
      });
      _socket!.on('reaction_removed', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        setState(() {
          final idx = _messages.indexWhere((m) => m.id == d['messageId']);
          if (idx != -1) _messages[idx].reactions.remove(d['userId'].toString());
        });
      });
      // Upgrade our own sent message(s) from single to double grey tick once the
      // server confirms someone else's socket is in the room.
      _socket!.on('message_delivered', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        final messageId = d['messageId'];
        setState(() {
          for (final m in _messages) {
            if (m.id == messageId && m.senderId == widget.user.id) {
              m.upgradeStatus(MessageStatus.delivered);
            }
          }
        });
      });
      // message_delivered only fires once, at the instant a message broadcasts
      // — if the recipient's socket wasn't in the room yet at that exact
      // moment (mid-reconnect, app still starting up), a message could stay
      // stuck on a single tick forever with nothing to re-check it. Someone
      // (re)joining the room now is a second chance: promote everything of
      // ours still sitting at "sent".
      _socket!.on('room_active', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        setState(() {
          for (final m in _messages) {
            if (m.senderId == widget.user.id) m.upgradeStatus(MessageStatus.delivered);
          }
        });
      });
      // The peer opened/is viewing this room — every one of our own messages
      // they could see is now truly read, so flip all of them to blue.
      _socket!.on('peer_read', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId || d['userId'] == widget.user.id) return;
        setState(() {
          for (final m in _messages) {
            if (m.senderId == widget.user.id) m.upgradeStatus(MessageStatus.read);
          }
        });
      });
      _presenceSocket = io.io('http://${Config.baseUrl}', <String, dynamic>{
        'transports': ['websocket', 'polling'], 'autoConnect': true, 'path': '/presence/',
        'reconnection': true, 'reconnectionAttempts': 1000000,
        'reconnectionDelay': 1000, 'reconnectionDelayMax': 5000,
        // Identity now comes from the verified JWT, not a client-claimed
        // query string — the server derives userId/tenantId itself.
        'auth': {'token': widget.token},
      });
      // Presence relays typing with socket.to(roomId), so this socket must be a
      // member of the room to receive anything.
      _presenceSocket!.onConnect((_) => _presenceSocket!.emit('join_room', widget.roomId));
      _presenceSocket!.on('user_typing', (data) {
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] == widget.roomId && d['userId'] != widget.user.id) {
          if (mounted) setState(() => _typingUser = d['userName'] ?? 'Someone');
          // Fail-safe: if the sender goes offline mid-typing its stop_typing
          // never arrives, which would strand the indicator on screen forever.
          _typingClearTimer?.cancel();
          _typingClearTimer = Timer(const Duration(seconds: 5), () {
            if (mounted) setState(() => _typingUser = '');
          });
        }
      });
      _presenceSocket!.on('user_stop_typing', (data) {
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] == widget.roomId && mounted) {
          _typingClearTimer?.cancel();
          setState(() => _typingUser = '');
        }
      });
    } catch (_) {}
  }

  void _scrollToBottom({bool animated = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      if (animated) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      } else {
        _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
      }
    });
  }

  void _onTypingChanged(String text) {
    final wasTyping = _isTyping;
    _isTyping = text.isNotEmpty;
    if (_isTyping != wasTyping) setState(() {});
    if (_isTyping) {
      // One event per keystroke would flood the socket; the peer clears the
      // indicator after 5s of silence, so re-announcing every 2s holds it up
      // while typing and lets it lapse naturally on a pause.
      final now = DateTime.now();
      final due = _lastTypingEmit == null ||
          now.difference(_lastTypingEmit!) > const Duration(seconds: 2);
      if (!due) return;
      _lastTypingEmit = now;
      _presenceSocket?.emit('typing', {'roomId': widget.roomId, 'userId': widget.user.id, 'userName': widget.user.fullName});
    } else {
      _lastTypingEmit = null;
      _presenceSocket?.emit('stop_typing', {'roomId': widget.roomId, 'userId': widget.user.id});
    }
  }

  void _sendMessage() {
    final content = _msgCtrl.text.trim();
    if (content.isEmpty) return;

    if (_editingMessage != null) {
      _submitEdit(_editingMessage!, content);
      return;
    }

    final replyTo = _replyingTo; // capture before setState clears it
    final msg = Message(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      content: content, senderId: widget.user.id, senderName: widget.user.fullName,
      timestamp: DateTime.now(), status: MessageStatus.sending, replyTo: replyTo,
    );
    setState(() { _messages.add(msg); _replyingTo = null; _isTyping = false; });
    _msgCtrl.clear();
    _scrollToBottom(animated: true);
    _lastTypingEmit = null;
    _presenceSocket?.emit('stop_typing', {'roomId': widget.roomId, 'userId': widget.user.id});
    _sendViaHttp(msg, replyTo);
  }

  Future<void> _submitEdit(Message original, String newContent) async {
    setState(() { _editingMessage = null; });
    _msgCtrl.clear();
    try {
      final res = await http.patch(
        Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}/${original.id}'),
        headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
        body: jsonEncode({'content': newContent}),
      ).timeout(const Duration(seconds: 10));
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          original.content = newContent;
          original.isEdited = true;
          original.editedAt = DateTime.now();
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not edit message'), behavior: SnackBarBehavior.floating));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not edit message — check connection'), behavior: SnackBarBehavior.floating));
      }
    }
  }

  Future<void> _sendViaHttp(Message msg, Message? replyTo) async {
    try {
      final body = <String, dynamic>{
        'content': msg.content,
        'clientMessageId': msg.clientMessageId,
      };
      if (replyTo != null) body['replyToId'] = replyTo.id;

      final res = await http.post(
        Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;
      // 200 = idempotent retry: the server recognized clientMessageId from an
      // earlier attempt and handed back what it already persisted, rather
      // than creating a duplicate. Treated identically to a fresh 201.
      if (res.statusCode == 201 || res.statusCode == 200) {
        // Adopt the server's UUID — replying to or deleting this message sends
        // the id back, and the temporary local one would be rejected.
        final sent = (jsonDecode(res.body)['message'] as Map?)?.cast<String, dynamic>();
        final serverId = sent?['id'] as String?;
        if (serverId != null) msg.id = serverId;
        // Single grey tick — real delivered/read promotion comes from the
        // server via 'message_delivered'/'peer_read' (see _connectSocket),
        // not a guess-and-hope timer. upgradeStatus (not a direct assignment)
        // because this 201 can resolve *after* a delivered/read receipt for
        // the same message already arrived over the socket — a plain
        // assignment here would silently drag a blue tick back to grey.
        setState(() => msg.upgradeStatus(MessageStatus.sent));
        if (sent != null) await ChatCache.appendMessage(widget.roomId, sent);
      } else {
        // The server understood and definitively refused it (4xx) — this is
        // not "still trying," it's failed. Previously this fell through to
        // silence: the bubble just sat on the sending clock forever.
        if (mounted) setState(() => msg.failed = true);
      }
    } catch (_) {
      // No network. Persist it so it survives leaving the screen or killing the
      // app, and send it when the connection comes back.
      await Outbox.enqueue(PendingMessage(
        tempId: msg.id,
        clientMessageId: msg.clientMessageId,
        roomId: widget.roomId,
        content: msg.content,
        senderId: widget.user.id,
        senderName: widget.user.fullName,
        tenantId: widget.user.tenant['id']?.toString(),
        replyToId: replyTo?.id,
        createdAt: msg.timestamp,
      ));
      if (mounted) setState(() { msg.status = MessageStatus.sending; _isOffline = true; });
    }
  }

  /// Deliver anything queued for this room and reconcile it with what's on
  /// screen. Safe to call repeatedly — the queue is the source of truth.
  Future<void> _flushOutbox() async {
    if (!await Outbox.hasPending()) return;
    final result = await Outbox.flush(widget.token);
    if (!mounted) return;

    for (final entry in result.sent.entries) {
      // Resolve to a concrete element up front: adopting the server id below
      // changes the very field a lazy `where` matches on, so re-reading it
      // would find nothing.
      final index = _messages.indexWhere((m) => m.id == entry.key);
      if (index == -1) continue;
      final delivered = _messages[index];
      final serverId = entry.value['id'] as String?;
      setState(() {
        if (serverId != null) delivered.id = serverId;
        // Same reasoning as the direct-send path: a receipt event for this
        // message may have already landed while it sat queued offline.
        delivered.upgradeStatus(MessageStatus.sent);
      });
      await ChatCache.appendMessage(widget.roomId, entry.value);
    }
    if (mounted && !result.stillOffline) setState(() => _isOffline = false);
    await _applyDeadLetters();
  }

  // ── Attachment handlers ────────────────────────────────────────────────────

  void _toggleAttachPanel() {
    setState(() => _showAttachPanel = !_showAttachPanel);
    if (_showAttachPanel) FocusScope.of(context).unfocus();
  }

  void _closeAttachPanel() {
    if (_showAttachPanel) setState(() => _showAttachPanel = false);
  }

  Future<void> _pickGallery() async {
    _closeAttachPanel();
    final files = await _imagePicker.pickMultiImage(imageQuality: 85);
    if (!mounted || files.isEmpty) return;
    for (final f in files) {
      await _sendImageFile(File(f.path));
    }
  }

  Future<void> _pickCamera() async {
    _closeAttachPanel();
    final file = await _imagePicker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (!mounted || file == null) return;
    await _sendImageFile(File(file.path));
  }

  Future<void> _sendMediaAsset(AssetEntity asset) async {
    _closeAttachPanel();
    final file = await asset.file;
    if (file == null || !mounted) return;
    await _sendImageFile(file);
  }

  Future<void> _sendImageFile(File file) async {
    final msg = Message(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      content: '📷 Image',
      senderId: widget.user.id,
      senderName: widget.user.fullName,
      senderAvatar: widget.user.avatarUrl,
      timestamp: DateTime.now(),
      status: MessageStatus.sending,
      localImagePath: file.path,
    );
    setState(() => _messages.add(msg));
    _scrollToBottom(animated: true);

    try {
      final baseUrl = Config.baseUrl.startsWith('http')
          ? Config.baseUrl
          : 'http://${Config.baseUrl}';
      final req = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/api/v1/messages/${widget.roomId}/media'),
      )
        ..headers['Authorization'] = 'Bearer ${widget.token}'
        ..fields['clientMessageId'] = msg.clientMessageId
        ..files.add(await http.MultipartFile.fromPath('file', file.path));

      final streamed = await req.send().timeout(const Duration(seconds: 60));

      if (!mounted) return;

      if (streamed.statusCode == 201 || streamed.statusCode == 200) {
        // Parse the response to get the served URL and update the bubble
        final body = await streamed.stream.bytesToString();
        final decoded = jsonDecode(body) as Map<String, dynamic>;
        final sent = (decoded['message'] as Map?)?.cast<String, dynamic>();
        final relativeUrl = sent?['content'] as String?;
        if (relativeUrl != null) {
          msg.imageUrl = '$baseUrl$relativeUrl';
        }
        final serverId = sent?['id'] as String?;
        if (serverId != null) msg.id = serverId;
        // Single grey tick — real delivered/read promotion comes from the
        // server via 'message_delivered'/'peer_read' (see _connectSocket),
        // not a guess-and-hope timer. upgradeStatus (not a direct assignment)
        // because this 201 can resolve *after* a delivered/read receipt for
        // the same message already arrived over the socket — a plain
        // assignment here would silently drag a blue tick back to grey.
        setState(() => msg.upgradeStatus(MessageStatus.sent));
        if (sent != null) await ChatCache.appendMessage(widget.roomId, sent);
      } else {
        // Definitively refused, not just slow — an image send has no offline
        // queue (the Outbox doc explains why: the file might not survive to
        // flush time), so this is the terminal state for a failed one.
        if (mounted) setState(() => msg.failed = true);
      }
    } catch (_) {
      // Network error — no offline queue for media, so this is as far as it
      // gets. failed (not "stays sending") tells the user it needs a retry,
      // not that it's still in flight.
      if (mounted) setState(() => msg.failed = true);
    }
  }

  void _showWallpaperPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatWallpaperPicker(
        current: ChatThemeService.current.value,
        onSelected: ChatThemeService.set, // saves + notifies all chat screens
      ),
    );
  }

  Future<void> _toggleMute() async {
    final next = !_muted;
    setState(() => _muted = next); // optimistic — it's just a per-user preference
    try {
      final res = await http.patch(
        Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/${widget.roomId}/mute'),
        headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
        body: jsonEncode({'muted': next}),
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200 && mounted) setState(() => _muted = !next); // roll back
    } catch (_) {
      if (mounted) setState(() => _muted = !next);
    }
  }

  Future<void> _performSearch(String query) async {
    if (query.trim().length < 2) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searchLoading = true);
    try {
      final res = await http.get(
        Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}/search?q=${Uri.encodeQueryComponent(query.trim())}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 10));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _searchResults = (data['results'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
          _searchLoading = false;
        });
      } else {
        setState(() => _searchLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _searchLoading = false);
    }
  }

  void _closeSearch() {
    setState(() { _searching = false; _searchResults = []; _searchCtrl.clear(); });
  }

  /// Jump to a result if it's already loaded in this session's window;
  /// otherwise there's no in-place scroll-to-message across a paginated
  /// history, so the honest fallback is to say so rather than silently do
  /// nothing.
  void _jumpToSearchResult(Map<String, dynamic> result) {
    final id = result['id'] as String?;
    final idx = _messages.indexWhere((m) => m.id == id);
    _closeSearch();
    if (idx == -1) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('That message is further back in history — scroll up to find it'),
        behavior: SnackBarBehavior.floating));
      return;
    }
    _scrollCtrl.animateTo(
      (idx / _messages.length) * _scrollCtrl.position.maxScrollExtent,
      duration: const Duration(milliseconds: 400), curve: Curves.easeOut,
    );
  }

  void _comingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('$feature coming soon'),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(16),
      backgroundColor: AppColors.brand,
    ));
  }

  void _showMessageOptions(BuildContext context, Message msg) {
    if (msg.deleted) return; // nothing to do with a tombstone
    final isMine = msg.senderId == widget.user.id;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: ['👍', '❤️', '😂', '😮', '😢', '🙏'].map((e) =>
                  GestureDetector(
                    onTap: () {
                      Navigator.pop(context);
                      _toggleReaction(msg, e);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: msg.reactions[widget.user.id] == e
                            ? AppColors.brand.withValues(alpha: 0.2) : context.cl.card,
                        shape: BoxShape.circle,
                      ),
                      child: Text(e, style: const TextStyle(fontSize: 24)),
                    ),
                  ),
                ).toList(),
              ),
            ),
            Divider(height: 1, color: context.cl.divider),
            _optionTile(context, Icons.reply_rounded, 'Reply', () {
              setState(() => _replyingTo = msg); Navigator.pop(context);
            }),
            _optionTile(context, Icons.copy_rounded, 'Copy', () {
              Clipboard.setData(ClipboardData(text: msg.content));
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Copied'), behavior: SnackBarBehavior.floating));
            }),
            if (isMine && !msg.isImage)
              _optionTile(context, Icons.edit_outlined, 'Edit', () {
                Navigator.pop(context);
                setState(() {
                  _editingMessage = msg;
                  _replyingTo = null;
                  _msgCtrl.text = msg.content;
                  _msgCtrl.selection = TextSelection.collapsed(offset: msg.content.length);
                });
              }),
            _optionTile(context, Icons.delete_outline_rounded, 'Delete for me', () {
              setState(() => _messages.remove(msg)); Navigator.pop(context);
            }, isDestructive: true),
            if (isMine)
              _optionTile(context, Icons.delete_forever_rounded, 'Delete for everyone', () {
                Navigator.pop(context);
                _deleteForEveryone(msg);
              }, isDestructive: true),
            _optionTile(context, Icons.info_outline_rounded, 'Message info', () => Navigator.pop(context)),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleReaction(Message msg, String emoji) async {
    final mine = widget.user.id;
    final removing = msg.reactions[mine] == emoji;
    setState(() {
      if (removing) {
        msg.reactions.remove(mine);
      } else {
        msg.reactions[mine] = emoji;
      }
    });
    try {
      if (removing) {
        await http.delete(
          Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}/${msg.id}/reaction'),
          headers: {'Authorization': 'Bearer ${widget.token}'},
        ).timeout(const Duration(seconds: 10));
      } else {
        await http.put(
          Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}/${msg.id}/reaction'),
          headers: {'Authorization': 'Bearer ${widget.token}', 'Content-Type': 'application/json'},
          body: jsonEncode({'emoji': emoji}),
        ).timeout(const Duration(seconds: 10));
      }
    } catch (_) {
      // Best-effort — the socket event from another device or a future
      // reload will reconcile if this particular request didn't land.
    }
  }

  Future<void> _deleteForEveryone(Message msg) async {
    final removedAt = _messages.indexOf(msg);
    setState(() { msg.deleted = true; msg.content = ''; });
    try {
      final res = await http.delete(
        Uri.parse('http://${Config.baseUrl}/api/v1/messages/${widget.roomId}/${msg.id}'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode != 200 && mounted) {
        // Roll back — the server didn't accept it (e.g. it wasn't actually
        // this user's message by the time the request landed).
        setState(() {
          if (removedAt >= 0 && removedAt < _messages.length) _messages[removedAt].deleted = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete message'), behavior: SnackBarBehavior.floating));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete message — check connection'), behavior: SnackBarBehavior.floating));
      }
    }
  }

  Widget _optionTile(BuildContext context, IconData icon, String label, VoidCallback onTap,
      {bool isDestructive = false}) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? AppColors.error : AppColors.brand),
      title: Text(label, style: TextStyle(color: isDestructive ? AppColors.error : context.cl.text)),
      onTap: onTap,
    );
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  @override
  void dispose() {
    // Only clear if we're still "it" — pushing straight from chat A into chat
    // B sets B's id before A's dispose runs, and A's dispose must not clobber it.
    if (ActiveChatTracker.currentRoomId == widget.roomId) {
      ActiveChatTracker.currentRoomId = null;
    }
    _msgCtrl.dispose(); _scrollCtrl.dispose(); _typingCtrl.dispose(); _searchCtrl.dispose();
    _typingClearTimer?.cancel();
    // Tell the peer we stopped typing before the socket drops, otherwise their
    // indicator hangs until its own timeout fires.
    _presenceSocket?.emit('stop_typing', {'roomId': widget.roomId, 'userId': widget.user.id});
    _socket?.disconnect(); _presenceSocket?.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: Stack(
        children: [
          ChatWallpaperView(
        child: Column(
        children: [
          Expanded(
            child: _loadingHistory
                ? Center(child: CircularProgressIndicator(color: AppColors.brand, strokeWidth: 2.5))
                : GestureDetector(
              onTap: () {
                FocusScope.of(context).unfocus();
                _closeAttachPanel();
              },
              child: ListView.builder(
                controller: _scrollCtrl,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                itemCount: _messages.length + (_typingUser.isNotEmpty ? 1 : 0),
                itemBuilder: (_, i) {
                  if (i == _messages.length) return _buildTypingIndicator(context);
                  final msg = _messages[i];
                  final showDateSep = i == 0 || !_isSameDay(_messages[i - 1].timestamp, msg.timestamp);
                  final isMe = msg.senderId == widget.user.id;
                  final prevSameSender = i > 0 &&
                      _messages[i - 1].senderId == msg.senderId &&
                      msg.timestamp.difference(_messages[i - 1].timestamp).inMinutes < 5 &&
                      _isSameDay(_messages[i - 1].timestamp, msg.timestamp);
                  return Column(
                    children: [
                      if (showDateSep) _buildDateSeparator(context, msg.timestamp),
                      _buildMessage(context, msg, isMe, prevSameSender),
                    ],
                  );
                },
              ),
            ),
          ),
          if (_editingMessage != null) _buildEditPreview(context)
          else if (_replyingTo != null) _buildReplyPreview(context),
          _buildInputBar(context),
          // ── Inline attachment panel (WhatsApp-style, below input bar) ──
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            child: _showAttachPanel
                ? SizedBox(
                    height: 360,
                    child: AttachmentPanel(
                      onGallery: _pickGallery,
                      onCamera: _pickCamera,
                      onLocation: () { _closeAttachPanel(); _comingSoon('Location sharing'); },
                      onContact: () { _closeAttachPanel(); _comingSoon('Contact sharing'); },
                      onDocument: () { _closeAttachPanel(); _comingSoon('Document sharing'); },
                      onPoll: () { _closeAttachPanel(); _comingSoon('Poll creation'); },
                      onEvent: () { _closeAttachPanel(); _comingSoon('Event creation'); },
                      onAudio: () { _closeAttachPanel(); _comingSoon('Audio recording'); },
                      onMediaTap: _sendMediaAsset,
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
          ),  // ChatWallpaperView
          if (_searching) _buildSearchOverlay(context),
        ],
      ),
    );
  }

  Widget _buildHeaderAvatar() {
    final hasImage = _avatarUrl != null && _avatarUrl!.isNotEmpty;
    return CircleAvatar(
      radius: 18,
      backgroundColor: AppColors.brand.withValues(alpha: 0.2),
      foregroundImage: hasImage ? NetworkImage(_avatarUrl!) : null,
      onForegroundImageError: hasImage ? (_, __) {} : null,
      // A photo-less group shows a "double profile" icon instead of an
      // initial — an initial reads as one person, which is misleading for a
      // room with many members.
      child: (!hasImage && widget.isGroup)
          ? const Icon(Icons.groups_rounded, size: 20, color: AppColors.brand)
          : Text(widget.roomName.isNotEmpty ? widget.roomName[0] : '?',
              style: const TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800, fontSize: 14)),
    );
  }

  /// Only reachable when widget.canEditAvatar is true, but the server is the
  /// real gate (teacher/class-rep/group-admin) — this is just the UI entry point.
  Future<void> _changeRoomAvatar() async {
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 85,
    );
    if (image == null || !mounted) return;

    setState(() => _uploadingAvatar = true);
    try {
      final request = http.MultipartRequest(
        'POST', Uri.parse('http://${Config.baseUrl}/api/v1/media/upload'),
      );
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      request.files.add(await http.MultipartFile.fromPath('file', image.path));

      final streamed = await request.send().timeout(const Duration(seconds: 30));
      final responseBody = await streamed.stream.bytesToString();
      if (!mounted) return;
      if (streamed.statusCode != 200) {
        setState(() => _uploadingAvatar = false);
        return;
      }

      final rawUrl = (jsonDecode(responseBody) as Map<String, dynamic>)['url'] as String? ?? '';
      final avatarUrl = rawUrl.replaceFirst('http://localhost', 'http://${Config.baseUrl}');

      final patchRes = await http.patch(
        Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/${widget.roomId}/avatar'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'avatarUrl': avatarUrl}),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;
      setState(() {
        _uploadingAvatar = false;
        if (patchRes.statusCode == 200) _avatarUrl = avatarUrl;
      });
    } catch (_) {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      titleSpacing: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back_ios_rounded, color: context.cl.text),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          GestureDetector(
            onTap: widget.isGroup && widget.canEditAvatar ? _changeRoomAvatar : null,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _buildHeaderAvatar(),
                if (_uploadingAvatar)
                  const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.roomName,
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: context.cl.text),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(
                  _typingUser.isNotEmpty
                      ? '$_typingUser is typing...'
                      : _isOffline
                          ? 'Offline — showing saved messages'
                          : widget.isGroup ? widget.subtitle
                              : widget.isOnline ? 'Online' : 'Last seen recently',
                  style: TextStyle(
                    fontSize: 11,
                    color: _typingUser.isNotEmpty ? AppColors.typing : context.cl.textHint,
                    fontStyle: _typingUser.isNotEmpty ? FontStyle.italic : FontStyle.normal,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(icon: Icon(Icons.videocam_rounded, color: context.cl.text), onPressed: () {}),
        IconButton(icon: Icon(Icons.call_rounded, color: context.cl.text), onPressed: () {}),
        PopupMenuButton<String>(
          icon: Icon(Icons.more_vert, color: context.cl.text),
          color: context.cl.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          onSelected: (val) {
            if (val == 'wallpaper') _showWallpaperPicker();
            if (val == 'search') setState(() => _searching = true);
            if (val == 'mute') _toggleMute();
          },
          itemBuilder: (_) => [
            PopupMenuItem(
              value: 'wallpaper',
              child: Row(children: [
                Icon(Icons.wallpaper_rounded, color: AppColors.brand, size: 20),
                const SizedBox(width: 12),
                Text('Wallpaper', style: TextStyle(color: context.cl.text, fontSize: 14)),
              ]),
            ),
            PopupMenuItem(
              value: 'search',
              child: Row(children: [
                Icon(Icons.search_rounded, color: context.cl.textHint, size: 20),
                const SizedBox(width: 12),
                Text('Search', style: TextStyle(color: context.cl.text, fontSize: 14)),
              ]),
            ),
            PopupMenuItem(
              value: 'mute',
              child: Row(children: [
                Icon(_muted ? Icons.notifications_active_rounded : Icons.notifications_off_rounded,
                    color: context.cl.textHint, size: 20),
                const SizedBox(width: 12),
                Text(_muted ? 'Unmute notifications' : 'Mute notifications',
                    style: TextStyle(color: context.cl.text, fontSize: 14)),
              ]),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDateSeparator(BuildContext context, DateTime dt) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: context.cl.card.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(12),
          ),
          child: Text(formatDateSeparator(dt),
              style: TextStyle(fontSize: 12, color: context.cl.textSec, fontWeight: FontWeight.w500)),
        ),
      ),
    );
  }

  Widget _buildMessage(BuildContext context, Message msg, bool isMe, bool sameSenderAsPrev) {
    return GestureDetector(
      onLongPress: msg.deleted ? null : () => _showMessageOptions(context, msg),
      onHorizontalDragEnd: msg.deleted ? null : (d) {
        if (d.primaryVelocity != null && d.primaryVelocity! > 200) setState(() => _replyingTo = msg);
      },
      child: Padding(
        padding: EdgeInsets.only(
          left: isMe ? 60 : 0, right: isMe ? 0 : 60,
          top: sameSenderAsPrev ? 2 : 6, bottom: 2,
        ),
        child: Row(
          mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMe && !sameSenderAsPrev) ...[
              _avatarCircle(
                radius: 14,
                name: msg.senderName,
                color: msg.senderColor,
                imageUrl: msg.senderAvatar,
              ),
              const SizedBox(width: 6),
            ] else if (!isMe) ...[
              const SizedBox(width: 34),
            ],
            Flexible(
              child: Container(
                decoration: BoxDecoration(
                  gradient: isMe ? AppColors.brandGradient : null,
                  color: isMe ? null : context.cl.card,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16), topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMe ? 16 : 0),
                    bottomRight: Radius.circular(isMe ? 0 : 16),
                  ),
                  boxShadow: [BoxShadow(
                    color: isMe
                        ? AppColors.brand.withValues(alpha: 0.25)
                        : Colors.black.withValues(alpha: context.isDark ? 0.2 : 0.06),
                    blurRadius: 6, offset: const Offset(0, 2),
                  )],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16), topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMe ? 16 : 0),
                    bottomRight: Radius.circular(isMe ? 0 : 16),
                  ),
                  child: msg.deleted
                      ? Padding(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 7),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.block_rounded, size: 15,
                                color: isMe ? Colors.black.withValues(alpha: 0.5) : context.cl.textHint),
                            const SizedBox(width: 6),
                            Text('This message was deleted',
                                style: TextStyle(fontSize: 14.5, fontStyle: FontStyle.italic,
                                    color: isMe ? Colors.black.withValues(alpha: 0.5) : context.cl.textHint)),
                          ]),
                        )
                      : msg.isImage
                      ? _buildImageBubbleContent(context, msg, isMe, sameSenderAsPrev)
                      : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (msg.replyTo != null)
                        Container(
                          padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
                          decoration: BoxDecoration(
                            color: isMe
                                ? Colors.black.withValues(alpha: 0.15)
                                : context.cl.cardLight,
                            border: Border(left: BorderSide(
                              color: isMe ? Colors.white.withValues(alpha: 0.5) : AppColors.brand, width: 3,
                            )),
                          ),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(msg.replyTo!.senderName,
                                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700,
                                    color: isMe ? Colors.white.withValues(alpha: 0.9) : AppColors.brand)),
                            const SizedBox(height: 2),
                            Text(msg.replyTo!.content, maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12.5, height: 1.3,
                                    color: isMe ? Colors.white.withValues(alpha: 0.75) : context.cl.textSec)),
                          ]),
                        ),

                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 7),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!isMe && widget.isGroup && !sameSenderAsPrev)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Text(msg.senderName,
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: msg.senderColor)),
                              ),
                            Text(msg.content,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w400,
                                  color: isMe ? AppColors.bgMain : context.cl.text,
                                  height: 1.4,
                                )),
                            if (msg.reactions.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              _buildReactionsRow(context, msg, isMe),
                            ],
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (msg.isEdited) ...[
                                  Text('edited',
                                      style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic,
                                          color: isMe ? Colors.black.withValues(alpha: 0.5) : context.cl.textHint)),
                                  const SizedBox(width: 4),
                                ],
                                Text(formatMessageTime(msg.timestamp),
                                    style: TextStyle(fontSize: 11,
                                        color: isMe ? Colors.black.withValues(alpha: 0.5) : context.cl.textHint)),
                                if (isMe) ...[const SizedBox(width: 4), _buildStatusIcon(msg)],
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReactionsRow(BuildContext context, Message msg, bool isMe) {
    // Group by emoji so 3 people reacting 👍 shows one chip with a count,
    // not three identical chips.
    final counts = <String, int>{};
    for (final e in msg.reactions.values) { counts[e] = (counts[e] ?? 0) + 1; }
    return Wrap(
      spacing: 4,
      children: counts.entries.map((e) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isMe ? Colors.black.withValues(alpha: 0.15) : context.cl.cardLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text('${e.key} ${e.value}', style: const TextStyle(fontSize: 12)),
      )).toList(),
    );
  }

  /// Avatar circle — shows photo when available, falls back to initials.
  Widget _avatarCircle({
    required double radius,
    required String name,
    required Color color,
    String? imageUrl,
  }) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: color,
      foregroundImage: (imageUrl != null && imageUrl.isNotEmpty)
          ? NetworkImage(imageUrl)
          : null,
      onForegroundImageError: (imageUrl != null && imageUrl.isNotEmpty)
          ? (_, __) {} : null,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(
          fontSize: radius * 0.72,
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildStatusIcon(Message msg) {
    // Distinct from "sending" — the server definitively refused this one,
    // not "still trying." Previously there was no way to tell the two apart.
    if (msg.failed) return const Icon(Icons.error_outline_rounded, size: 14, color: AppColors.error);
    switch (msg.status) {
      case MessageStatus.sending:
        // A clock, not a spinner: a queued message may sit here for hours until
        // the network returns, and a spinner would promise it's on its way.
        return const Icon(Icons.schedule_rounded, size: 14, color: Colors.black38);
      case MessageStatus.sent:
        return const Icon(Icons.check, size: 15, color: Colors.black38);
      case MessageStatus.delivered:
        return const Icon(Icons.done_all, size: 15, color: Colors.black38);
      case MessageStatus.read:
        return const Icon(Icons.done_all, size: 15, color: Color(0xFF2563EB));
    }
  }

  Widget _buildStatusIconOnImage(Message msg) {
    if (msg.failed) return const Icon(Icons.error_outline_rounded, size: 14, color: Color(0xFFFF8A80));
    switch (msg.status) {
      case MessageStatus.sending:
        return const Icon(Icons.schedule_rounded, size: 14, color: Colors.white70);
      case MessageStatus.sent:
        return const Icon(Icons.check, size: 15, color: Colors.white70);
      case MessageStatus.delivered:
        return const Icon(Icons.done_all, size: 15, color: Colors.white70);
      case MessageStatus.read:
        return const Icon(Icons.done_all, size: 15, color: Color(0xFF93C5FD));
    }
  }

  /// Image bubble — image fills the bubble, timestamp overlays at bottom-right.
  Widget _buildImageBubbleContent(
      BuildContext context, Message msg, bool isMe, bool sameSenderAsPrev) {
    final borderRadius = BorderRadius.only(
      topLeft: const Radius.circular(16), topRight: const Radius.circular(16),
      bottomLeft: Radius.circular(isMe ? 16 : 0),
      bottomRight: Radius.circular(isMe ? 0 : 16),
    );
    return Stack(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Sender name for incoming group messages
            if (!isMe && widget.isGroup && !sameSenderAsPrev)
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 2),
                child: Text(msg.senderName,
                    style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700, color: msg.senderColor)),
              ),
            // Image
            ClipRRect(
              borderRadius: (!isMe && widget.isGroup && !sameSenderAsPrev)
                  ? BorderRadius.only(
                      bottomLeft: Radius.circular(isMe ? 16 : 0),
                      bottomRight: Radius.circular(isMe ? 0 : 16),
                    )
                  : borderRadius,
              child: msg.localImagePath != null
                  ? Image.file(
                      File(msg.localImagePath!),
                      width: 224,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, stack) => _imagePlaceholder(),
                    )
                  : Image.network(
                      msg.imageUrl!,
                      width: 224,
                      fit: BoxFit.cover,
                      loadingBuilder: (_, child, progress) => progress == null
                          ? child
                          : SizedBox(
                              width: 224, height: 180,
                              child: Center(
                                child: CircularProgressIndicator(
                                  color: AppColors.brand,
                                  value: progress.expectedTotalBytes != null
                                      ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                                      : null,
                                ),
                              ),
                            ),
                      errorBuilder: (ctx, err, stack) => _imagePlaceholder(),
                    ),
            ),
          ],
        ),
        // Gradient + timestamp overlay
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: Container(
            height: 40,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter, end: Alignment.topCenter,
                colors: [Colors.black54, Colors.transparent],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 7, right: 8,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formatMessageTime(msg.timestamp),
                style: const TextStyle(
                  fontSize: 11, color: Colors.white, fontWeight: FontWeight.w500,
                  shadows: [Shadow(color: Colors.black45, blurRadius: 4)],
                ),
              ),
              if (isMe) ...[
                const SizedBox(width: 3),
                _buildStatusIconOnImage(msg),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _imagePlaceholder() => Container(
    width: 224, height: 160,
    color: Colors.black12,
    child: const Center(
      child: Icon(Icons.broken_image_rounded, color: Colors.white54, size: 40),
    ),
  );

  Widget _buildTypingIndicator(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 40, bottom: 6, top: 4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(radius: 14, backgroundColor: AppColors.brand.withValues(alpha: 0.3),
            child: Text(_typingUser.isNotEmpty ? _typingUser[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 10, color: AppColors.brand, fontWeight: FontWeight.w700))),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: context.cl.card,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16), topRight: Radius.circular(16), bottomRight: Radius.circular(16),
              ),
            ),
            child: AnimatedBuilder(
              animation: _typingCtrl,
              builder: (ctx, _) => Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(3, (i) => Transform.translate(
                  offset: Offset(0, _dotAnims[i].value),
                  child: Container(
                    width: 7, height: 7, margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
                  ),
                )),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReplyPreview(BuildContext context) {
    return Container(
      color: context.cl.surface,
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Container(width: 3, height: 40, color: AppColors.brand, margin: const EdgeInsets.only(right: 10)),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_replyingTo!.senderName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.brand)),
              const SizedBox(height: 2),
              Text(_replyingTo!.content, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13.5, color: context.cl.textSec)),
            ]),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 20, color: context.cl.textHint),
            onPressed: () => setState(() => _replyingTo = null),
          ),
        ],
      ),
    );
  }

  Widget _buildEditPreview(BuildContext context) {
    return Container(
      color: context.cl.surface,
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Icon(Icons.edit_outlined, size: 18, color: AppColors.brand),
          const SizedBox(width: 10),
          Expanded(
            child: Text('Editing message',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.brand)),
          ),
          IconButton(
            icon: Icon(Icons.close, size: 20, color: context.cl.textHint),
            onPressed: () => setState(() { _editingMessage = null; _msgCtrl.clear(); }),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchOverlay(BuildContext context) {
    return Positioned.fill(
      child: Material(
        color: context.cl.bg,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(children: [
                  IconButton(icon: Icon(Icons.arrow_back_ios_rounded, color: context.cl.text), onPressed: _closeSearch),
                  Expanded(
                    child: TextField(
                      controller: _searchCtrl,
                      autofocus: true,
                      onChanged: _performSearch,
                      style: TextStyle(color: context.cl.text, fontSize: 16),
                      decoration: InputDecoration(
                        hintText: 'Search this chat...',
                        hintStyle: TextStyle(color: context.cl.textHint),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  if (_searchLoading)
                    const Padding(
                      padding: EdgeInsets.only(right: 12),
                      child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                    ),
                ]),
              ),
              Divider(height: 1, color: context.cl.divider),
              Expanded(
                child: _searchResults.isEmpty
                    ? Center(
                        child: Text(
                          _searchCtrl.text.trim().length < 2 ? 'Type at least 2 characters' : 'No matches',
                          style: TextStyle(color: context.cl.textHint),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _searchResults.length,
                        itemBuilder: (_, i) {
                          final r = _searchResults[i];
                          return ListTile(
                            title: Text(r['senderName'] as String? ?? 'Unknown',
                                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: context.cl.text)),
                            subtitle: Text(r['content'] as String? ?? '', maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: context.cl.textSec)),
                            onTap: () => _jumpToSearchResult(r),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 10),
      color: context.cl.surface,
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: context.cl.card,
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: context.cl.divider),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    IconButton(
                      icon: Icon(Icons.emoji_emotions_outlined, color: context.cl.textHint),
                      onPressed: () {},
                    ),
                    Expanded(
                      child: TextField(
                        controller: _msgCtrl,
                        onChanged: _onTypingChanged,
                        onTap: _closeAttachPanel,
                        onSubmitted: (_) => _sendMessage(),
                        maxLines: null, textInputAction: TextInputAction.newline,
                        style: TextStyle(color: context.cl.text, fontSize: 16),
                        decoration: InputDecoration(
                          hintText: 'Type a message...',
                          hintStyle: TextStyle(color: context.cl.textHint, fontSize: 16),
                          border: InputBorder.none, filled: false,
                          contentPadding: const EdgeInsets.symmetric(vertical: 11),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.attach_file_rounded,
                        color: _showAttachPanel ? AppColors.brand : context.cl.textHint,
                      ),
                      onPressed: _toggleAttachPanel,
                    ),
                    if (!_isTyping)
                      IconButton(
                        icon: Icon(Icons.camera_alt_outlined, color: context.cl.textHint),
                        onPressed: _pickCamera,
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
              child: GestureDetector(
                key: ValueKey(_isTyping),
                onTap: _isTyping ? _sendMessage : null,
                child: Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    gradient: _isTyping ? AppColors.brandGradient : null,
                    color: _isTyping ? null : context.cl.card,
                    shape: BoxShape.circle,
                    border: _isTyping ? null : Border.all(color: context.cl.divider),
                    boxShadow: _isTyping
                        ? [BoxShadow(color: AppColors.brand.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 3))]
                        : [],
                  ),
                  child: Icon(
                    _isTyping ? Icons.send_rounded : Icons.mic_rounded,
                    color: _isTyping ? AppColors.bgMain : context.cl.textHint, size: 22,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
