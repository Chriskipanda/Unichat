import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Context extension — theme-aware color lookups.
// Use context.cl.bg instead of AppColors.bgMain so screens adapt to light/dark.
extension AppThemeX on BuildContext {
  AppColorSet get cl => AppColorSet(this);
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

class AppColorSet {
  final BuildContext _c;
  const AppColorSet(this._c);
  bool get _d => Theme.of(_c).brightness == Brightness.dark;

  Color get bg         => _d ? AppColors.bgMain      : const Color(0xFFF0F2F5);
  Color get surface    => _d ? AppColors.bgSurface   : Colors.white;
  Color get card       => _d ? AppColors.bgCard      : Colors.white;
  Color get cardLight  => _d ? AppColors.bgCardLight : const Color(0xFFF8FAFC);
  Color get divider    => _d ? AppColors.divider     : const Color(0xFFE2E8F0);
  Color get text       => _d ? AppColors.textPrimary : const Color(0xFF0F172A);
  Color get textSec    => _d ? AppColors.textSecondary : const Color(0xFF475569);
  Color get textHint   => _d ? AppColors.textHint    : const Color(0xFF94A3B8);
  Color get chatBg     => _d ? const Color(0xFF0A1628) : const Color(0xFFEFEFF4);
  // Brand, error, success are the same in both themes.
}

class Config {
  // Runtime-editable — persisted in SharedPreferences under key 'server_url'.
  // Falls back to the hardcoded default if nothing is saved.
  static String _baseUrl = 'localhost';
  static String get baseUrl => _baseUrl;

  /// Load the saved server URL from storage (call once at startup).
  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('server_url');
    if (saved != null && saved.trim().isNotEmpty) {
      _baseUrl = saved.trim();
    }
  }

  /// Persist a new server URL so it survives app restarts.
  static Future<void> setBaseUrl(String url) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return;
    _baseUrl = trimmed;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', trimmed);
  }

  /// The hardcoded fallback, shown as placeholder in the picker.
  static const String defaultUrl = 'localhost';
  static const String appName = 'UniChat';
}

class AppColors {
  // ── Brand ──────────────────────────────────────────
  static const Color brand        = Color(0xFFFBBC05);
  static const Color brandLight   = Color(0xFFFDE68A);
  static const Color brandLightest= Color(0xFFFFF8DB);
  static const Color brandDeep    = Color(0xFFD97706);
  static const Color brandDark    = Color(0xFF92400E);

  // ── Dark Surfaces ───────────────────────────────────
  static const Color bgMain       = Color(0xFF0F172A);
  static const Color bgSurface    = Color(0xFF111827);
  static const Color bgCard       = Color(0xFF1E293B);
  static const Color bgCardLight  = Color(0xFF243247);
  static const Color divider      = Color(0xFF334155);

  // ── Text ────────────────────────────────────────────
  static const Color textPrimary  = Color(0xFFF8FAFC);
  static const Color textSecondary= Color(0xFF94A3B8);
  static const Color textHint     = Color(0xFF64748B);

  // ── Status ──────────────────────────────────────────
  static const Color online       = Color(0xFFFBBC05);
  static const Color typing       = Color(0xFFFDE68A);
  static const Color error        = Color(0xFFEF4444);
  static const Color success      = Color(0xFF22C55E);

  // ── Gradients ───────────────────────────────────────
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brand, brandDeep],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient bgGradient = LinearGradient(
    colors: [bgMain, bgSurface],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient glassGradient = LinearGradient(
    colors: [Color(0x14FFFFFF), Color(0x05FFFFFF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class AppTextStyles {
  static TextStyle display(BuildContext context) =>
      Theme.of(context).textTheme.displaySmall!.copyWith(
        color: AppColors.textPrimary, fontWeight: FontWeight.w700,
      );

  static TextStyle title(BuildContext context) =>
      Theme.of(context).textTheme.titleLarge!.copyWith(
        color: AppColors.textPrimary, fontWeight: FontWeight.w700,
      );

  static TextStyle body(BuildContext context) =>
      Theme.of(context).textTheme.bodyMedium!.copyWith(
        color: AppColors.textPrimary,
      );

  static TextStyle caption(BuildContext context) =>
      Theme.of(context).textTheme.labelSmall!.copyWith(
        color: AppColors.textSecondary,
      );
}
