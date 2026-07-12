import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../models/models.dart';
import '../theme/theme_controller.dart';
import 'tenant_screen.dart';

class ProfileScreen extends StatefulWidget {
  final UserModel user;
  final String token;

  const ProfileScreen({super.key, required this.user, required this.token});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loadingProfile = true;
  bool _uploadingAvatar = false;

  String _statusMessage = '';
  bool _notificationsEnabled = true;
  bool _readReceipts = true;
  bool _showLastSeen = true;

  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _statusMessage = prefs.getString('status_message') ?? '';
      _notificationsEnabled = prefs.getBool('notifications_enabled') ?? true;
      _readReceipts = prefs.getBool('privacy_read_receipts') ?? true;
      _showLastSeen = prefs.getBool('privacy_last_seen') ?? true;
    });
  }

  Future<void> _loadProfile() async {
    setState(() { _loadingProfile = true; });
    try {
      final res = await http.get(
        Uri.parse('http://${Config.baseUrl}/api/v1/users/profile'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      ).timeout(const Duration(seconds: 10));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _profile = data['profile'] as Map<String, dynamic>;
          _loadingProfile = false;
        });
      } else {
        setState(() { _loadingProfile = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _loadingProfile = false; });
    }
  }

  String get _displayName => _profile?['fullName'] as String? ?? widget.user.fullName;
  String get _avatarUrl => (_profile?['avatarUrl'] as String?) ?? '';

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 270,
          pinned: true,
          automaticallyImplyLeading: false,
          flexibleSpace: FlexibleSpaceBar(
            background: _buildHeader(context),
          ),
        ),
        SliverToBoxAdapter(child: _buildBody(context)),
      ],
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [
            context.cl.surface,
            context.isDark ? const Color(0xFF1A2540) : const Color(0xFFF1F5F9),
          ],
        ),
      ),
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 16),
            // Avatar
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                Container(
                  width: 96, height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const SweepGradient(
                      colors: [AppColors.brand, AppColors.brandDeep, AppColors.brand],
                    ),
                    boxShadow: [BoxShadow(
                      color: AppColors.brand.withValues(alpha: 0.4),
                      blurRadius: 20, spreadRadius: 2,
                    )],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(3),
                    child: _buildAvatarContent(),
                  ),
                ),
                if (_uploadingAvatar)
                  Container(
                    width: 96, height: 96,
                    decoration: const BoxDecoration(
                      color: Color(0x88000000),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5,
                        ),
                      ),
                    ),
                  ),
                Semantics(
                  label: 'Change profile photo',
                  button: true,
                  child: GestureDetector(
                    onTap: _uploadingAvatar ? null : _pickAvatar,
                    behavior: HitTestBehavior.translucent,
                    child: Container(
                      width: 44, height: 44,
                      alignment: Alignment.center,
                      child: Container(
                        width: 30, height: 30,
                        decoration: BoxDecoration(
                          gradient: AppColors.brandGradient,
                          shape: BoxShape.circle,
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded, size: 15, color: AppColors.bgMain,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(_displayName,
                style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, color: context.cl.text,
                )),
            const SizedBox(height: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
              decoration: BoxDecoration(
                gradient: AppColors.brandGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(widget.user.roleLabel,
                  style: const TextStyle(
                    fontSize: 11, color: AppColors.bgMain, fontWeight: FontWeight.w700,
                  )),
            ),
            const SizedBox(height: 8),
            Semantics(
              label: _statusMessage.isNotEmpty ? 'Edit status: $_statusMessage' : 'Set your status',
              button: true,
              child: InkWell(
                onTap: _editStatus,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _statusMessage.isNotEmpty ? Icons.circle : Icons.edit_rounded,
                        size: 10,
                        color: _statusMessage.isNotEmpty ? AppColors.success : context.cl.textHint,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _statusMessage.isNotEmpty ? _statusMessage : 'Set your status...',
                        style: TextStyle(
                          fontSize: 12,
                          color: _statusMessage.isNotEmpty ? context.cl.textSec : context.cl.textHint,
                          fontStyle: _statusMessage.isEmpty ? FontStyle.italic : FontStyle.normal,
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

  Widget _buildAvatarContent() {
    if (_avatarUrl.isNotEmpty) {
      return CircleAvatar(
        backgroundColor: widget.user.avatarColor,
        backgroundImage: NetworkImage(_avatarUrl),
        onBackgroundImageError: (_, __) {},
      );
    }
    return CircleAvatar(
      backgroundColor: widget.user.avatarColor,
      child: Text(
        widget.user.initials,
        style: const TextStyle(
          fontSize: 32, fontWeight: FontWeight.w800, color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 16),

        // Edit Profile button
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _editProfile,
              icon: const Icon(Icons.edit_rounded, size: 18),
              label: const Text('Edit Profile',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brand,
                foregroundColor: AppColors.bgMain,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
            ),
          ),
        ),

        // Personal Info
        if (_loadingProfile)
          _buildProfileSkeleton(context)
        else ...[
          _sectionLabel(context, 'Personal Info'),
          _sectionCard(context, [
            _infoTile(context, Icons.badge_rounded, 'Student ID',
                _displayId()),
            _divider(context),
            _infoTile(context, Icons.email_rounded, 'Email',
                _profile?['email'] as String? ?? '—'),
            _divider(context),
            _infoTile(context, Icons.phone_rounded, 'Phone',
                _profile?['phone'] as String? ?? '—'),
            _divider(context),
            _infoTile(context, Icons.school_rounded, 'Institution',
                _profile?['tenant']?['name'] as String?
                    ?? widget.user.tenant['name']?.toString() ?? '—'),
            _divider(context),
            _infoTile(context, Icons.group_rounded, 'Cohort',
                _profile?['cohort'] as String? ?? '—'),
            _divider(context),
            _infoTile(context, Icons.calendar_today_rounded, 'Member Since',
                _formatMemberSince(_profile?['memberSince'] as String?)),
          ]),
        ],

        // Settings
        _sectionLabel(context, 'Settings'),
        _sectionCard(context, [
          _themeTile(context),
          _divider(context),
          ListTile(
            leading: const Icon(Icons.notifications_rounded, color: AppColors.brand, size: 22),
            title: Text('Notifications',
                style: TextStyle(fontSize: 14, color: context.cl.text)),
            trailing: Switch(
              value: _notificationsEnabled,
              onChanged: _toggleNotifications,
              activeColor: AppColors.brand,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            dense: true,
          ),
          _divider(context),
          _settingsTile(context, Icons.lock_rounded, 'Privacy',
              onTap: _showPrivacySheet),
          _divider(context),
          _settingsTile(context, Icons.devices_rounded, 'Linked Devices',
              trailing: _profile != null
                  ? Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.brand.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${_profile!['sessionCount'] ?? 1}',
                        style: const TextStyle(
                          fontSize: 12, color: AppColors.brand, fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                  : null,
              onTap: _showLinkedDevices),
          _divider(context),
          _settingsTile(context, Icons.data_usage_rounded, 'Storage & Data',
              onTap: _showStorageData),
        ]),

        // Support
        _sectionLabel(context, 'Support'),
        _sectionCard(context, [
          _settingsTile(context, Icons.help_outline_rounded, 'Help & Support',
              onTap: _showHelpSupport),
          _divider(context),
          _settingsTile(context, Icons.info_outline_rounded, 'About UniChat',
              onTap: _showAbout),
        ]),

        // Logout
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _logout(context),
              icon: const Icon(Icons.logout_rounded, color: AppColors.error),
              label: const Text('Log Out',
                  style: TextStyle(
                    color: AppColors.error, fontSize: 15, fontWeight: FontWeight.w600,
                  )),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: AppColors.error, width: 1.5),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ),

        Padding(
          padding: const EdgeInsets.only(bottom: 28),
          child: Text(
            'UniChat Enterprise v2.0\n© 2026 UniChat',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: context.cl.textHint),
          ),
        ),
      ],
    );
  }

  // ── Skeleton loader ────────────────────────────────────────────────────────

  Widget _buildProfileSkeleton(BuildContext context) {
    return Column(
      children: [
        _sectionLabel(context, 'Personal Info'),
        Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          decoration: BoxDecoration(
            color: context.cl.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: context.cl.divider.withValues(alpha: 0.5)),
          ),
          child: Column(
            children: List.generate(6, (i) => Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      _shimmerBox(22, 22, radius: 11),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _shimmerBox(10, 80),
                            const SizedBox(height: 6),
                            _shimmerBox(14, double.infinity),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (i < 5) Divider(height: 1, indent: 56, color: context.cl.divider),
              ],
            )),
          ),
        ),
      ],
    );
  }

  Widget _shimmerBox(double height, double width, {double radius = 6}) {
    return AnimatedOpacity(
      opacity: 1,
      duration: Duration.zero,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0.3, end: 0.7),
        duration: const Duration(milliseconds: 800),
        builder: (_, v, __) => Opacity(
          opacity: v,
          child: Container(
            height: height,
            width: width == double.infinity ? null : width,
            decoration: BoxDecoration(
              color: context.cl.divider,
              borderRadius: BorderRadius.circular(radius),
            ),
          ),
        ),
      ),
    );
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────

  Future<void> _pickAvatar() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _buildAvatarSourceSheet(),
    );
    if (source == null || !mounted) return;

    final XFile? image = await _picker.pickImage(
      source: source, maxWidth: 800, maxHeight: 800, imageQuality: 85,
    );
    if (image == null || !mounted) return;

    setState(() { _uploadingAvatar = true; });
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
        setState(() { _uploadingAvatar = false; });
        _showSnack('Upload failed. Try again.');
        return;
      }

      final body = jsonDecode(responseBody) as Map<String, dynamic>;
      final rawUrl = body['url'] as String? ?? '';
      // Replace localhost with actual server IP so mobile can reach it
      final avatarUrl = rawUrl.replaceFirst('http://localhost', 'http://${Config.baseUrl}');

      final patchRes = await http.patch(
        Uri.parse('http://${Config.baseUrl}/api/v1/users/profile'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'avatarUrl': avatarUrl}),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;
      if (patchRes.statusCode == 200) {
        setState(() {
          _profile = {...?_profile, 'avatarUrl': avatarUrl};
          _uploadingAvatar = false;
        });
        _showSnack('Profile photo updated!');
      } else {
        setState(() { _uploadingAvatar = false; });
        _showSnack('Could not save photo. Try again.');
      }
    } catch (_) {
      if (mounted) {
        setState(() { _uploadingAvatar = false; });
        _showSnack('Upload failed. Check connection.');
      }
    }
  }

  Widget _buildAvatarSourceSheet() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: context.cl.divider, borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text('Change Photo',
              style: TextStyle(
                fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
              )),
          const SizedBox(height: 20),
          _sourceOption(Icons.photo_library_rounded, 'Choose from Gallery',
              ImageSource.gallery),
          const SizedBox(height: 10),
          _sourceOption(Icons.camera_alt_rounded, 'Take a Photo',
              ImageSource.camera),
          if (_avatarUrl.isNotEmpty) ...[
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                _removeAvatar();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 20),
                    SizedBox(width: 10),
                    Text('Remove Photo',
                        style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600,
                          color: AppColors.error,
                        )),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _sourceOption(IconData icon, String label, ImageSource source) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: () => Navigator.pop(context, source),
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: context.cl.divider),
            ),
            child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                gradient: AppColors.brandGradient,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, color: AppColors.bgMain, size: 20),
            ),
            const SizedBox(width: 14),
            Text(label,
                style: TextStyle(
                  fontSize: 15, fontWeight: FontWeight.w600, color: context.cl.text,
                )),
          ],
          ),
        ),
      ),
    ),
  );
  }

  Future<void> _removeAvatar() async {
    setState(() { _uploadingAvatar = true; });
    try {
      final res = await http.patch(
        Uri.parse('http://${Config.baseUrl}/api/v1/users/profile'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'avatarUrl': null}),
      ).timeout(const Duration(seconds: 10));
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          _profile = {...?_profile, 'avatarUrl': null};
          _uploadingAvatar = false;
        });
        _showSnack('Profile photo removed.');
      } else {
        setState(() { _uploadingAvatar = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _uploadingAvatar = false; });
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  void _editStatus() {
    final ctrl = TextEditingController(text: _statusMessage);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => AnimatedPadding(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: context.cl.divider, borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Status Message',
                  style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
                  )),
              const SizedBox(height: 4),
              Text("Tell others what you're up to",
                  style: TextStyle(fontSize: 13, color: context.cl.textSec)),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  color: context.cl.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.cl.divider),
                ),
                child: TextField(
                  controller: ctrl,
                  autofocus: true,
                  style: TextStyle(color: context.cl.text, fontSize: 14),
                  maxLength: 120,
                  decoration: InputDecoration(
                    hintText: 'e.g. Available for study sessions 📚',
                    hintStyle: TextStyle(color: context.cl.textHint),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(14),
                    counterStyle: TextStyle(color: context.cl.textHint, fontSize: 11),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: context.cl.divider),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: Text('Cancel',
                          style: TextStyle(color: context.cl.textSec)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        final newStatus = ctrl.text.trim();
                        final prefs = await SharedPreferences.getInstance();
                        await prefs.setString('status_message', newStatus);
                        if (!mounted) return;
                        setState(() { _statusMessage = newStatus; });
                        Navigator.pop(ctx);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.brand,
                        foregroundColor: AppColors.bgMain,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Save',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Edit Profile ───────────────────────────────────────────────────────────

  void _editProfile() {
    final nameCtrl = TextEditingController(
        text: _profile?['fullName'] as String? ?? widget.user.fullName);
    final phoneCtrl = TextEditingController(
        text: _profile?['phone'] as String? ?? '');
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => AnimatedPadding(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: context.cl.divider, borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text('Edit Profile',
                  style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
                  )),
              const SizedBox(height: 16),
              _formField(context, 'Full Name', nameCtrl, Icons.person_rounded,
                  'Your full name'),
              const SizedBox(height: 12),
              _formField(context, 'Phone Number', phoneCtrl, Icons.phone_rounded,
                  'e.g. +254 7XX XXX XXX',
                  keyboardType: TextInputType.phone),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: saving ? null : () async {
                    setSheet(() { saving = true; });
                    try {
                      final res = await http.patch(
                        Uri.parse('http://${Config.baseUrl}/api/v1/users/profile'),
                        headers: {
                          'Authorization': 'Bearer ${widget.token}',
                          'Content-Type': 'application/json',
                        },
                        body: jsonEncode({
                          'fullName': nameCtrl.text.trim(),
                          'phone': phoneCtrl.text.trim(),
                        }),
                      ).timeout(const Duration(seconds: 10));

                      if (!ctx.mounted) return;
                      if (res.statusCode == 200) {
                        final data = jsonDecode(res.body) as Map<String, dynamic>;
                        final u = data['user'] as Map<String, dynamic>;
                        if (mounted) {
                          setState(() {
                            _profile = {
                              ...?_profile,
                              'fullName': u['fullName'],
                              'phone': u['phone'],
                            };
                          });
                        }
                        Navigator.pop(ctx);
                        _showSnack('Profile updated successfully!');
                      } else {
                        setSheet(() { saving = false; });
                        _showSnack('Failed to save. Try again.');
                      }
                    } catch (_) {
                      if (ctx.mounted) {
                        setSheet(() { saving = false; });
                        _showSnack('Network error. Check connection.');
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brand,
                    foregroundColor: AppColors.bgMain,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: saving
                      ? const SizedBox(
                          height: 20, width: 20,
                          child: CircularProgressIndicator(
                            color: AppColors.bgMain, strokeWidth: 2,
                          ))
                      : const Text('Save Changes',
                          style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15,
                          )),
                ),
              ),
            ],
          ),   // Column
          ),   // SingleChildScrollView
        ),     // AnimatedPadding
      ),       // StatefulBuilder
    );
  }

  Widget _formField(
    BuildContext context,
    String label,
    TextEditingController ctrl,
    IconData icon,
    String hint, {
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600, color: context.cl.textSec,
            )),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: context.cl.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.cl.divider),
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Icon(icon, color: AppColors.brand, size: 20),
              ),
              Expanded(
                child: TextField(
                  controller: ctrl,
                  keyboardType: keyboardType,
                  style: TextStyle(color: context.cl.text, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: hint,
                    hintStyle: TextStyle(color: context.cl.textHint),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  void _toggleNotifications(bool value) async {
    setState(() { _notificationsEnabled = value; });
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_enabled', value);
    _showSnack(
      value ? 'Notifications enabled.' : 'Notifications disabled.',
    );
  }

  // ── Privacy ────────────────────────────────────────────────────────────────

  void _showPrivacySheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: context.cl.divider, borderRadius: BorderRadius.circular(2),
                ),
              ),
              Text('Privacy',
                  style: TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
                  )),
              const SizedBox(height: 20),
              _privacyToggle(
                'Read Receipts',
                'Show when you\'ve read messages',
                _readReceipts,
                (v) async {
                  setState(() { _readReceipts = v; });
                  setSheet(() {});
                  final p = await SharedPreferences.getInstance();
                  await p.setBool('privacy_read_receipts', v);
                },
              ),
              const SizedBox(height: 10),
              _privacyToggle(
                'Last Seen',
                'Show your last active time to others',
                _showLastSeen,
                (v) async {
                  setState(() { _showLastSeen = v; });
                  setSheet(() {});
                  final p = await SharedPreferences.getInstance();
                  await p.setBool('privacy_last_seen', v);
                },
              ),
              const SizedBox(height: 10),
              _privacyToggle(
                'Profile Photo',
                'Allow others to see your profile photo',
                true,
                (_) {},
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _privacyToggle(
    String title, String subtitle, bool value, ValueChanged<bool> onChanged,
  ) {
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
                    style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: context.cl.text,
                    )),
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

  // ── Linked Devices ─────────────────────────────────────────────────────────

  void _showLinkedDevices() {
    final count = (_profile?['sessionCount'] as int?) ?? 1;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: context.cl.divider, borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text('Linked Devices',
                style: TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
                )),
            const SizedBox(height: 4),
            Text('Active UniChat sessions',
                style: TextStyle(fontSize: 13, color: context.cl.textSec)),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: context.cl.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.cl.divider),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      gradient: AppColors.brandGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.smartphone_rounded,
                      color: AppColors.bgMain, size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('This Device',
                            style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600,
                              color: context.cl.text,
                            )),
                        Text('Android · Current session',
                            style: TextStyle(
                              fontSize: 12, color: context.cl.textSec,
                            )),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('Active',
                        style: TextStyle(
                          fontSize: 11, color: AppColors.success,
                          fontWeight: FontWeight.w700,
                        )),
                  ),
                ],
              ),
            ),
            if (count > 1) ...[
              const SizedBox(height: 10),
              Text(
                '+ ${count - 1} other session${count > 2 ? 's' : ''}',
                style: TextStyle(fontSize: 12, color: context.cl.textHint),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Storage & Data ─────────────────────────────────────────────────────────

  void _showStorageData() async {
    final prefs = await SharedPreferences.getInstance();
    final keyCount = prefs.getKeys().length;
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) {
        bool clearing = false;
        return StatefulBuilder(
          builder: (ctx, setSheet) => Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: context.cl.divider,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Text('Storage & Data',
                    style: TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800,
                      color: context.cl.text,
                    )),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: context.cl.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: context.cl.divider),
                  ),
                  child: Column(
                    children: [
                      _storageRow(context, Icons.settings_rounded,
                          'App Preferences', '$keyCount entries'),
                      const SizedBox(height: 12),
                      _storageRow(context, Icons.chat_rounded,
                          'Message Cache', 'Managed by system'),
                      const SizedBox(height: 12),
                      _storageRow(context, Icons.image_rounded,
                          'Media', 'Stored on server'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: clearing ? null : () async {
                      setSheet(() { clearing = true; });
                      final p = await SharedPreferences.getInstance();
                      // Keep auth-critical keys
                      const keep = {'tenant_id', 'auth_token', 'user_data'};
                      final toDelete = p.getKeys()
                          .where((k) => !keep.contains(k) && !k.startsWith('auth'))
                          .toList();
                      for (final k in toDelete) await p.remove(k);
                      if (!mounted) return;
                      setState(() {
                        _statusMessage = '';
                        _notificationsEnabled = true;
                        _readReceipts = true;
                        _showLastSeen = true;
                      });
                      Navigator.pop(ctx);
                      _showSnack('Cache cleared successfully.');
                    },
                    icon: const Icon(Icons.cleaning_services_rounded,
                        color: AppColors.error, size: 18),
                    label: Text(
                      clearing ? 'Clearing...' : 'Clear App Cache',
                      style: const TextStyle(
                        color: AppColors.error, fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.error, width: 1.5),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _storageRow(BuildContext context, IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: AppColors.brand, size: 18),
        const SizedBox(width: 12),
        Expanded(child: Text(label,
            style: TextStyle(fontSize: 13, color: context.cl.text))),
        Text(value,
            style: TextStyle(fontSize: 12, color: context.cl.textHint)),
      ],
    );
  }

  // ── Help & Support ─────────────────────────────────────────────────────────

  void _showHelpSupport() {
    const faqs = [
      (
        'How do I start a chat?',
        'Tap the "+" button on the Chats tab and search for a person or select an existing group.'
      ),
      (
        'Why are my messages not appearing?',
        'Check your internet connection. Messages are saved on the server and will appear once connected.'
      ),
      (
        'How do I join a club?',
        'Go to the Clubs tab and tap "Join" on any club you\'d like to join.'
      ),
      (
        'Can I change my display name?',
        'Yes! Tap "Edit Profile" at the top of the Profile tab to update your name.'
      ),
      (
        'How do I update my profile photo?',
        'Tap the camera icon on your profile picture to choose from your gallery or take a new photo.'
      ),
      (
        'How do I log out?',
        'Scroll to the bottom of the Profile tab and tap "Log Out".'
      ),
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        builder: (_, ctrl) => Column(
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              decoration: BoxDecoration(
                color: context.cl.divider, borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                children: [
                  Text('Help & Support',
                      style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w800,
                        color: context.cl.text,
                      )),
                  const SizedBox(height: 4),
                  Text('Frequently Asked Questions',
                      style: TextStyle(
                        fontSize: 13, color: context.cl.textSec,
                      )),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                controller: ctrl,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                itemCount: faqs.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _faqTile(faqs[i].$1, faqs[i].$2),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _faqTile(String question, String answer) {
    return Container(
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.cl.divider),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        iconColor: AppColors.brand,
        collapsedIconColor: context.cl.textHint,
        shape: const Border(),
        collapsedShape: const Border(),
        title: Text(question,
            style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w600, color: context.cl.text,
            )),
        children: [
          Text(answer,
              style: TextStyle(
                fontSize: 13, color: context.cl.textSec, height: 1.5,
              )),
        ],
      ),
    );
  }

  // ── About ──────────────────────────────────────────────────────────────────

  void _showAbout() {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: context.cl.divider, borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(
                gradient: AppColors.brandGradient,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.brand.withValues(alpha: 0.3),
                    blurRadius: 16, spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.chat_bubble_rounded, color: AppColors.bgMain, size: 36,
              ),
            ),
            const SizedBox(height: 14),
            Text('UniChat Enterprise',
                style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w800, color: context.cl.text,
                )),
            const SizedBox(height: 4),
            Text('Version 2.0.0',
                style: TextStyle(fontSize: 13, color: context.cl.textHint)),
            const SizedBox(height: 20),
            _aboutItem(Icons.security_rounded, 'Privacy Policy'),
            const SizedBox(height: 8),
            _aboutItem(Icons.description_rounded, 'Terms of Service'),
            const SizedBox(height: 8),
            _aboutItem(Icons.article_rounded, 'Open Source Licenses'),
            const SizedBox(height: 20),
            Text(
              'Made with ❤️ for institutions worldwide\n© 2026 UniChat. All rights reserved.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11, color: context.cl.textHint, height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _aboutItem(IconData icon, String label) {
    return Material(
      color: context.cl.card,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.cl.divider),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.brand, size: 18),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: TextStyle(fontSize: 14, color: context.cl.text))),
              Icon(Icons.chevron_right, size: 18, color: context.cl.textHint),
            ],
          ),
        ),
      ),
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  Future<void> _logout(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.cl.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Log Out', style: TextStyle(color: context.cl.text)),
        content: Text('Are you sure you want to log out?',
            style: TextStyle(color: context.cl.textSec)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Cancel',
                  style: TextStyle(color: context.cl.textSec))),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Log Out',
                  style: TextStyle(
                    color: AppColors.error, fontWeight: FontWeight.w700,
                  ))),
        ],
      ),
    );

    if (confirm != true || !context.mounted) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const TenantScreen()),
      (_) => false,
    );
  }

  // ── Theme Picker ───────────────────────────────────────────────────────────

  Widget _themeTile(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.mode,
      builder: (_, mode, __) => ListTile(
        leading: Icon(ThemeController.icon(mode), color: AppColors.brand, size: 22),
        title: Text('Appearance',
            style: TextStyle(fontSize: 14, color: context.cl.text)),
        subtitle: Text(ThemeController.label(mode),
            style: TextStyle(fontSize: 12, color: context.cl.textSec)),
        trailing: Icon(Icons.chevron_right, size: 20, color: context.cl.textHint),
        dense: true,
        onTap: () => _showThemePicker(context),
      ),
    );
  }

  void _showThemePicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.cl.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: context.cl.divider, borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text('Appearance',
                style: TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text,
                )),
            const SizedBox(height: 4),
            Text('Choose how UniChat looks on this device',
                style: TextStyle(fontSize: 13, color: context.cl.textSec)),
            const SizedBox(height: 20),
            ...ThemeMode.values.map((m) => _themeOption(context, m)),
          ],
        ),
      ),
    );
  }

  Widget _themeOption(BuildContext context, ThemeMode m) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.mode,
      builder: (_, current, __) {
        final isSelected = current == m;
        return Semantics(
          button: true,
          label: 'Set theme to ${ThemeController.label(m)}',
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () { ThemeController.set(m); Navigator.pop(context); },
              borderRadius: BorderRadius.circular(14),
              child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.brand.withValues(alpha: 0.1)
                  : context.cl.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isSelected ? AppColors.brand : context.cl.divider,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    gradient: isSelected ? AppColors.brandGradient : null,
                    color: isSelected ? null : context.cl.cardLight,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(ThemeController.icon(m),
                      color: isSelected ? AppColors.bgMain : context.cl.textSec,
                      size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(ThemeController.label(m),
                      style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600,
                        color: isSelected ? AppColors.brand : context.cl.text,
                      )),
                ),
                if (isSelected)
                  Container(
                    width: 22, height: 22,
                    decoration: BoxDecoration(
                        gradient: AppColors.brandGradient, shape: BoxShape.circle),
                    child: const Icon(Icons.check, size: 14, color: AppColors.bgMain),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
      },
    );
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  Widget _sectionCard(BuildContext context, List<Widget> children) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.cl.divider.withValues(alpha: 0.5)),
      ),
      child: Column(children: children),
    );
  }

  Widget _sectionLabel(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 16, 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(label.toUpperCase(),
            style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: context.cl.textHint, letterSpacing: 1,
            )),
      ),
    );
  }

  Widget _infoTile(
      BuildContext context, IconData icon, String label, String value) {
    return ListTile(
      leading: Icon(icon, color: AppColors.brand, size: 22),
      title: Text(label,
          style: TextStyle(fontSize: 12, color: context.cl.textHint)),
      subtitle: Text(value,
          style: TextStyle(fontSize: 14, color: context.cl.text)),
      dense: true,
    );
  }

  Widget _settingsTile(
    BuildContext context,
    IconData icon,
    String label, {
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.brand, size: 22),
      title: Text(label, style: TextStyle(fontSize: 14, color: context.cl.text)),
      trailing: trailing ??
          Icon(Icons.chevron_right, size: 20, color: context.cl.textHint),
      onTap: onTap,
      dense: true,
    );
  }

  Widget _divider(BuildContext context) =>
      Divider(height: 1, indent: 56, color: context.cl.divider);

  // ── Helpers ────────────────────────────────────────────────────────────────

  String _displayId() {
    final sid = _profile?['studentId'] as String?;
    final staffId = _profile?['staffId'] as String?;
    final uid = _profile?['id'] as String? ?? widget.user.id;
    if (sid != null && sid.isNotEmpty) return sid;
    if (staffId != null && staffId.isNotEmpty) return staffId;
    return uid.length > 8 ? uid.substring(0, 8).toUpperCase() : uid;
  }

  String _formatMemberSince(String? iso) {
    if (iso == null) return '—';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '—';
    const m = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];
    return '${m[dt.month - 1]} ${dt.year}';
  }

  void _showSnack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      backgroundColor: const Color(0xFF1E293B),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 2),
    ));
  }
}
