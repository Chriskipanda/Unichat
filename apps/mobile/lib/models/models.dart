import 'package:flutter/material.dart';
import '../config.dart';

// ── Tenant (SaaS) ─────────────────────────────────────────────
class TenantModel {
  final String id;
  final String slug;
  final String name;
  final String shortName;
  final String location;
  final String type; // university | college | institute
  final bool isVerified;
  final Color accentColor;

  const TenantModel({
    required this.id,
    required this.slug,
    required this.name,
    required this.shortName,
    required this.location,
    required this.type,
    this.isVerified = true,
    this.accentColor = AppColors.brand,
  });

  factory TenantModel.fromJson(Map<String, dynamic> json) {
    final name = (json['name'] as String?) ?? '';
    final shortName = (json['shortName'] as String?) ??
        _deriveShortName(name);
    return TenantModel(
      id: json['id']?.toString() ?? '',
      slug: (json['slug'] as String?) ?? '',
      name: name,
      shortName: shortName,
      location: (json['location'] as String?) ?? '',
      type: (json['type'] as String?) ?? 'institution',
    );
  }

  static String _deriveShortName(String name) {
    final words = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '';
    if (words.length == 1) {
      return name.substring(0, name.length.clamp(0, 4)).toUpperCase();
    }
    return words.map((w) => w[0]).take(4).join('').toUpperCase();
  }

  Map<String, dynamic> toJson() => {
        'id': id, 'slug': slug, 'name': name,
        'shortName': shortName, 'location': location, 'type': type,
      };
}

// ── User ──────────────────────────────────────────────────────
class UserModel {
  final String id;
  final String fullName;
  final String role;
  final Map<String, dynamic> tenant;
  final String? email;
  final String? phone;
  final String? studentId;
  final String? staffId;
  final String? avatarUrl;

  const UserModel({
    required this.id,
    required this.fullName,
    required this.role,
    required this.tenant,
    this.email,
    this.phone,
    this.studentId,
    this.staffId,
    this.avatarUrl,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id']?.toString() ?? '',
        fullName: json['fullName'] ?? 'User',
        role: json['role'] ?? 'student',
        tenant: Map<String, dynamic>.from(json['tenant'] ?? {}),
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        studentId: json['studentId'] as String?,
        staffId: json['staffId'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id, 'fullName': fullName, 'role': role, 'tenant': tenant,
        'email': email, 'phone': phone,
        'studentId': studentId, 'staffId': staffId, 'avatarUrl': avatarUrl,
      };

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return fullName.isNotEmpty ? fullName[0].toUpperCase() : '?';
  }

  Color get avatarColor {
    const colors = [
      Color(0xFFD97706), Color(0xFF7C3AED), Color(0xFF059669),
      Color(0xFFDC2626), Color(0xFF2563EB), Color(0xFF0891B2),
      Color(0xFFDB2777), Color(0xFF65A30D),
    ];
    return colors[fullName.hashCode.abs() % colors.length];
  }

  String get roleLabel {
    switch (role.toLowerCase()) {
      case 'admin': return 'Admin';
      case 'lecturer': return 'Lecturer';
      case 'teacher':
      case 'staff': return 'Teacher';
      default: return 'Student';
    }
  }
}

// ── Message ───────────────────────────────────────────────────
enum MessageStatus { sending, sent, delivered, read }

/// Media messages carry a URL in `content`, so anywhere a bitmap can't be drawn
/// — chat-list previews, reply quotes — shows this label instead of the URL.
bool isMediaType(String? type) => type == 'image' || type == 'video';
String mediaLabelFor(String? type) => type == 'video' ? '🎥 Video' : '📷 Photo';

class Message {
  /// Server-assigned UUID. Optimistic sends start with a temporary local id and
  /// adopt the server's once it responds — replying to or deleting a message
  /// sends this id back, so a stale temp id would be rejected.
  String id;
  final String content;
  final String senderId;
  final String senderName;
  final DateTime timestamp;
  MessageStatus status;
  final Message? replyTo;
  final String? localImagePath;  // optimistic local file before upload
  String? imageUrl;              // served URL after upload (mutable so sender can update after 201)
  final String? senderAvatar;    // sender's profile photo URL

  Message({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderName,
    required this.timestamp,
    this.status = MessageStatus.sending,
    this.replyTo,
    this.localImagePath,
    this.imageUrl,
    this.senderAvatar,
  });

  bool get isImage => localImagePath != null || imageUrl != null;

  static String get _origin =>
      Config.baseUrl.startsWith('http') ? Config.baseUrl : 'http://${Config.baseUrl}';

  /// Single parser for both socket pushes and REST history, so a message looks
  /// identical whether it arrived live or was loaded from history.
  factory Message.fromJson(
    Map<String, dynamic> data, {
    MessageStatus status = MessageStatus.delivered,
  }) {
    final type = data['type'] as String?;
    final content = data['content'] as String? ?? '';
    // Image/video messages store a relative URL in content; build full URL
    final isMedia = isMediaType(type);

    return Message(
      id: data['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      content: isMedia ? mediaLabelFor(type) : content,
      senderId: data['senderId']?.toString() ?? '',
      senderName: data['senderName'] ?? 'Unknown',
      // Server sends UTC ISO timestamps; convert to local right here so every
      // downstream formatter (and "same day" comparisons) works in the
      // device's own timezone instead of the server's.
      timestamp: data['timestamp'] != null
          ? (DateTime.tryParse(data['timestamp'].toString())?.toLocal() ?? DateTime.now())
          : DateTime.now(),
      status: status,
      imageUrl: isMedia ? '$_origin$content' : (data['imageUrl'] as String?),
      senderAvatar: data['senderAvatar'] as String?,
      replyTo: _parseQuote(data['replyTo']),
    );
  }

  /// The quoted message shown above a reply. Only needs enough to render the
  /// preview strip — never becomes a full bubble.
  static Message? _parseQuote(dynamic raw) {
    if (raw is! Map) return null;
    final q = Map<String, dynamic>.from(raw);
    final type = q['type'] as String?;
    return Message(
      id: q['id']?.toString() ?? '',
      content: isMediaType(type) ? mediaLabelFor(type) : (q['content'] as String? ?? ''),
      senderId: q['senderId']?.toString() ?? '',
      senderName: q['senderName'] as String? ?? 'Unknown',
      timestamp: DateTime.now(),
      status: MessageStatus.read,
    );
  }

  factory Message.fromSocket(Map<String, dynamic> data) => Message.fromJson(data);

  Color get senderColor {
    const colors = [
      Color(0xFFFBBC05), Color(0xFF818CF8), Color(0xFF34D399),
      Color(0xFFF87171), Color(0xFF60A5FA), Color(0xFF38BDF8),
      Color(0xFFF472B6), Color(0xFFA3E635),
    ];
    return colors[senderId.hashCode.abs() % colors.length];
  }
}

// ── Chat Preview ──────────────────────────────────────────────
class ChatPreview {
  final String id;
  final String name;
  final String subtitle;
  final String lastMessage;
  final String lastMessageType; // 'text' | 'image' | 'video'
  final String lastSender;
  final String? lastSenderId;
  final String? avatarUrl;       // profile photo for DMs, null for groups
  final DateTime lastMessageTime;
  final int unreadCount;
  final bool isOnline;
  final bool isGroup;
  // Whether the signed-in user may change this room's photo — a teacher,
  // class rep, or group owner/admin. Server-enforced; this only drives
  // whether the client shows the edit affordance.
  final bool canEditAvatar;

  const ChatPreview({
    required this.id,
    required this.name,
    this.subtitle = '',
    required this.lastMessage,
    this.lastMessageType = 'text',
    this.lastSender = '',
    this.lastSenderId,
    this.avatarUrl,
    required this.lastMessageTime,
    this.unreadCount = 0,
    this.isOnline = false,
    this.isGroup = false,
    this.canEditAvatar = false,
  });

  /// What the row shows: an upload URL is meaningless to a reader, so media
  /// collapses to a label.
  String get preview =>
      isMediaType(lastMessageType) ? mediaLabelFor(lastMessageType) : lastMessage;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  Color get avatarColor {
    const colors = [
      Color(0xFFD97706), Color(0xFF7C3AED), Color(0xFF059669),
      Color(0xFFDC2626), Color(0xFF2563EB), Color(0xFF0891B2),
      Color(0xFFDB2777), Color(0xFF65A30D),
    ];
    return colors[name.hashCode.abs() % colors.length];
  }
}

// ── Academic Group ────────────────────────────────────────────
class AcademicGroup {
  final String id;
  final String name;
  final String type;
  final int memberCount;
  final String lastActivity;
  final IconData icon;

  const AcademicGroup({
    required this.id,
    required this.name,
    required this.type,
    required this.memberCount,
    required this.lastActivity,
    required this.icon,
  });
}

// ── Club ─────────────────────────────────────────────────────
class ClubModel {
  final String id;
  final String name;
  final String category;
  final String description;
  final int memberCount;
  final bool isJoined;
  final String activity;
  final IconData icon;
  final Color color;

  const ClubModel({
    required this.id,
    required this.name,
    required this.category,
    required this.description,
    required this.memberCount,
    required this.activity,
    required this.icon,
    required this.color,
    this.isJoined = false,
  });
}

// ── Date helpers ──────────────────────────────────────────────
String formatMessageTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

String formatChatTime(DateTime dt) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(DateTime(dt.year, dt.month, dt.day)).inDays;
  if (diff == 0) return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dt.weekday - 1];
  return '${dt.day}/${dt.month}/${dt.year % 100}';
}

String formatDateSeparator(DateTime dt) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(DateTime(dt.year, dt.month, dt.day)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return '${dt.day} ${m[dt.month - 1]} ${dt.year}';
}
