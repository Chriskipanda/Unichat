import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/models.dart';
import '../theme/branding_controller.dart';
import '../widgets/glass_card.dart';
import 'login_screen.dart';

class TenantScreen extends StatefulWidget {
  const TenantScreen({super.key});

  @override
  State<TenantScreen> createState() => _TenantScreenState();
}

class _TenantScreenState extends State<TenantScreen>
    with SingleTickerProviderStateMixin {
  TenantModel? _selected;
  List<TenantModel> _institutions = [];
  bool _loading = true;
  String _error = '';

  late AnimationController _ctrl;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _slide = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _ctrl.forward();
    // Load saved server URL then fetch institutions
    Config.load().then((_) { if (mounted) _loadInstitutions(); });
  }

  Future<void> _loadInstitutions() async {
    setState(() { _loading = true; _error = ''; });
    try {
      final res = await http
          .get(Uri.parse('http://${Config.baseUrl}/api/v1/auth/institutions'))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final list = (data['institutions'] as List<dynamic>? ?? [])
            .map((j) => TenantModel.fromJson(j as Map<String, dynamic>))
            .toList();
        if (mounted) setState(() { _institutions = list; _loading = false; });
      } else {
        if (mounted) setState(() { _error = 'Failed to load institutions.'; _loading = false; });
      }
    } catch (_) {
      if (mounted) setState(() { _error = 'Network error. Check your connection.'; _loading = false; });
    }
  }

  void _selectInstitution(TenantModel tenant) {
    setState(() => _selected = tenant);
    // Fetch and apply branding in background — MaterialApp rebuilds instantly
    BrandingController.fetchAndApply(tenant.slug);
  }

  void _proceed() {
    if (_selected == null) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => LoginScreen(tenant: _selected!)),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            top: -100, left: -60,
            child: Container(
              width: 320, height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [primary.withValues(alpha: 0.12), Colors.transparent],
                ),
              ),
            ),
          ),
          SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: SlideTransition(
                position: _slide,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 32),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 44, height: 44,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [primary, Theme.of(context).colorScheme.secondary],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.school_rounded, color: AppColors.bgMain, size: 24),
                              ),
                              const SizedBox(width: 12),
                              Text('UniChat',
                                style: TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w800,
                                  color: context.cl.text, letterSpacing: 0.3,
                                )),
                            ],
                          ),
                          const SizedBox(height: 28),
                          Text('Select your\nInstitution',
                            style: TextStyle(
                              fontSize: 30, fontWeight: FontWeight.w800,
                              color: context.cl.text, height: 1.15,
                            )),
                          const SizedBox(height: 8),
                          Text('Choose your university or college to continue',
                            style: TextStyle(fontSize: 14, color: context.cl.textSec)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Expanded(child: _buildBody(primary)),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                      child: GoldButton(
                        label: 'Continue',
                        icon: Icons.arrow_forward_rounded,
                        onTap: _selected != null ? _proceed : null,
                      ),
                    ),
                    // ── Server picker ──────────────────────────────
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                      child: Semantics(
                        label: 'Server: ${Config.baseUrl}. Tap to change server address.',
                        button: true,
                        child: Material(
                          color: context.cl.card,
                          borderRadius: BorderRadius.circular(12),
                          child: InkWell(
                            onTap: _showServerPicker,
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: context.cl.divider),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.dns_rounded, size: 16, color: context.cl.textHint),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Server: ${Config.baseUrl}',
                                      style: TextStyle(fontSize: 12, color: context.cl.textSec),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Icon(Icons.edit_rounded, size: 14, color: context.cl.textHint),
                                ],
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
        ],
      ),
    );
  }

  void _showServerPicker() {
    final ctrl = TextEditingController(text: Config.baseUrl);
    // Common presets for different scenarios
    final presets = <(String, String)>[
      ('Local WiFi', Config.defaultUrl),
      ('Android Emulator', '10.0.2.2:3000'),
      ('iOS Simulator', 'localhost:3000'),
      ('Localhost (USB)', '127.0.0.1:3000'),
    ];

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.cl.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Icon(Icons.dns_rounded, color: AppColors.brand, size: 22),
          const SizedBox(width: 8),
          Text('Server Address',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: context.cl.text)),
        ]),
        content: StatefulBuilder(
          builder: (ctx, setDialog) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Enter host:port (no http://)',
                style: TextStyle(fontSize: 12, color: context.cl.textHint)),
              const SizedBox(height: 10),
              // Text input
              Container(
                decoration: BoxDecoration(
                  color: context.cl.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: context.cl.divider),
                ),
                child: TextField(
                  controller: ctrl,
                  autofocus: true,
                  style: TextStyle(color: context.cl.text, fontSize: 14, fontFamily: 'monospace'),
                  decoration: InputDecoration(
                    hintText: Config.defaultUrl,
                    hintStyle: TextStyle(color: context.cl.textHint),
                    prefixIcon: Icon(Icons.link_rounded, color: AppColors.brand, size: 18),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              // Quick presets
              Text('Quick presets',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                    color: context.cl.textHint, letterSpacing: 0.4)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6, runSpacing: 6,
                children: presets.map(((String label, String url) p) {
                  final isActive = ctrl.text.trim() == p.$2;
                  return Material(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    child: InkWell(
                      onTap: () => setDialog(() => ctrl.text = p.$2),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isActive
                              ? AppColors.brand.withValues(alpha: 0.15)
                              : context.cl.card,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isActive ? AppColors.brand : context.cl.divider,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(p.$1,
                              style: TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700,
                                color: isActive ? AppColors.brand : context.cl.textSec,
                              )),
                            Text(p.$2,
                              style: TextStyle(
                                fontSize: 10, fontFamily: 'monospace',
                                color: isActive ? AppColors.brand : context.cl.textHint,
                              )),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: context.cl.textSec)),
          ),
          TextButton(
            onPressed: () async {
              final url = ctrl.text.trim();
              if (url.isEmpty) return;
              await Config.setBaseUrl(url);
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              // Reload institutions with the new URL
              if (mounted) setState(() { _institutions = []; _selected = null; });
              _loadInstitutions();
            },
            child: const Text('Save & Reconnect',
              style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(Color primary) {
    if (_loading) {
      return Center(
        child: CircularProgressIndicator(color: primary, strokeWidth: 2.5),
      );
    }
    if (_error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.wifi_off_rounded, size: 48, color: context.cl.textHint),
              const SizedBox(height: 16),
              Text(_error,
                textAlign: TextAlign.center,
                style: TextStyle(color: context.cl.textSec, fontSize: 14)),
              const SizedBox(height: 20),
              GoldButton(label: 'Retry', icon: Icons.refresh, onTap: _loadInstitutions),
            ],
          ),
        ),
      );
    }
    if (_institutions.isEmpty) {
      return Center(
        child: Text('No institutions available.',
          style: TextStyle(color: context.cl.textSec)),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
      itemCount: _institutions.length,
      itemBuilder: (_, i) => _buildCard(context, _institutions[i], primary),
    );
  }

  Widget _buildCard(BuildContext context, TenantModel tenant, Color primary) {
    final isSelected = _selected?.id == tenant.id;
    return Semantics(
      label: tenant.name,
      button: true,
      selected: isSelected,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => _selectInstitution(tenant),
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? primary.withValues(alpha: 0.1)
              : context.cl.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? primary : context.cl.divider,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48, height: 48,
              decoration: BoxDecoration(
                gradient: isSelected
                    ? LinearGradient(
                        colors: [primary, Theme.of(context).colorScheme.secondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isSelected ? null : context.cl.cardLight,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Center(
                child: Text(
                  tenant.shortName.length > 4
                      ? tenant.shortName.substring(0, 4)
                      : tenant.shortName,
                  style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w800,
                    color: isSelected ? Colors.white : context.cl.textSec,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tenant.name,
                    style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700,
                      color: isSelected ? primary : context.cl.text,
                    )),
                  if (tenant.location.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined, size: 12,
                            color: isSelected ? primary : context.cl.textHint),
                        const SizedBox(width: 3),
                        Text(tenant.location,
                          style: TextStyle(
                            fontSize: 12,
                            color: isSelected ? primary : context.cl.textHint,
                          )),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 22, height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? primary : context.cl.divider,
                  width: 2,
                ),
                color: isSelected ? primary : Colors.transparent,
              ),
              child: isSelected
                  ? const Icon(Icons.check, size: 13, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    ),
  ),
  );
  }
}
