import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class TenantBranding {
  final Color primaryColor;
  final Color accentColor;
  final String? logoUrl;
  final String fontFamily;
  final String institutionName;
  final String institutionSlug;

  const TenantBranding({
    required this.primaryColor,
    required this.accentColor,
    this.logoUrl,
    this.fontFamily = 'Poppins',
    this.institutionName = '',
    this.institutionSlug = '',
  });

  static const defaults = TenantBranding(
    primaryColor: AppColors.brand,
    accentColor: AppColors.brandDeep,
    fontFamily: 'Poppins',
  );

  factory TenantBranding.fromJson(Map<String, dynamic> json) {
    final b = (json['branding'] as Map<String, dynamic>?) ?? {};
    return TenantBranding(
      primaryColor: _hex(b['primaryColor']) ?? AppColors.brand,
      accentColor: _hex(b['accentColor'] ?? b['secondaryColor']) ?? AppColors.brandDeep,
      logoUrl: json['logoUrl'] as String?,
      fontFamily: (b['fontFamily'] as String?) ?? 'Poppins',
      institutionName: (json['name'] as String?) ?? '',
      institutionSlug: (json['slug'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'primaryColor': _toHex(primaryColor),
    'accentColor': _toHex(accentColor),
    'logoUrl': logoUrl,
    'fontFamily': fontFamily,
    'institutionName': institutionName,
    'institutionSlug': institutionSlug,
  };

  static Color? _hex(dynamic v) {
    if (v == null) return null;
    try {
      final s = v.toString().replaceAll('#', '').trim();
      if (s.length == 6) return Color(int.parse('FF$s', radix: 16));
      if (s.length == 8) return Color(int.parse(s, radix: 16));
    } catch (_) {}
    return null;
  }

  static String _toHex(Color c) {
    final argb = c.toARGB32();
    return '#${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';
  }
}

class BrandingController {
  static final ValueNotifier<TenantBranding> branding =
      ValueNotifier(TenantBranding.defaults);

  static Color get primaryColor => branding.value.primaryColor;
  static Color get accentColor => branding.value.accentColor;

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('tenant_branding');
    if (raw == null) return;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final pc = TenantBranding._hex(json['primaryColor']);
      final ac = TenantBranding._hex(json['accentColor']);
      if (pc != null) {
        branding.value = TenantBranding(
          primaryColor: pc,
          accentColor: ac ?? AppColors.brandDeep,
          logoUrl: json['logoUrl'] as String?,
          fontFamily: (json['fontFamily'] as String?) ?? 'Poppins',
          institutionName: (json['institutionName'] as String?) ?? '',
          institutionSlug: (json['institutionSlug'] as String?) ?? '',
        );
      }
    } catch (_) {}
  }

  static Future<void> fetchAndApply(String slug) async {
    try {
      final res = await http
          .get(Uri.parse('http://${Config.baseUrl}/api/v1/tenants/$slug'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final tb = TenantBranding.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        branding.value = tb;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('tenant_branding', jsonEncode(tb.toJson()));
      }
    } catch (_) {}
  }

  static void reset() => branding.value = TenantBranding.defaults;
}
