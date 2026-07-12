import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController {
  static final ValueNotifier<ThemeMode> mode = ValueNotifier(ThemeMode.system);
  static const _key = 'theme_mode';

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_key);
    if (saved != null) {
      mode.value = ThemeMode.values.firstWhere(
        (m) => m.name == saved,
        orElse: () => ThemeMode.system,
      );
    }
  }

  static Future<void> set(ThemeMode m) async {
    mode.value = m;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, m.name);
  }

  static String label(ThemeMode m) {
    switch (m) {
      case ThemeMode.dark: return 'Dark';
      case ThemeMode.light: return 'Light';
      case ThemeMode.system: return 'System default';
    }
  }

  static IconData icon(ThemeMode m) {
    switch (m) {
      case ThemeMode.dark: return Icons.dark_mode_rounded;
      case ThemeMode.light: return Icons.light_mode_rounded;
      case ThemeMode.system: return Icons.brightness_auto_rounded;
    }
  }
}
