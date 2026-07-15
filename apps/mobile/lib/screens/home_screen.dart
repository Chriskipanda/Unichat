import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../services/chat_cache.dart';
import '../widgets/chat_wallpaper.dart';
import '../models/models.dart';
import 'chat_screen.dart';
import 'profile_screen.dart';
import 'tenant_screen.dart';

class HomeScreen extends StatefulWidget {
  final UserModel user;
  final String token;

  const HomeScreen({super.key, required this.user, required this.token});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  bool _isSearching = false;
  final _searchCtrl = TextEditingController();

  bool _loadingRooms = true;
  bool _loadingClubs = true;
  bool _isOffline = false; // showing cached rooms rather than a live fetch
  String _roomsError = '';
  String _clubsError = '';

  List<ChatPreview> _chats = [];
  List<AcademicGroup> _groups = [];
  List<ClubModel> _clubs = [];

  Map<String, DateTime> _lastRead = {};
  String _activeFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadLastRead().then((_) { if (mounted) _loadRooms(); });
    _loadClubs();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // ── Data fetching ─────────────────────────────────────────────

  Future<void> _loadLastRead() async {
    final prefs = await SharedPreferences.getInstance();
    final lastRead = <String, DateTime>{};
    for (final key in prefs.getKeys().where((k) => k.startsWith('last_read_'))) {
      final val = prefs.getString(key);
      if (val != null) {
        final dt = DateTime.tryParse(val);
        if (dt != null) lastRead[key.replaceFirst('last_read_', '')] = dt;
      }
    }
    if (mounted) setState(() => _lastRead = lastRead);
  }

  Future<void> _loadRooms() async {
    if (_chats.isEmpty) setState(() { _loadingRooms = true; });
    setState(() { _roomsError = ''; });
    try {
      final res = await http.get(
        Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final rooms = (data['rooms'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
        _applyRooms(rooms);
        setState(() { _loadingRooms = false; _isOffline = false; });
        await ChatCache.saveRooms(rooms);
      } else {
        setState(() { _loadingRooms = false; _roomsError = 'Failed to load chats.'; });
      }
    } catch (_) {
      // Offline (or the server is unreachable). Showing what we last synced
      // beats an error page over chats the user has already read.
      final cached = await ChatCache.loadRooms();
      if (!mounted) return;
      if (cached != null && cached.isNotEmpty) {
        _applyRooms(cached);
        setState(() { _loadingRooms = false; _isOffline = true; _roomsError = ''; });
      } else {
        setState(() { _loadingRooms = false; _roomsError = 'Network error.'; });
      }
    }
  }

  /// Turn the server's room payload into view models. Shared by the network and
  /// cache paths so cached chats render identically to live ones.
  void _applyRooms(List<Map<String, dynamic>> rooms) {
        final chats = rooms.map((r) {
          final type = r['type'] as String? ?? '';
          final isGroup = type != 'private';
          final subtitle = (r['subtitle'] as String?)
              ?? (isGroup ? '${r['memberCount']} members' : '');
          final roomId = r['id'] as String;
          final lastSender = (r['lastSenderName'] as String?) ?? '';
          final lastMsgAt = DateTime.tryParse((r['lastMessageAt'] as String?) ?? '');
          // Prefer the server's count; fall back to a local 0/1 heuristic only
          // when it's absent (an older cached payload won't carry the field).
          final serverUnread = (r['unreadCount'] as num?)?.toInt();
          int unreadCount;
          if (serverUnread != null) {
            unreadCount = serverUnread;
          } else {
            // Local fallback: 1 if last message is from someone else and newer than last local read
            final lastRead = _lastRead[roomId] ?? DateTime(0);
            unreadCount = (lastMsgAt != null
                && lastSender.isNotEmpty
                && lastSender != widget.user.fullName
                && lastMsgAt.isAfter(lastRead)) ? 1 : 0;
          }
          return ChatPreview(
            id: roomId,
            name: r['name'] as String,
            subtitle: subtitle,
            lastMessage: (r['lastMessage'] as String?) ?? '',
            lastMessageType: (r['lastMessageType'] as String?) ?? 'text',
            lastSender: lastSender,
            lastSenderId: r['lastSenderId'] as String?,
            avatarUrl: r['avatarUrl'] as String?,
            lastMessageTime: lastMsgAt ?? DateTime.now(),
            isGroup: isGroup,
            unreadCount: unreadCount,
          );
        }).toList();

        final groups = rooms
            .where((r) => (r['type'] as String? ?? '') != 'private')
            .map((r) {
              final type = r['type'] as String? ?? 'group';
              IconData icon;
              String displayType;
              switch (type) {
                case 'cohort':   displayType = 'Cohort'; icon = Icons.group_rounded;          break;
                case 'course':   displayType = 'Course'; icon = Icons.menu_book_rounded;      break;
                case 'club':     displayType = 'Club';   icon = Icons.groups_rounded;         break;
                default:         displayType = 'Group';  icon = Icons.forum_rounded;          break;
              }
              return AcademicGroup(
                id: r['id'] as String,
                name: r['name'] as String,
                type: displayType,
                memberCount: (r['memberCount'] as int?) ?? 0,
                lastActivity: _formatLastActivity((r['lastMessageAt'] as String?)),
                icon: icon,
              );
            }).toList();

    setState(() { _chats = chats; _groups = groups; });
  }

  Future<void> _loadClubs() async {
    setState(() { _loadingClubs = true; _clubsError = ''; });
    try {
      final res = await http.get(
        Uri.parse('http://${Config.baseUrl}/api/v1/student/clubs'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final clubs = (data['clubs'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>()
            .map((c) {
              final name = c['name'] as String? ?? '';
              final desc = (c['description'] as String?) ?? '';
              return ClubModel(
                id: c['id'] as String,
                name: name,
                category: _clubCategory(name),
                description: desc,
                memberCount: (c['memberCount'] as int?) ?? 0,
                activity: desc.isNotEmpty ? desc : 'Join to see updates',
                icon: _clubIcon(name),
                color: _clubColor((c['id'] as String?) ?? name),
                isJoined: (c['isJoined'] as bool?) ?? false,
              );
            }).toList();

        setState(() { _clubs = clubs; _loadingClubs = false; });
      } else {
        setState(() { _loadingClubs = false; _clubsError = 'Failed to load clubs.'; });
      }
    } catch (_) {
      if (mounted) setState(() { _loadingClubs = false; _clubsError = 'Network error.'; });
    }
  }

  Future<void> _toggleClubMembership(ClubModel club, int index) async {
    final wasJoined = club.isJoined;
    setState(() {
      _clubs[index] = ClubModel(
        id: club.id, name: club.name, category: club.category,
        description: club.description, memberCount: wasJoined ? club.memberCount - 1 : club.memberCount + 1,
        activity: club.activity, icon: club.icon, color: club.color, isJoined: !wasJoined,
      );
    });

    try {
      if (wasJoined) {
        await http.delete(
          Uri.parse('http://${Config.baseUrl}/api/v1/student/clubs/${club.id}/leave'),
          headers: {'Authorization': 'Bearer ${widget.token}'},
        ).timeout(const Duration(seconds: 10));
      } else {
        await http.post(
          Uri.parse('http://${Config.baseUrl}/api/v1/student/clubs/${club.id}/join'),
          headers: {'Authorization': 'Bearer ${widget.token}'},
        ).timeout(const Duration(seconds: 10));
      }
    } catch (_) {
      // Revert on failure
      if (mounted) {
        setState(() {
          _clubs[index] = club;
        });
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  String _formatLastActivity(String? isoString) {
    if (isoString == null) return 'No activity';
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return 'No activity';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hrs ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays} days ago';
  }

  IconData _clubIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains('code') || n.contains('tech') || n.contains('program') || n.contains('comput')) return Icons.code_rounded;
    if (n.contains('robot')) return Icons.precision_manufacturing_rounded;
    if (n.contains('debate') || n.contains('speech') || n.contains('speak')) return Icons.record_voice_over_rounded;
    if (n.contains('art') || n.contains('culture') || n.contains('music') || n.contains('creative')) return Icons.palette_rounded;
    if (n.contains('sport') || n.contains('football') || n.contains('basket') || n.contains('fitness') || n.contains('athlet')) return Icons.sports_soccer_rounded;
    if (n.contains('business') || n.contains('entrepreneur') || n.contains('startup')) return Icons.rocket_launch_rounded;
    if (n.contains('science') || n.contains('research') || n.contains('lab')) return Icons.science_rounded;
    if (n.contains('media') || n.contains('photo') || n.contains('film') || n.contains('journal')) return Icons.camera_alt_rounded;
    if (n.contains('environ') || n.contains('green') || n.contains('eco')) return Icons.eco_rounded;
    return Icons.groups_rounded;
  }

  String _clubCategory(String name) {
    final n = name.toLowerCase();
    if (n.contains('code') || n.contains('tech') || n.contains('robot') || n.contains('comput')) return 'Technology';
    if (n.contains('debate') || n.contains('leader')) return 'Leadership';
    if (n.contains('art') || n.contains('culture') || n.contains('music') || n.contains('creative')) return 'Creative';
    if (n.contains('sport') || n.contains('fitness')) return 'Sports';
    if (n.contains('business') || n.contains('entrepreneur')) return 'Business';
    if (n.contains('science')) return 'Science';
    return 'General';
  }

  Color _clubColor(String seed) {
    const colors = [
      Color(0xFF6366F1), Color(0xFF0891B2), Color(0xFFD97706),
      Color(0xFFDB2777), Color(0xFF059669), Color(0xFF7C3AED),
      Color(0xFF0F766E), Color(0xFFDC2626),
    ];
    return colors[seed.hashCode.abs() % colors.length];
  }

  // ── New Chat ──────────────────────────────────────────────────

  void _showNewChatSheet() {
    final searchCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        int tabIndex = 0; // 0 = Groups, 1 = People
        List<Map<String, dynamic>> peopleResults = [];
        bool loadingPeople = false;
        String peopleError = '';

        return StatefulBuilder(
          builder: (ctx, setModal) {
            final query = searchCtrl.text.toLowerCase();
            final filteredGroups = _chats
                .where((c) => query.isEmpty || c.name.toLowerCase().contains(query))
                .toList();

            Future<void> searchPeople(String q) async {
              setModal(() { loadingPeople = true; peopleError = ''; });
              try {
                final uri = Uri.parse(
                  'http://${Config.baseUrl}/api/v1/student/users?search=${Uri.encodeQueryComponent(q)}&limit=30',
                );
                final res = await http.get(
                  uri,
                  headers: {'Authorization': 'Bearer ${widget.token}'},
                ).timeout(const Duration(seconds: 10));
                if (!ctx.mounted) return;
                if (res.statusCode == 200) {
                  final data = jsonDecode(res.body) as Map<String, dynamic>;
                  setModal(() {
                    peopleResults = List<Map<String, dynamic>>.from(data['users'] ?? []);
                    loadingPeople = false;
                  });
                } else {
                  setModal(() { loadingPeople = false; peopleError = 'Failed to load people.'; });
                }
              } catch (_) {
                if (ctx.mounted) setModal(() { loadingPeople = false; peopleError = 'Network error.'; });
              }
            }

            Future<void> openDm(Map<String, dynamic> person) async {
              Navigator.pop(ctx);
              try {
                final res = await http.post(
                  Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/dm'),
                  headers: {
                    'Authorization': 'Bearer ${widget.token}',
                    'Content-Type': 'application/json',
                  },
                  body: jsonEncode({'targetUserId': person['id']}),
                ).timeout(const Duration(seconds: 10));
                if (!mounted) return;
                if (res.statusCode == 200 || res.statusCode == 201) {
                  final data = jsonDecode(res.body) as Map<String, dynamic>;
                  final room = data['room'] as Map<String, dynamic>;
                  _openChat(ChatPreview(
                    id: room['id'] as String,
                    name: person['fullName'] as String? ?? 'Chat',
                    subtitle: (person['role'] as String? ?? 'student').toLowerCase() == 'teacher' ||
                              (person['role'] as String? ?? '') == 'staff' ? 'Teacher' : 'Student',
                    lastMessage: '',
                    lastMessageTime: DateTime.now(),
                    isGroup: false,
                  ));
                }
              } catch (_) {}
            }

            Color _personColor(String id) {
              const colors = [
                Color(0xFFD97706), Color(0xFF7C3AED), Color(0xFF059669),
                Color(0xFFDC2626), Color(0xFF2563EB), Color(0xFF0891B2),
                Color(0xFFDB2777), Color(0xFF65A30D),
              ];
              return colors[id.hashCode.abs() % colors.length];
            }

            String _personInitials(String name) {
              final parts = name.trim().split(RegExp(r'\s+'));
              if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
              return name.isNotEmpty ? name[0].toUpperCase() : '?';
            }

            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.65,
              maxChildSize: 0.92,
              minChildSize: 0.4,
              builder: (_, scrollCtrl) => Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40, height: 4,
                    decoration: BoxDecoration(
                      color: context.cl.divider,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                    child: Text('New Chat',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: context.cl.text)),
                  ),
                  // Tabs
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Material(
                            color: tabIndex == 0 ? AppColors.brand : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              onTap: () => setModal(() { tabIndex = 0; searchCtrl.clear(); }),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                child: Text('Groups',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w700,
                                    color: tabIndex == 0 ? Colors.white : context.cl.textSec,
                                  )),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Material(
                            color: tabIndex == 1 ? AppColors.brand : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              onTap: () {
                                setModal(() { tabIndex = 1; searchCtrl.clear(); peopleResults = []; });
                                searchPeople('');
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                child: Text('People',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w700,
                                    color: tabIndex == 1 ? Colors.white : context.cl.textSec,
                                  )),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Search field
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: context.cl.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.cl.divider),
                      ),
                      child: TextField(
                        controller: searchCtrl,
                        onChanged: (v) {
                          setModal(() {});
                          if (tabIndex == 1) searchPeople(v);
                        },
                        style: TextStyle(color: context.cl.text, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: tabIndex == 0 ? 'Search groups...' : 'Search by name or ID...',
                          hintStyle: TextStyle(color: context.cl.textHint),
                          prefixIcon: Icon(Icons.search, color: context.cl.textHint, size: 20),
                          border: InputBorder.none,
                          filled: false,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: tabIndex == 0
                        ? (filteredGroups.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.chat_bubble_outline_rounded, size: 48, color: context.cl.divider),
                                    const SizedBox(height: 12),
                                    Text(
                                      _chats.isEmpty
                                          ? 'No groups yet.\nAsk your institution admin to\nadd you to a group.'
                                          : 'No results for "${searchCtrl.text}"',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: context.cl.textSec, fontSize: 14, height: 1.5),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.separated(
                                controller: scrollCtrl,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                itemCount: filteredGroups.length,
                                separatorBuilder: (_, __) => Divider(
                                  height: 1, indent: 70,
                                  color: context.cl.divider.withValues(alpha: 0.5),
                                ),
                                itemBuilder: (_, i) {
                                  final chat = filteredGroups[i];
                                  return ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor: chat.avatarColor,
                                      child: Text(chat.initials,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                                    ),
                                    title: Text(chat.name,
                                      style: TextStyle(fontWeight: FontWeight.w600, color: context.cl.text)),
                                    subtitle: Text(chat.subtitle,
                                      style: TextStyle(fontSize: 12, color: context.cl.textHint)),
                                    trailing: Icon(Icons.arrow_forward_ios_rounded, size: 14, color: context.cl.textHint),
                                    onTap: () { Navigator.pop(ctx); _openChat(chat); },
                                  );
                                },
                              ))
                        : loadingPeople
                            ? Center(child: CircularProgressIndicator(color: AppColors.brand, strokeWidth: 2))
                            : peopleError.isNotEmpty
                                ? Center(child: Text(peopleError, style: TextStyle(color: context.cl.textSec, fontSize: 14)))
                                : peopleResults.isEmpty
                                    ? Center(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.person_search_rounded, size: 48, color: context.cl.divider),
                                            const SizedBox(height: 12),
                                            Text(
                                              searchCtrl.text.isEmpty
                                                  ? 'Search for people in\nyour institution'
                                                  : 'No one found for "${searchCtrl.text}"',
                                              textAlign: TextAlign.center,
                                              style: TextStyle(color: context.cl.textSec, fontSize: 14, height: 1.5),
                                            ),
                                          ],
                                        ),
                                      )
                                    : ListView.separated(
                                        controller: scrollCtrl,
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        itemCount: peopleResults.length,
                                        separatorBuilder: (_, __) => Divider(
                                          height: 1, indent: 70,
                                          color: context.cl.divider.withValues(alpha: 0.5),
                                        ),
                                        itemBuilder: (_, i) {
                                          final p = peopleResults[i];
                                          final name = p['fullName'] as String? ?? 'Unknown';
                                          final role = p['role'] as String? ?? 'student';
                                          final sid = p['studentId'] as String? ?? '';
                                          final roleDisplay = (role == 'teacher' || role == 'staff') ? 'Teacher'
                                              : role == 'admin' ? 'Admin' : 'Student';
                                          final color = _personColor(p['id'] as String? ?? name);
                                          return ListTile(
                                            leading: CircleAvatar(
                                              backgroundColor: color,
                                              child: Text(_personInitials(name),
                                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                                            ),
                                            title: Text(name,
                                              style: TextStyle(fontWeight: FontWeight.w600, color: context.cl.text)),
                                            subtitle: Text(
                                              sid.isNotEmpty ? '$roleDisplay · $sid' : roleDisplay,
                                              style: TextStyle(fontSize: 12, color: context.cl.textHint),
                                            ),
                                            trailing: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                              decoration: BoxDecoration(
                                                color: AppColors.brand.withValues(alpha: 0.12),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Text('Message',
                                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.brand)),
                                            ),
                                            onTap: () => openDm(p),
                                          );
                                        },
                                      ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ── Role helpers ──────────────────────────────────────────────

  bool get _canCreateGroup {
    final r = widget.user.role.toLowerCase();
    return r == 'teacher' || r == 'lecturer' || r == 'staff' ||
           r == 'admin'   || r == 'class_rep';
  }

  bool get _canCreateClub {
    final r = widget.user.role.toLowerCase();
    return r == 'teacher' || r == 'lecturer' || r == 'staff' || r == 'admin';
  }

  // ── Create Group Sheet ─────────────────────────────────────────

  void _showCreateGroupSheet() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final searchCtrl = TextEditingController();
    List<Map<String, dynamic>> searchResults = [];
    List<Map<String, dynamic>> selectedMembers = [];
    bool loading = false;
    bool submitting = false;
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          Future<void> searchUsers(String q) async {
            if (q.isEmpty) { setSheet(() => searchResults = []); return; }
            setSheet(() => loading = true);
            try {
              final res = await http.get(
                Uri.parse('http://${Config.baseUrl}/api/v1/student/users?search=${Uri.encodeQueryComponent(q)}&limit=20'),
                headers: {'Authorization': 'Bearer ${widget.token}'},
              ).timeout(const Duration(seconds: 10));
              if (!ctx.mounted) return;
              if (res.statusCode == 200) {
                final data = jsonDecode(res.body) as Map<String, dynamic>;
                final all = List<Map<String, dynamic>>.from(data['users'] ?? []);
                setSheet(() {
                  searchResults = all.where((u) => u['id'] != widget.user.id).toList();
                  loading = false;
                });
              } else { setSheet(() => loading = false); }
            } catch (_) { if (ctx.mounted) setSheet(() => loading = false); }
          }

          Future<void> createGroup() async {
            final name = nameCtrl.text.trim();
            if (name.isEmpty) { setSheet(() => error = 'Group name is required'); return; }
            setSheet(() { submitting = true; error = ''; });
            try {
              final res = await http.post(
                Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/group'),
                headers: {
                  'Authorization': 'Bearer ${widget.token}',
                  'Content-Type': 'application/json',
                },
                body: jsonEncode({
                  'name': name,
                  'description': descCtrl.text.trim(),
                  'memberIds': selectedMembers.map((m) => m['id']).toList(),
                }),
              ).timeout(const Duration(seconds: 15));
              if (!mounted) return;
              if (res.statusCode == 200 || res.statusCode == 201) {
                Navigator.pop(ctx);
                _loadRooms();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('Group "$name" created!'),
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: AppColors.brand,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    margin: const EdgeInsets.all(16),
                  ));
                }
              } else {
                final body = jsonDecode(res.body) as Map<String, dynamic>;
                setSheet(() { submitting = false; error = body['error'] as String? ?? 'Failed to create group'; });
              }
            } catch (_) {
              if (ctx.mounted) setSheet(() { submitting = false; error = 'Network error. Try again.'; });
            }
          }

          Color personColor(String id) {
            const cs = [Color(0xFFD97706),Color(0xFF7C3AED),Color(0xFF059669),Color(0xFFDC2626),Color(0xFF2563EB),Color(0xFF0891B2),Color(0xFFDB2777)];
            return cs[id.hashCode.abs() % cs.length];
          }
          String initials(String name) {
            final p = name.trim().split(RegExp(r'\s+'));
            return p.length >= 2 ? '${p[0][0]}${p[1][0]}'.toUpperCase() : name.isNotEmpty ? name[0].toUpperCase() : '?';
          }

          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.85,
            maxChildSize: 0.95,
            minChildSize: 0.5,
            builder: (_, sc) => Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
                    child: Row(children: [
                      Expanded(child: Text('Create Group',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: context.cl.text))),
                      TextButton(
                        onPressed: submitting ? null : createGroup,
                        child: submitting
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand))
                            : const Text('Create', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800, fontSize: 15)),
                      ),
                    ]),
                  ),
                  Expanded(
                    child: ListView(
                      controller: sc,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      children: [
                        // Name field
                        _inputField(context, nameCtrl, 'Group Name', Icons.group_rounded, hint: 'e.g. CS3 Study Group'),
                        const SizedBox(height: 10),
                        _inputField(context, descCtrl, 'Description (optional)', Icons.info_outline_rounded, hint: 'What is this group about?'),
                        if (error.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(error, style: const TextStyle(color: Colors.red, fontSize: 12)),
                        ],
                        const SizedBox(height: 16),

                        // Selected members chips
                        if (selectedMembers.isNotEmpty) ...[
                          Text('Members (${selectedMembers.length})',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.cl.textSec)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8, runSpacing: 6,
                            children: selectedMembers.map((m) {
                              final name = m['fullName'] as String? ?? 'User';
                              return Chip(
                                avatar: CircleAvatar(
                                  backgroundColor: personColor(m['id'] as String? ?? name),
                                  child: Text(initials(name),
                                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                                ),
                                label: Text(name.split(' ').first,
                                  style: TextStyle(fontSize: 12, color: context.cl.text)),
                                backgroundColor: context.cl.card,
                                side: BorderSide(color: context.cl.divider),
                                deleteIcon: const Icon(Icons.close, size: 14),
                                onDeleted: () => setSheet(() => selectedMembers.remove(m)),
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Search members
                        Text('Add Members', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.cl.textSec)),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            color: context.cl.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: context.cl.divider),
                          ),
                          child: TextField(
                            controller: searchCtrl,
                            onChanged: searchUsers,
                            style: TextStyle(color: context.cl.text, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Search people to add...',
                              hintStyle: TextStyle(color: context.cl.textHint),
                              prefixIcon: Icon(Icons.search, color: context.cl.textHint, size: 20),
                              border: InputBorder.none, filled: false,
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        if (loading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Center(child: CircularProgressIndicator(color: AppColors.brand, strokeWidth: 2)),
                          ),
                        ...searchResults.map((u) {
                          final name = u['fullName'] as String? ?? 'User';
                          final uid = u['id'] as String? ?? '';
                          final isSelected = selectedMembers.any((m) => m['id'] == uid);
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            leading: CircleAvatar(
                              backgroundColor: personColor(uid),
                              child: Text(initials(name),
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                            ),
                            title: Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: context.cl.text, fontSize: 14)),
                            subtitle: Text(
                              (u['studentId'] as String? ?? u['staffId'] as String? ?? (u['role'] as String? ?? 'Student')),
                              style: TextStyle(fontSize: 11, color: context.cl.textHint),
                            ),
                            trailing: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              width: 28, height: 28,
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.brand : Colors.transparent,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? AppColors.brand : context.cl.divider, width: 2,
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                                  : null,
                            ),
                            onTap: () => setSheet(() {
                              if (isSelected) {
                                selectedMembers.removeWhere((m) => m['id'] == uid);
                              } else {
                                selectedMembers.add(u);
                              }
                            }),
                          );
                        }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Create Academic Group Sheet (teachers / admin) ────────────

  void _showCreateAcademicSheet() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final searchCtrl = TextEditingController();
    List<Map<String, dynamic>> searchResults = [];
    List<Map<String, dynamic>> selectedMembers = [];
    bool loading = false;
    bool submitting = false;
    String error = '';
    String selectedType = 'course'; // 'cohort' or 'course'

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          Future<void> searchUsers(String q) async {
            if (q.isEmpty) { setSheet(() => searchResults = []); return; }
            setSheet(() => loading = true);
            try {
              final res = await http.get(
                Uri.parse('http://${Config.baseUrl}/api/v1/student/users?search=${Uri.encodeQueryComponent(q)}&limit=20'),
                headers: {'Authorization': 'Bearer ${widget.token}'},
              ).timeout(const Duration(seconds: 10));
              if (!ctx.mounted) return;
              if (res.statusCode == 200) {
                final data = jsonDecode(res.body) as Map<String, dynamic>;
                final all = List<Map<String, dynamic>>.from(data['users'] ?? []);
                setSheet(() {
                  searchResults = all.where((u) => u['id'] != widget.user.id).toList();
                  loading = false;
                });
              } else { setSheet(() => loading = false); }
            } catch (_) { if (ctx.mounted) setSheet(() => loading = false); }
          }

          Future<void> create() async {
            final name = nameCtrl.text.trim();
            if (name.isEmpty) { setSheet(() => error = 'Name is required'); return; }
            setSheet(() { submitting = true; error = ''; });
            try {
              final res = await http.post(
                Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/academic'),
                headers: {
                  'Authorization': 'Bearer ${widget.token}',
                  'Content-Type': 'application/json',
                },
                body: jsonEncode({
                  'name': name,
                  'description': descCtrl.text.trim(),
                  'type': selectedType,
                  'memberIds': selectedMembers.map((m) => m['id']).toList(),
                }),
              ).timeout(const Duration(seconds: 15));
              if (!mounted) return;
              if (res.statusCode == 200 || res.statusCode == 201) {
                Navigator.pop(ctx);
                _loadRooms();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('${selectedType == 'cohort' ? 'Cohort' : 'Course'} "$name" created!'),
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: AppColors.brand,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    margin: const EdgeInsets.all(16),
                  ));
                }
              } else {
                final body = jsonDecode(res.body) as Map<String, dynamic>;
                setSheet(() { submitting = false; error = body['error'] as String? ?? 'Failed to create'; });
              }
            } catch (_) {
              if (ctx.mounted) setSheet(() { submitting = false; error = 'Network error. Try again.'; });
            }
          }

          Color personColor(String id) {
            const cs = [Color(0xFFD97706),Color(0xFF7C3AED),Color(0xFF059669),Color(0xFFDC2626),Color(0xFF2563EB),Color(0xFF0891B2),Color(0xFFDB2777)];
            return cs[id.hashCode.abs() % cs.length];
          }
          String initials(String name) {
            final p = name.trim().split(RegExp(r'\s+'));
            return p.length >= 2 ? '${p[0][0]}${p[1][0]}'.toUpperCase() : name.isNotEmpty ? name[0].toUpperCase() : '?';
          }

          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.85,
            maxChildSize: 0.95,
            minChildSize: 0.5,
            builder: (_, sc) => Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
                    child: Row(children: [
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Create Academic Group',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text)),
                          Text('Teacher / Admin only',
                            style: const TextStyle(fontSize: 11, color: AppColors.brand, fontWeight: FontWeight.w600)),
                        ],
                      )),
                      TextButton(
                        onPressed: submitting ? null : create,
                        child: submitting
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand))
                            : const Text('Create', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800, fontSize: 15)),
                      ),
                    ]),
                  ),
                  Expanded(
                    child: ListView(
                      controller: sc,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      children: [
                        // Type selector
                        Row(children: [
                          Expanded(child: Material(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              onTap: () => setSheet(() => selectedType = 'cohort'),
                              borderRadius: BorderRadius.circular(10),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  gradient: selectedType == 'cohort' ? AppColors.brandGradient : null,
                                  color: selectedType == 'cohort' ? null : context.cl.card,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: selectedType == 'cohort' ? AppColors.brand : context.cl.divider),
                                ),
                                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  Icon(Icons.group_rounded, size: 16,
                                    color: selectedType == 'cohort' ? AppColors.bgMain : context.cl.textSec),
                                  const SizedBox(width: 6),
                                  Text('Cohort', style: TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13,
                                    color: selectedType == 'cohort' ? AppColors.bgMain : context.cl.textSec)),
                                ]),
                              ),
                            ),
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: Material(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            child: InkWell(
                              onTap: () => setSheet(() => selectedType = 'course'),
                              borderRadius: BorderRadius.circular(10),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  gradient: selectedType == 'course' ? AppColors.brandGradient : null,
                                  color: selectedType == 'course' ? null : context.cl.card,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: selectedType == 'course' ? AppColors.brand : context.cl.divider),
                                ),
                                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  Icon(Icons.menu_book_rounded, size: 16,
                                    color: selectedType == 'course' ? AppColors.bgMain : context.cl.textSec),
                                  const SizedBox(width: 6),
                                  Text('Course', style: TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13,
                                    color: selectedType == 'course' ? AppColors.bgMain : context.cl.textSec)),
                                ]),
                              ),
                            ),
                          )),
                        ]),
                        const SizedBox(height: 12),
                        _inputField(context, nameCtrl,
                          selectedType == 'cohort' ? 'Cohort Name' : 'Course Name',
                          selectedType == 'cohort' ? Icons.group_rounded : Icons.menu_book_rounded,
                          hint: selectedType == 'cohort' ? 'e.g. CS3 2024 Cohort' : 'e.g. Introduction to Programming'),
                        const SizedBox(height: 10),
                        _inputField(context, descCtrl, 'Description (optional)', Icons.info_outline_rounded,
                          hint: selectedType == 'cohort' ? 'Describe this cohort...' : 'Course details...'),
                        if (error.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(error, style: const TextStyle(color: Colors.red, fontSize: 12)),
                        ],
                        const SizedBox(height: 16),
                        if (selectedMembers.isNotEmpty) ...[
                          Text('Members (${selectedMembers.length})',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.cl.textSec)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8, runSpacing: 6,
                            children: selectedMembers.map((m) {
                              final name = m['fullName'] as String? ?? 'User';
                              return Chip(
                                avatar: CircleAvatar(
                                  backgroundColor: personColor(m['id'] as String? ?? name),
                                  child: Text(initials(name),
                                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                                ),
                                label: Text(name.split(' ').first,
                                  style: TextStyle(fontSize: 12, color: context.cl.text)),
                                backgroundColor: context.cl.card,
                                side: BorderSide(color: context.cl.divider),
                                deleteIcon: const Icon(Icons.close, size: 14),
                                onDeleted: () => setSheet(() => selectedMembers.remove(m)),
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 12),
                        ],
                        Text('Add Students / Staff',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.cl.textSec)),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            color: context.cl.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: context.cl.divider),
                          ),
                          child: TextField(
                            controller: searchCtrl,
                            onChanged: searchUsers,
                            style: TextStyle(color: context.cl.text, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Search students or staff...',
                              hintStyle: TextStyle(color: context.cl.textHint),
                              prefixIcon: Icon(Icons.search, color: context.cl.textHint, size: 20),
                              border: InputBorder.none, filled: false,
                              contentPadding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        if (loading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Center(child: CircularProgressIndicator(color: AppColors.brand, strokeWidth: 2)),
                          ),
                        ...searchResults.map((u) {
                          final name = u['fullName'] as String? ?? 'User';
                          final uid = u['id'] as String? ?? '';
                          final isSelected = selectedMembers.any((m) => m['id'] == uid);
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            leading: CircleAvatar(
                              backgroundColor: personColor(uid),
                              child: Text(initials(name),
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                            ),
                            title: Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: context.cl.text, fontSize: 14)),
                            subtitle: Text(
                              u['studentId'] as String? ?? u['staffId'] as String? ?? (u['role'] as String? ?? 'Student'),
                              style: TextStyle(fontSize: 11, color: context.cl.textHint),
                            ),
                            trailing: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              width: 28, height: 28,
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.brand : Colors.transparent,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? AppColors.brand : context.cl.divider, width: 2),
                              ),
                              child: isSelected
                                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                                  : null,
                            ),
                            onTap: () => setSheet(() {
                              if (isSelected) {
                                selectedMembers.removeWhere((m) => m['id'] == uid);
                              } else {
                                selectedMembers.add(u);
                              }
                            }),
                          );
                        }),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Create Club Sheet (teachers / admin) ─────────────────────

  void _showCreateClubSheet() {
    final nameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    bool submitting = false;
    String error = '';
    String selectedCategory = 'General';
    final categories = ['General', 'Technology', 'Sports', 'Creative', 'Business', 'Science', 'Leadership'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          Future<void> createClub() async {
            final name = nameCtrl.text.trim();
            if (name.isEmpty) { setSheet(() => error = 'Club name is required'); return; }
            setSheet(() { submitting = true; error = ''; });
            try {
              final res = await http.post(
                Uri.parse('http://${Config.baseUrl}/api/v1/student/clubs'),
                headers: {
                  'Authorization': 'Bearer ${widget.token}',
                  'Content-Type': 'application/json',
                },
                body: jsonEncode({
                  'name': name,
                  'description': descCtrl.text.trim(),
                  'category': selectedCategory,
                }),
              ).timeout(const Duration(seconds: 15));
              if (!mounted) return;
              if (res.statusCode == 200 || res.statusCode == 201) {
                Navigator.pop(ctx);
                _loadClubs();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('Club "$name" created!'),
                    behavior: SnackBarBehavior.floating,
                    backgroundColor: AppColors.brand,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    margin: const EdgeInsets.all(16),
                  ));
                }
              } else {
                final body = jsonDecode(res.body) as Map<String, dynamic>;
                setSheet(() { submitting = false; error = body['error'] as String? ?? 'Failed to create club'; });
              }
            } catch (_) {
              if (ctx.mounted) setSheet(() { submitting = false; error = 'Network error. Try again.'; });
            }
          }

          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 12),
                  Center(child: Container(width: 40, height: 4,
                    decoration: BoxDecoration(color: context.cl.divider, borderRadius: BorderRadius.circular(2)))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
                    child: Row(children: [
                      Expanded(child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Create Club', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: context.cl.text)),
                          Text('Teacher / Admin only', style: TextStyle(fontSize: 11, color: AppColors.brand, fontWeight: FontWeight.w600)),
                        ],
                      )),
                      TextButton(
                        onPressed: submitting ? null : createClub,
                        child: submitting
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand))
                            : const Text('Create', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800, fontSize: 15)),
                      ),
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _inputField(context, nameCtrl, 'Club Name', Icons.groups_rounded, hint: 'e.g. Robotics Club'),
                        const SizedBox(height: 10),
                        _inputField(context, descCtrl, 'Description', Icons.description_rounded, hint: 'What does this club do?', maxLines: 3),
                        const SizedBox(height: 14),
                        Text('Category', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: context.cl.textSec)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8, runSpacing: 8,
                          children: categories.map((cat) {
                            final isSelected = cat == selectedCategory;
                            return Material(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                onTap: () => setSheet(() => selectedCategory = cat),
                                borderRadius: BorderRadius.circular(20),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 150),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    gradient: isSelected ? AppColors.brandGradient : null,
                                    color: isSelected ? null : context.cl.card,
                                    borderRadius: BorderRadius.circular(20),
                                    border: isSelected ? null : Border.all(color: context.cl.divider),
                                  ),
                                  child: Text(cat,
                                    style: TextStyle(
                                      fontSize: 12, fontWeight: FontWeight.w600,
                                      color: isSelected ? Colors.white : context.cl.textSec,
                                    )),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        if (error.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(error, style: const TextStyle(color: Colors.red, fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Shared input field widget ─────────────────────────────────

  Widget _inputField(BuildContext context, TextEditingController ctrl,
      String label, IconData icon, {String hint = '', int maxLines = 1}) {
    return Container(
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.cl.divider),
      ),
      child: TextField(
        controller: ctrl,
        maxLines: maxLines,
        style: TextStyle(color: context.cl.text, fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: context.cl.textHint, fontSize: 13),
          hintText: hint,
          hintStyle: TextStyle(color: context.cl.textHint.withValues(alpha: 0.6), fontSize: 13),
          prefixIcon: Icon(icon, color: AppColors.brand, size: 20),
          border: InputBorder.none, filled: false,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  // ── Navigation ────────────────────────────────────────────────

  List<ChatPreview> get _filteredChats {
    var chats = _chats;
    if (_searchCtrl.text.isNotEmpty) {
      final q = _searchCtrl.text.toLowerCase();
      chats = chats.where((c) => c.name.toLowerCase().contains(q)).toList();
    }
    if (_activeFilter == 'unread') return chats.where((c) => c.unreadCount > 0).toList();
    if (_activeFilter == 'groups') return chats.where((c) => c.isGroup).toList();
    if (_activeFilter == 'direct') return chats.where((c) => !c.isGroup).toList();
    return chats;
  }

  void _openChat(ChatPreview chat) async {
    final navigator = Navigator.of(context);
    // Optimistically clear badge before navigation
    setState(() {
      final idx = _chats.indexWhere((c) => c.id == chat.id);
      if (idx >= 0) {
        final c = _chats[idx];
        _chats[idx] = ChatPreview(
          id: c.id, name: c.name, subtitle: c.subtitle,
          lastMessage: c.lastMessage, lastSender: c.lastSender,
          lastSenderId: c.lastSenderId, avatarUrl: c.avatarUrl,
          lastMessageTime: c.lastMessageTime, unreadCount: 0,
          isOnline: c.isOnline, isGroup: c.isGroup,
        );
      }
    });
    // Persist last-read both locally and on the server (fire-and-forget)
    final now = DateTime.now();
    final prefs = await SharedPreferences.getInstance();
    unawaited(prefs.setString('last_read_${chat.id}', now.toIso8601String()));
    unawaited(http.patch(
      Uri.parse('http://${Config.baseUrl}/api/v1/student/rooms/${chat.id}/read'),
      headers: {'Authorization': 'Bearer ${widget.token}'},
    ));
    _lastRead[chat.id] = now;
    if (!mounted) return;
    navigator.push(MaterialPageRoute(
      builder: (_) => ChatScreen(
        roomId: chat.id, roomName: chat.name, subtitle: chat.subtitle,
        isGroup: chat.isGroup, isOnline: chat.isOnline,
        user: widget.user, token: widget.token,
      ),
    )).then((_) => _loadRooms());
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(context,
        MaterialPageRoute(builder: (_) => const TenantScreen()), (_) => false);
  }

  // ── Build ─────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildChatsTab(context),    // 0 – Chats
          _buildGroupsTab(context),   // 1 – Groups
          _buildAcademicTab(context), // 2 – Academic
          _buildClubsTab(context),    // 3 – Clubs
          ProfileScreen(user: widget.user, token: widget.token), // 4 – Profile
        ],
      ),
      bottomNavigationBar: _buildBottomNav(context),
      floatingActionButton: _buildFab(),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    if (_isSearching) {
      return AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.cl.text),
          onPressed: () => setState(() { _isSearching = false; _searchCtrl.clear(); }),
        ),
        title: TextField(
          controller: _searchCtrl, autofocus: true,
          style: TextStyle(color: context.cl.text),
          cursorColor: AppColors.brand,
          decoration: InputDecoration(
            hintText: 'Search chats...',
            hintStyle: TextStyle(color: context.cl.textHint),
            border: InputBorder.none, filled: false,
          ),
          onChanged: (_) => setState(() {}),
        ),
      );
    }

    return AppBar(
      title: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(9)),
            child: const Icon(Icons.school_rounded, color: AppColors.bgMain, size: 18),
          ),
          const SizedBox(width: 10),
          Text('UniChat', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: context.cl.text)),
        ],
      ),
      actions: [
        IconButton(icon: Icon(Icons.search, color: context.cl.text),
            onPressed: () => setState(() => _isSearching = true)),
        IconButton(icon: Icon(Icons.more_vert, color: context.cl.text),
            onPressed: () => _showMoreMenu(context)),
      ],
    );
  }

  void _showMoreMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(0, 12, 0, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4,
                decoration: BoxDecoration(
                    color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            _menuItem(context, Icons.wallpaper_rounded, 'Chat Theme',
                () => _showGlobalWallpaperPicker(context)),
            _menuItem(context, Icons.notifications_rounded, 'Notifications',
                () => _showNotificationsSheet(context)),
            _menuItem(context, Icons.lock_rounded, 'Privacy',
                () => _showPrivacySheet(context)),
            _menuItem(context, Icons.help_outline_rounded, 'Help & Support',
                () => _showHelpSheet(context)),
            _menuItem(context, Icons.logout_rounded, 'Log out',
                _logout, isDestructive: true),
          ],
        ),
      ),
    );
  }

  void _showGlobalWallpaperPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatWallpaperPicker(
        current: ChatThemeService.current.value,
        onSelected: ChatThemeService.set, // one call → updates every open chat
      ),
    );
  }

  Widget _menuItem(BuildContext context, IconData icon, String label, VoidCallback onTap,
      {bool isDestructive = false}) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? AppColors.error : AppColors.brand),
      title: Text(label,
          style: TextStyle(color: isDestructive ? AppColors.error : context.cl.text)),
      trailing: isDestructive
          ? null
          : Icon(Icons.chevron_right, size: 18, color: context.cl.textHint),
      onTap: () { Navigator.pop(context); onTap(); },
    );
  }

  void _showNotificationsSheet(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    bool notifEnabled = prefs.getBool('notifications_enabled') ?? true;
    bool msgSound = prefs.getBool('notif_msg_sound') ?? true;
    bool mentionAlert = prefs.getBool('notif_mention_alert') ?? true;

    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                      color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
              Text('Notifications',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                      color: context.cl.text)),
              const SizedBox(height: 20),
              _prefToggle(context, 'Enable Notifications',
                  'Receive alerts for new messages', notifEnabled, (v) async {
                setSheet(() { notifEnabled = v; });
                final p = await SharedPreferences.getInstance();
                await p.setBool('notifications_enabled', v);
              }),
              const SizedBox(height: 10),
              _prefToggle(context, 'Message Sounds',
                  'Play sound when a message arrives', msgSound, (v) async {
                setSheet(() { msgSound = v; });
                final p = await SharedPreferences.getInstance();
                await p.setBool('notif_msg_sound', v);
              }),
              const SizedBox(height: 10),
              _prefToggle(context, 'Mention Alerts',
                  'Get notified when someone mentions you', mentionAlert, (v) async {
                setSheet(() { mentionAlert = v; });
                final p = await SharedPreferences.getInstance();
                await p.setBool('notif_mention_alert', v);
              }),
            ],
          ),
        ),
      ),
    );
  }

  void _showPrivacySheet(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    bool readReceipts = prefs.getBool('privacy_read_receipts') ?? true;
    bool lastSeen = prefs.getBool('privacy_last_seen') ?? true;

    if (!context.mounted) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                      color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
              Text('Privacy',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                      color: context.cl.text)),
              const SizedBox(height: 20),
              _prefToggle(context, 'Read Receipts',
                  'Show when you have read messages', readReceipts, (v) async {
                setSheet(() { readReceipts = v; });
                final p = await SharedPreferences.getInstance();
                await p.setBool('privacy_read_receipts', v);
              }),
              const SizedBox(height: 10),
              _prefToggle(context, 'Last Seen',
                  'Show your last active time to others', lastSeen, (v) async {
                setSheet(() { lastSeen = v; });
                final p = await SharedPreferences.getInstance();
                await p.setBool('privacy_last_seen', v);
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _prefToggle(BuildContext context, String title, String subtitle,
      bool value, ValueChanged<bool> onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.cl.divider),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                        color: context.cl.text)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: TextStyle(fontSize: 12, color: context.cl.textSec)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged, activeColor: AppColors.brand),
        ],
      ),
    );
  }

  void _showHelpSheet(BuildContext context) {
    const faqs = [
      ('How do I start a chat?',
          'Tap the "+" button on the Chats tab and search for a person or select an existing group.'),
      ('Why are my messages not appearing?',
          'Check your internet connection. Messages are saved on the server and appear once connected.'),
      ('How do I join a club?',
          'Go to the Clubs tab and tap "Join" on any club you\'d like to join.'),
      ('How do I update my profile?',
          'Go to the Profile tab and tap "Edit Profile" to update your name, phone, and photo.'),
      ('How do I log out?',
          'Tap the three-dot menu (⋮) and select "Log out", or go to the Profile tab.'),
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.55,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        builder: (_, ctrl) => Column(
          children: [
            Container(width: 40, height: 4,
                margin: const EdgeInsets.only(top: 12, bottom: 4),
                decoration: BoxDecoration(
                    color: context.cl.divider, borderRadius: BorderRadius.circular(2))),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text('Help & Support',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800,
                      color: context.cl.text)),
            ),
            Expanded(
              child: ListView.separated(
                controller: ctrl,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                itemCount: faqs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => Container(
                  decoration: BoxDecoration(
                    color: context.cl.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: context.cl.divider),
                  ),
                  child: ExpansionTile(
                    tilePadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 2),
                    childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                    iconColor: AppColors.brand,
                    collapsedIconColor: context.cl.textHint,
                    shape: const Border(),
                    collapsedShape: const Border(),
                    title: Text(faqs[i].$1,
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                            color: context.cl.text)),
                    children: [
                      Text(faqs[i].$2,
                          style: TextStyle(fontSize: 13, color: context.cl.textSec,
                              height: 1.5)),
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

  // ── Filter Bar ────────────────────────────────────────────────
  Widget _buildFilterBar(BuildContext context) {
    final unreadCount = _chats.where((c) => c.unreadCount > 0).length;
    final filters = <(String, String)>[
      ('all', 'All'),
      ('unread', unreadCount > 0 ? 'Unread ($unreadCount)' : 'Unread'),
      ('groups', 'Groups'),
      ('direct', 'Direct'),
    ];
    return Container(
      height: 44,
      color: context.cl.surface,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: filters.map((f) {
          final isActive = _activeFilter == f.$1;
          final isUnread = f.$1 == 'unread' && unreadCount > 0;
          return Semantics(
            label: f.$2,
            button: true,
            selected: isActive,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => setState(() => _activeFilter = f.$1),
                borderRadius: BorderRadius.circular(20),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    gradient: isActive ? AppColors.brandGradient : null,
                    color: isActive ? null : (isUnread ? AppColors.brand.withValues(alpha: 0.08) : context.cl.card),
                    borderRadius: BorderRadius.circular(20),
                    border: isActive ? null : Border.all(
                      color: isUnread ? AppColors.brand.withValues(alpha: 0.4) : context.cl.divider,
                    ),
                  ),
                  child: Center(
                    child: Text(f.$2,
                      style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600,
                        color: isActive
                            ? AppColors.bgMain
                            : isUnread ? AppColors.brand : context.cl.textSec,
                      )),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Shared avatar circle helper ───────────────────────────────
  /// Shows a profile photo when available; falls back to coloured initials.
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
          fontSize: radius * 0.6,
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  // ── Chats Tab ─────────────────────────────────────────────────
  Widget _buildChatsTab(BuildContext context) {
    if (_loadingRooms) {
      return Center(child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary, strokeWidth: 2.5));
    }
    if (_roomsError.isNotEmpty && _chats.isEmpty) {
      return _errorState(context, _roomsError, _loadRooms);
    }
    final chats = _filteredChats;
    return Column(
      children: [
        if (_isOffline) _offlineBanner(context),
        _buildFilterBar(context),
        _buildOnlineRow(context),
        Expanded(
          child: chats.isEmpty
              ? _emptyState(context, 'No chats yet', Icons.chat_bubble_outline)
              : RefreshIndicator(
                  color: AppColors.brand,
                  onRefresh: _loadRooms,
                  child: ListView.separated(
                    padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom + 80),
                    itemCount: chats.length,
                    // Indent past the avatar (14 padding + 54 avatar + 12 gap) so
                    // the rule starts under the name, as in WhatsApp.
                    separatorBuilder: (_, __) => Divider(
                      height: 1, indent: 80, color: context.cl.divider.withValues(alpha: 0.5),
                    ),
                    itemBuilder: (_, i) => _buildChatTile(context, chats[i]),
                  ),
                ),
        ),
      ],
    );
  }

  /// Cached chats are real but may be stale, so say so rather than letting them
  /// pass for live data.
  Widget _offlineBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      color: context.cl.cardLight,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_off_rounded, size: 14, color: context.cl.textSec),
          const SizedBox(width: 8),
          Text('No connection — showing saved chats',
              style: TextStyle(fontSize: 12, color: context.cl.textSec)),
        ],
      ),
    );
  }

  Widget _buildOnlineRow(BuildContext context) {
    final online = _chats.where((c) => !c.isGroup && c.isOnline).toList();
    return Container(
      height: 88,
      color: context.cl.surface,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        children: [
          _buildStatusCircle(context, widget.user.initials, widget.user.avatarColor, 'You',
              imageUrl: widget.user.avatarUrl, isMe: true),
          ...online.map((c) => _buildStatusCircle(context, c.initials, c.avatarColor,
              c.name.split(' ').first, imageUrl: c.avatarUrl)),
        ],
      ),
    );
  }

  Widget _buildStatusCircle(BuildContext context, String initials, Color color, String label,
      {bool isMe = false, String? imageUrl}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            children: [
              Container(
                width: 46, height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: isMe ? AppColors.brand : AppColors.online, width: 2.5),
                ),
                child: CircleAvatar(
                  backgroundColor: color,
                  foregroundImage: (imageUrl != null && imageUrl.isNotEmpty)
                      ? NetworkImage(imageUrl) : null,
                  onForegroundImageError: (imageUrl != null && imageUrl.isNotEmpty)
                      ? (_, __) {} : null,
                  child: Text(initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ),
              if (isMe)
                Positioned(right: 0, bottom: 0,
                  child: Container(
                    width: 16, height: 16,
                    decoration: BoxDecoration(
                      gradient: AppColors.brandGradient, shape: BoxShape.circle,
                      border: Border.all(color: context.cl.surface, width: 1.5),
                    ),
                    child: const Icon(Icons.add, size: 10, color: AppColors.bgMain),
                  ))
              else
                Positioned(right: 0, bottom: 0,
                  child: Container(
                    width: 12, height: 12,
                    decoration: BoxDecoration(
                      color: AppColors.online, shape: BoxShape.circle,
                      border: Border.all(color: context.cl.surface, width: 1.5),
                    ),
                  )),
            ],
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 10, color: context.cl.textSec), overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  String _chatSubtitle(ChatPreview chat) {
    if (chat.lastMessage.isEmpty) return 'No messages yet';
    // In a 1:1 the ticks already say the message is yours, so naming yourself is
    // redundant — only groups need a "who said it" prefix.
    if (chat.lastSenderId == widget.user.id) {
      return chat.isGroup ? 'You: ${chat.preview}' : chat.preview;
    }
    if (chat.isGroup && chat.lastSender.isNotEmpty) return '${chat.lastSender}: ${chat.preview}';
    return chat.preview;
  }

  /// Count badge: a true circle for one or two digits, widening into a pill only
  /// when the number actually needs the room.
  Widget _unreadBadge(int count) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      margin: const EdgeInsets.only(left: 8),
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      padding: EdgeInsets.symmetric(horizontal: label.length > 2 ? 6 : 0),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label,
        style: const TextStyle(
          color: AppColors.bgMain, fontSize: 11.5, fontWeight: FontWeight.w800, height: 1,
        )),
    );
  }

  Widget _buildChatTile(BuildContext context, ChatPreview chat) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openChat(chat),
        splashColor: AppColors.brand.withValues(alpha: 0.06),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Stack(
                children: [
                  _avatarCircle(
                    radius: 27,
                    name: chat.name,
                    color: chat.avatarColor,
                    imageUrl: chat.avatarUrl,
                  ),
                  if (!chat.isGroup && chat.isOnline)
                    Positioned(right: 0, bottom: 0,
                      child: Container(
                        width: 13, height: 13,
                        decoration: BoxDecoration(
                          color: AppColors.online, shape: BoxShape.circle,
                          border: Border.all(color: context.cl.bg, width: 2),
                        ),
                      )),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(chat.name,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16.5, color: context.cl.text,
                            ),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                        const SizedBox(width: 8),
                        // Unread is signalled by the accented time and the badge
                        // below, so the name keeps one weight and the rows stay
                        // on a single rhythm instead of jumping as mail arrives.
                        Text(formatChatTime(chat.lastMessageTime),
                          style: TextStyle(
                            fontSize: 12,
                            color: chat.unreadCount > 0 ? AppColors.brandDeep : context.cl.textHint,
                            fontWeight: chat.unreadCount > 0 ? FontWeight.w700 : FontWeight.normal,
                          )),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        // Tick icon when the current user sent the last message
                        if (chat.lastSenderId == widget.user.id && chat.lastMessage.isNotEmpty) ...[
                          Icon(Icons.done_all_rounded, size: 16,
                              color: chat.unreadCount == 0
                                  ? AppColors.brandDeep
                                  : context.cl.textHint),
                          const SizedBox(width: 3),
                        ],
                        Expanded(
                          child: Text(
                            _chatSubtitle(chat),
                            style: TextStyle(
                              fontSize: 14,
                              color: context.cl.textSec,
                              height: 1.25,
                            ),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        ),
                        if (chat.unreadCount > 0) _unreadBadge(chat.unreadCount),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Groups Tab (all non-private rooms) ───────────────────────
  Widget _buildGroupsTab(BuildContext context) {
    if (_loadingRooms) {
      return Center(child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary, strokeWidth: 2.5));
    }
    if (_roomsError.isNotEmpty && _groups.isEmpty) {
      return _errorState(context, _roomsError, _loadRooms);
    }
    if (_groups.isEmpty) {
      return _emptyState(context, 'No groups yet', Icons.forum_outlined);
    }

    // Order: Groups first, then Cohorts, then Courses, then Club
    const typeOrder = ['Group', 'Cohort', 'Course', 'Club'];
    final sectionLabels = {
      'Group': 'My Groups',
      'Cohort': 'My Cohorts',
      'Course': 'My Courses',
      'Club': 'My Club Rooms',
    };
    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: _loadRooms,
      child: ListView(
        padding: EdgeInsets.only(top: 8, bottom: MediaQuery.of(context).padding.bottom + 80),
        children: typeOrder.expand((type) {
          final items = _groups.where((g) => g.type == type).toList();
          if (items.isEmpty) return <Widget>[];
          return <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Container(width: 3, height: 16,
                      decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 10),
                  Text(sectionLabels[type] ?? type,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: context.cl.textSec, letterSpacing: 0.5)),
                ],
              ),
            ),
            ...items.map((g) => _buildGroupTile(context, g)),
          ];
        }).toList(),
      ),
    );
  }

  // ── Academic Tab (cohorts + courses only) ─────────────────────
  Widget _buildAcademicTab(BuildContext context) {
    if (_loadingRooms) {
      return Center(child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary, strokeWidth: 2.5));
    }
    final academic = _groups.where((g) => g.type == 'Cohort' || g.type == 'Course').toList();
    if (_roomsError.isNotEmpty && academic.isEmpty) {
      return _errorState(context, _roomsError, _loadRooms);
    }
    if (academic.isEmpty) {
      return _emptyState(context, 'No academic groups yet', Icons.school_outlined);
    }
    const typeOrder = ['Cohort', 'Course'];
    final sectionLabels = {'Cohort': 'My Cohorts', 'Course': 'My Courses'};
    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: _loadRooms,
      child: ListView(
        padding: EdgeInsets.only(top: 8, bottom: MediaQuery.of(context).padding.bottom + 80),
        children: typeOrder.expand((type) {
          final items = academic.where((g) => g.type == type).toList();
          if (items.isEmpty) return <Widget>[];
          return <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Container(width: 3, height: 16,
                      decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 10),
                  Text(sectionLabels[type] ?? type,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: context.cl.textSec, letterSpacing: 0.5)),
                ],
              ),
            ),
            ...items.map((g) => _buildGroupTile(context, g)),
          ];
        }).toList(),
      ),
    );
  }

  Widget _buildGroupTile(BuildContext context, AcademicGroup group) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openChat(ChatPreview(
          id: group.id, name: group.name, subtitle: '${group.memberCount} members',
          lastMessage: 'Tap to open group', lastMessageTime: DateTime.now(), isGroup: true,
        )),
        splashColor: AppColors.brand.withValues(alpha: 0.06),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Container(
                width: 50, height: 50,
                decoration: BoxDecoration(
                  color: context.cl.card, borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.cl.divider),
                ),
                child: Icon(group.icon, color: AppColors.brand, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(group.name, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: context.cl.text)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.people_rounded, size: 12, color: context.cl.textHint),
                        const SizedBox(width: 4),
                        Text('${group.memberCount} members', style: TextStyle(fontSize: 12, color: context.cl.textHint)),
                        const SizedBox(width: 12),
                        Icon(Icons.access_time, size: 12, color: context.cl.textHint),
                        const SizedBox(width: 4),
                        Text(group.lastActivity, style: TextStyle(fontSize: 12, color: context.cl.textHint)),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: context.cl.textHint, size: 20),
            ],
          ),
        ),
      ),
    );
  }

  // ── Clubs Tab ─────────────────────────────────────────────────
  Widget _buildClubsTab(BuildContext context) {
    if (_loadingClubs) {
      return Center(child: CircularProgressIndicator(
          color: Theme.of(context).colorScheme.primary, strokeWidth: 2.5));
    }
    if (_clubsError.isNotEmpty) {
      return _errorState(context, _clubsError, _loadClubs);
    }
    if (_clubs.isEmpty) {
      return _emptyState(context, 'No clubs available', Icons.groups_outlined);
    }

    final joined = _clubs.where((c) => c.isJoined).toList();
    final discover = _clubs.where((c) => !c.isJoined).toList();

    return RefreshIndicator(
      color: AppColors.brand,
      onRefresh: _loadClubs,
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 80),
        children: [
          if (joined.isNotEmpty) ...[
            _clubSectionHeader(context, 'My Clubs'),
            const SizedBox(height: 8),
            ...joined.map((c) => _buildClubCard(context, c)),
            const SizedBox(height: 16),
          ],
          if (discover.isNotEmpty) ...[
            _clubSectionHeader(context, 'Discover Clubs'),
            const SizedBox(height: 8),
            ...discover.map((c) => _buildClubCard(context, c)),
          ],
        ],
      ),
    );
  }

  Widget _clubSectionHeader(BuildContext context, String title) {
    return Row(
      children: [
        Container(width: 3, height: 16,
            decoration: BoxDecoration(gradient: AppColors.brandGradient, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 10),
        Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: context.cl.textSec, letterSpacing: 0.5)),
      ],
    );
  }

  Widget _buildClubCard(BuildContext context, ClubModel club) {
    final index = _clubs.indexOf(club);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: club.isJoined ? club.color.withValues(alpha: 0.4) : context.cl.divider),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          splashColor: club.color.withValues(alpha: 0.08),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 50, height: 50,
                  decoration: BoxDecoration(
                    color: club.color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(club.icon, color: club.color, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(club.name,
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: context.cl.text)),
                      const SizedBox(height: 3),
                      Text(club.activity,
                          style: TextStyle(fontSize: 12, color: club.color, fontWeight: FontWeight.w500),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.people_rounded, size: 12, color: context.cl.textHint),
                          const SizedBox(width: 4),
                          Text('${club.memberCount} members', style: TextStyle(fontSize: 12, color: context.cl.textHint)),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: context.cl.cardLight, borderRadius: BorderRadius.circular(6)),
                            child: Text(club.category, style: TextStyle(fontSize: 10, color: context.cl.textSec)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  label: club.isJoined ? 'Leave ${club.name}' : 'Join ${club.name}',
                  button: true,
                  child: Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      onTap: () => _toggleClubMembership(club, index),
                      borderRadius: BorderRadius.circular(8),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: club.isJoined ? club.color.withValues(alpha: 0.15) : club.color,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          club.isJoined ? 'Joined' : 'Join',
                          style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700,
                            color: club.isJoined ? club.color : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── FAB (role + tab aware) ────────────────────────────────────
  Widget? _buildFab() {
    switch (_currentIndex) {
      case 0: // Chats — always show new-chat
        return FloatingActionButton(
          onPressed: _showNewChatSheet,
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.bgMain,
          elevation: 4,
          tooltip: 'New Chat',
          child: const Icon(Icons.chat_rounded),
        );
      case 1: // Groups — show create if eligible
        if (!_canCreateGroup) return null;
        return FloatingActionButton.extended(
          onPressed: _showCreateGroupSheet,
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.bgMain,
          elevation: 4,
          icon: const Icon(Icons.group_add_rounded),
          label: const Text('New Group', style: TextStyle(fontWeight: FontWeight.w700)),
        );
      case 2: // Academic — create cohort/course (teachers/admin only)
        if (!_canCreateClub) return null;
        return FloatingActionButton.extended(
          onPressed: _showCreateAcademicSheet,
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.bgMain,
          elevation: 4,
          icon: const Icon(Icons.school_rounded),
          label: const Text('New Academic', style: TextStyle(fontWeight: FontWeight.w700)),
        );
      case 3: // Clubs — show create if teacher/admin
        if (!_canCreateClub) return null;
        return FloatingActionButton.extended(
          onPressed: _showCreateClubSheet,
          backgroundColor: AppColors.brand,
          foregroundColor: AppColors.bgMain,
          elevation: 4,
          icon: const Icon(Icons.add_rounded),
          label: const Text('New Club', style: TextStyle(fontWeight: FontWeight.w700)),
        );
      default:
        return null;
    }
  }

  // ── Bottom Nav ────────────────────────────────────────────────
  Widget _buildBottomNav(BuildContext context) {
    final totalUnread = _chats.fold(0, (s, c) => s + c.unreadCount);

    // Nav item data: (label, outlineIcon, filledIcon, badge)
    final items = <(String, IconData, IconData, int)>[
      ('Chats',    Icons.chat_bubble_outline_rounded, Icons.chat_bubble_rounded,  totalUnread),
      ('Groups',   Icons.forum_outlined,              Icons.forum_rounded,        0),
      ('Academic', Icons.school_outlined,             Icons.school_rounded,       0),
      ('Clubs',    Icons.groups_outlined,             Icons.groups_rounded,       0),
      ('Profile',  Icons.person_outline_rounded,      Icons.person_rounded,       0),
    ];

    return Container(
      decoration: BoxDecoration(
        color: context.cl.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: context.isDark ? 0.25 : 0.08),
            blurRadius: 12, offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Row(
            children: List.generate(items.length, (i) {
              final (label, outlineIcon, filledIcon, badge) = items[i];
              final isActive = _currentIndex == i;

              // Icon — filled when active, outline when not
              Widget iconWidget = Icon(
                isActive ? filledIcon : outlineIcon,
                size: 26,
                color: isActive ? AppColors.brand : context.cl.textHint,
              );

              // Badge (brand-coloured pill, white text)
              if (badge > 0) {
                iconWidget = Stack(
                  clipBehavior: Clip.none,
                  children: [
                    iconWidget,
                    Positioned(
                      top: -6, right: -10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.brand,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          badge > 99 ? '99+' : '$badge',
                          style: const TextStyle(
                            color: Colors.white, fontSize: 10,
                            fontWeight: FontWeight.w800, height: 1.2,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              }

              return Expanded(
                child: Semantics(
                  label: label,
                  button: true,
                  selected: isActive,
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => setState(() => _currentIndex = i),
                      child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Animated pill background — expands when active
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeInOut,
                        padding: EdgeInsets.symmetric(
                          horizontal: isActive ? 20 : 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.brand.withValues(alpha: 0.12)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: iconWidget,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                          color: isActive ? AppColors.brand : context.cl.textHint,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _emptyState(BuildContext context, String msg, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: context.cl.divider),
          const SizedBox(height: 16),
          Text(msg, style: TextStyle(color: context.cl.textHint, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _errorState(BuildContext context, String msg, VoidCallback onRetry) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off_rounded, size: 48, color: context.cl.textHint),
          const SizedBox(height: 12),
          Text(msg, style: TextStyle(color: context.cl.textSec, fontSize: 14)),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Retry'),
            style: TextButton.styleFrom(foregroundColor: AppColors.brand),
          ),
        ],
      ),
    );
  }
}
