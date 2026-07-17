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
  final UserModel user;
  final String token;

  const ChatScreen({
    super.key,
    required this.roomId, required this.roomName, required this.subtitle,
    required this.isGroup, required this.isOnline,
    this.avatarUrl, this.canEditAvatar = false,
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
  String? _avatarUrl;
  bool _uploadingAvatar = false;
  io.Socket? _socket;
  io.Socket? _presenceSocket;
  Timer? _typingClearTimer;   // receiver side: drops a stale "is typing…"
  DateTime? _lastTypingEmit;  // sender side: throttles the typing event

  late AnimationController _typingCtrl;
  late List<Animation<double>> _dotAnims;

  @override
  void initState() {
    super.initState();
    ActiveChatTracker.currentRoomId = widget.roomId;
    _avatarUrl = widget.avatarUrl;
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
    if (!mounted || pending.isEmpty) return;
    setState(() {
      for (final p in pending) {
        if (_messages.any((m) => m.id == p.tempId)) continue;
        _messages.add(Message(
          id: p.tempId,
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

  Message _messageFrom(Map<String, dynamic> json) => Message.fromJson(
        json,
        status: json['senderId'] == widget.user.id
            ? MessageStatus.read
            : MessageStatus.delivered,
      );

  void _connectSocket() {
    try {
      _socket = io.io('http://${Config.baseUrl}', <String, dynamic>{
        // Polling as a fallback, not just websocket: some networks/proxies
        // block the websocket upgrade outright, which otherwise means this
        // socket never connects at all rather than degrading gracefully.
        'transports': ['websocket', 'polling'], 'autoConnect': true,
        'reconnection': true, 'reconnectionAttempts': 1000000,
        'reconnectionDelay': 1000, 'reconnectionDelayMax': 5000,
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
      // Upgrade our own sent message(s) from single to double grey tick once the
      // server confirms someone else's socket is in the room.
      _socket!.on('message_delivered', (data) {
        if (!mounted) return;
        final d = Map<String, dynamic>.from(data);
        if (d['roomId'] != widget.roomId) return;
        final messageId = d['messageId'];
        setState(() {
          for (final m in _messages) {
            if (m.id == messageId && m.senderId == widget.user.id && m.status == MessageStatus.sent) {
              m.status = MessageStatus.delivered;
            }
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
            if (m.senderId == widget.user.id && m.status != MessageStatus.read) {
              m.status = MessageStatus.read;
            }
          }
        });
      });
      _presenceSocket = io.io('http://${Config.baseUrl}', <String, dynamic>{
        'transports': ['websocket', 'polling'], 'autoConnect': true, 'path': '/presence/',
        'reconnection': true, 'reconnectionAttempts': 1000000,
        'reconnectionDelay': 1000, 'reconnectionDelayMax': 5000,
        'query': {'userId': widget.user.id, 'tenantId': widget.user.tenant['id']},
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

  Future<void> _sendViaHttp(Message msg, Message? replyTo) async {
    try {
      final body = <String, dynamic>{
        'content': msg.content,
        'senderId': widget.user.id,
        'senderName': widget.user.fullName,
        'tenantId': widget.user.tenant['id'],
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
      if (res.statusCode == 201) {
        // Adopt the server's UUID — replying to or deleting this message sends
        // the id back, and the temporary local one would be rejected.
        final sent = (jsonDecode(res.body)['message'] as Map?)?.cast<String, dynamic>();
        final serverId = sent?['id'] as String?;
        if (serverId != null) msg.id = serverId;
        // Single grey tick — real delivered/read promotion comes from the
        // server via 'message_delivered'/'peer_read' (see _connectSocket),
        // not a guess-and-hope timer.
        setState(() => msg.status = MessageStatus.sent);
        if (sent != null) await ChatCache.appendMessage(widget.roomId, sent);
      }
    } catch (_) {
      // No network. Persist it so it survives leaving the screen or killing the
      // app, and send it when the connection comes back.
      await Outbox.enqueue(PendingMessage(
        tempId: msg.id,
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
        delivered.status = MessageStatus.sent;
      });
      await ChatCache.appendMessage(widget.roomId, entry.value);
    }
    if (mounted && !result.stillOffline) setState(() => _isOffline = false);
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
        ..fields['senderId'] = widget.user.id
        ..fields['senderName'] = widget.user.fullName
        ..fields['tenantId'] = widget.user.tenant['id']?.toString() ?? ''
        ..files.add(await http.MultipartFile.fromPath('file', file.path));

      final streamed = await req.send().timeout(const Duration(seconds: 60));

      if (!mounted) return;

      if (streamed.statusCode == 201) {
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
        // not a guess-and-hope timer.
        setState(() => msg.status = MessageStatus.sent);
        if (sent != null) await ChatCache.appendMessage(widget.roomId, sent);
      }
    } catch (_) {
      // Network error — stays in sending state so user knows it failed
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
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: context.cl.card, shape: BoxShape.circle),
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
            if (msg.senderId == widget.user.id)
              _optionTile(context, Icons.delete_outline_rounded, 'Delete', () {
                setState(() => _messages.remove(msg)); Navigator.pop(context);
              }, isDestructive: true),
            _optionTile(context, Icons.info_outline_rounded, 'Message info', () => Navigator.pop(context)),
          ],
        ),
      ),
    );
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
    _msgCtrl.dispose(); _scrollCtrl.dispose(); _typingCtrl.dispose();
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
      body: ChatWallpaperView(
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
          if (_replyingTo != null) _buildReplyPreview(context),
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
                Icon(Icons.notifications_off_rounded, color: context.cl.textHint, size: 20),
                const SizedBox(width: 12),
                Text('Mute notifications', style: TextStyle(color: context.cl.text, fontSize: 14)),
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
      onLongPress: () => _showMessageOptions(context, msg),
      onHorizontalDragEnd: (d) {
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
                  child: msg.isImage
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
                            const SizedBox(height: 4),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(formatMessageTime(msg.timestamp),
                                    style: TextStyle(fontSize: 11,
                                        color: isMe ? Colors.black.withValues(alpha: 0.5) : context.cl.textHint)),
                                if (isMe) ...[const SizedBox(width: 4), _buildStatusIcon(msg.status)],
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

  Widget _buildStatusIcon(MessageStatus status) {
    switch (status) {
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

  Widget _buildStatusIconOnImage(MessageStatus status) {
    switch (status) {
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
                _buildStatusIconOnImage(msg.status),
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
