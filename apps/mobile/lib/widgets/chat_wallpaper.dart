import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ── Wallpaper enum ────────────────────────────────────────────────────────────
enum ChatWallpaper {
  waClassicLight,  // WhatsApp-style warm beige + leaf pattern
  waClassicDark,   // WhatsApp-style dark + leaf pattern
  midnightBlue,    // Deep navy gradient
  sunrise,         // Warm gold / brand gradient
  dotLight,        // White + dot grid
  dotDark,         // Dark + dot grid
}

const _kPrefKey = 'chat_wallpaper';

/// Global singleton — ONE source of truth for every chat screen.
/// All `ChatWallpaperView` widgets rebuild automatically when this changes.
class ChatThemeService {
  ChatThemeService._();

  /// The live value. Wrap UI in [ValueListenableBuilder] to react to changes.
  static final ValueNotifier<ChatWallpaper> current =
      ValueNotifier(ChatWallpaper.waClassicLight);

  /// Call once at app startup (e.g. in SplashScreen) to restore the saved choice.
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kPrefKey);
    if (saved != null) {
      current.value = ChatWallpaper.values.firstWhere(
        (w) => w.name == saved,
        orElse: () => ChatWallpaper.waClassicLight,
      );
    }
  }

  /// Persist + instantly propagate to every listening widget.
  static Future<void> set(ChatWallpaper w) async {
    current.value = w;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPrefKey, w.name);
  }
}

// Keep old class name as thin alias so nothing else breaks.
// ignore: deprecated_member_use_from_same_package
@Deprecated('Use ChatThemeService instead')
class ChatWallpaperPrefs {
  static Future<ChatWallpaper> load() => Future.value(ChatThemeService.current.value);
  static Future<void> save(ChatWallpaper w) => ChatThemeService.set(w);
}

// ── Wallpaper metadata ────────────────────────────────────────────────────────
extension ChatWallpaperX on ChatWallpaper {
  String get label {
    switch (this) {
      case ChatWallpaper.waClassicLight: return 'Classic Light';
      case ChatWallpaper.waClassicDark:  return 'Classic Dark';
      case ChatWallpaper.midnightBlue:   return 'Midnight';
      case ChatWallpaper.sunrise:        return 'Sunrise';
      case ChatWallpaper.dotLight:       return 'Dot Light';
      case ChatWallpaper.dotDark:        return 'Dot Dark';
    }
  }

  // Dominant color used for the picker tile preview
  Color get previewColor {
    switch (this) {
      case ChatWallpaper.waClassicLight: return const Color(0xFFEFE5DD);
      case ChatWallpaper.waClassicDark:  return const Color(0xFF0B141A);
      case ChatWallpaper.midnightBlue:   return const Color(0xFF1A2744);
      case ChatWallpaper.sunrise:        return const Color(0xFFD97706);
      case ChatWallpaper.dotLight:       return const Color(0xFFF5F6FA);
      case ChatWallpaper.dotDark:        return const Color(0xFF0F172A);
    }
  }
}

// ── Main wallpaper widget ─────────────────────────────────────────────────────
/// Automatically rebuilds when [ChatThemeService.set] is called anywhere.
/// Wrap the chat body with this widget — no state needed in the parent.
class ChatWallpaperView extends StatelessWidget {
  final Widget child;

  const ChatWallpaperView({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ChatWallpaper>(
      valueListenable: ChatThemeService.current,
      builder: (_, wallpaper, __) => Stack(
        fit: StackFit.expand,
        children: [
          _buildBackground(wallpaper),
          child,
        ],
      ),
    );
  }

  /// Static version so the picker preview tiles can call it directly.
  static Widget _buildBackgroundFor(ChatWallpaper wallpaper) =>
      const ChatWallpaperView(child: SizedBox.shrink())._buildBackground(wallpaper);

  Widget _buildBackground(ChatWallpaper wallpaper) {
    switch (wallpaper) {
      // ── WhatsApp Classic Light ────────────────────────────────────────────
      case ChatWallpaper.waClassicLight:
        return CustomPaint(
          painter: _LeafPatternPainter(
            base: const Color(0xFFEFE5DD),
            pattern: const Color(0xFFD6CCBF),
          ),
        );

      // ── WhatsApp Classic Dark ─────────────────────────────────────────────
      case ChatWallpaper.waClassicDark:
        return CustomPaint(
          painter: _LeafPatternPainter(
            base: const Color(0xFF0B141A),
            pattern: const Color(0xFF182027),
          ),
        );

      // ── Midnight Blue gradient ────────────────────────────────────────────
      case ChatWallpaper.midnightBlue:
        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF1A2744), Color(0xFF0E1F3D)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              stops: [0.0, 0.5, 1.0],
            ),
          ),
          child: CustomPaint(painter: _DotPatternPainter(
            color: Colors.white.withValues(alpha: 0.04),
          )),
        );

      // ── Sunrise (brand gradient) ──────────────────────────────────────────
      case ChatWallpaper.sunrise:
        return Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF92400E), Color(0xFFD97706), Color(0xFFFBBC05)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0.0, 0.55, 1.0],
            ),
          ),
          child: CustomPaint(painter: _DiamondPatternPainter(
            color: Colors.white.withValues(alpha: 0.06),
          )),
        );

      // ── Dot Light ─────────────────────────────────────────────────────────
      case ChatWallpaper.dotLight:
        return CustomPaint(
          painter: _DotPatternPainter(
            base: const Color(0xFFF5F6FA),
            color: const Color(0xFFCED3DE),
          ),
        );

      // ── Dot Dark ──────────────────────────────────────────────────────────
      case ChatWallpaper.dotDark:
        return CustomPaint(
          painter: _DotPatternPainter(
            base: const Color(0xFF0F172A),
            color: Colors.white.withValues(alpha: 0.06),
          ),
        );
    }
  }
}

// ── Leaf / Floral pattern (WhatsApp default style) ────────────────────────────
class _LeafPatternPainter extends CustomPainter {
  final Color base;
  final Color pattern;
  const _LeafPatternPainter({required this.base, required this.pattern});

  @override
  void paint(Canvas canvas, Size size) {
    // Fill background
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height),
        Paint()..color = base);

    final paint = Paint()
      ..color = pattern
      ..style = PaintingStyle.fill;

    const spacing = 26.0;
    const r = 4.5;

    for (var row = -1.0; row < size.height / spacing + 2; row++) {
      for (var col = -1.0; col < size.width / spacing + 2; col++) {
        final cx = col * spacing + (row.toInt().isOdd ? spacing / 2 : 0);
        final cy = row * spacing;
        _drawFlower(canvas, paint, Offset(cx, cy), r);
      }
    }
  }

  /// 4-petal flower drawn with bezier curves
  void _drawFlower(Canvas canvas, Paint paint, Offset c, double r) {
    for (var i = 0; i < 4; i++) {
      final a = i * math.pi / 2;
      final p = Path()
        ..moveTo(c.dx, c.dy)
        ..quadraticBezierTo(
          c.dx + r * math.cos(a - math.pi / 5),
          c.dy + r * math.sin(a - math.pi / 5),
          c.dx + r * 1.4 * math.cos(a),
          c.dy + r * 1.4 * math.sin(a),
        )
        ..quadraticBezierTo(
          c.dx + r * math.cos(a + math.pi / 5),
          c.dy + r * math.sin(a + math.pi / 5),
          c.dx,
          c.dy,
        )
        ..close();
      canvas.drawPath(p, paint);
    }
    // Center dot
    canvas.drawCircle(c, r * 0.3, paint);
  }

  @override
  bool shouldRepaint(covariant _LeafPatternPainter old) =>
      old.base != base || old.pattern != pattern;
}

// ── Dot grid pattern ──────────────────────────────────────────────────────────
class _DotPatternPainter extends CustomPainter {
  final Color color;
  final Color? base;
  const _DotPatternPainter({required this.color, this.base});

  @override
  void paint(Canvas canvas, Size size) {
    if (base != null) {
      canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height),
          Paint()..color = base!);
    }
    final paint = Paint()..color = color;
    const spacing = 22.0;
    const radius = 2.0;
    for (var row = 0.0; row < size.height + spacing; row += spacing) {
      for (var col = 0.0; col < size.width + spacing; col += spacing) {
        canvas.drawCircle(Offset(col, row), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotPatternPainter old) => old.color != color;
}

// ── Diamond grid pattern ──────────────────────────────────────────────────────
class _DiamondPatternPainter extends CustomPainter {
  final Color color;
  const _DiamondPatternPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const spacing = 28.0;
    const half = 4.0;
    for (var row = -1.0; row < size.height / spacing + 2; row++) {
      for (var col = -1.0; col < size.width / spacing + 2; col++) {
        final cx = col * spacing + (row.toInt().isOdd ? spacing / 2 : 0);
        final cy = row * spacing;
        final path = Path()
          ..moveTo(cx, cy - half)
          ..lineTo(cx + half, cy)
          ..lineTo(cx, cy + half)
          ..lineTo(cx - half, cy)
          ..close();
        canvas.drawPath(path, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DiamondPatternPainter old) => old.color != color;
}

// ── Wallpaper picker bottom sheet ─────────────────────────────────────────────
class ChatWallpaperPicker extends StatefulWidget {
  final ChatWallpaper current;
  final ValueChanged<ChatWallpaper> onSelected;

  const ChatWallpaperPicker({
    super.key,
    required this.current,
    required this.onSelected,
  });

  @override
  State<ChatWallpaperPicker> createState() => _ChatWallpaperPickerState();
}

class _ChatWallpaperPickerState extends State<ChatWallpaperPicker> {
  late ChatWallpaper _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.current;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final surfaceColor = isDark ? const Color(0xFF111827) : Colors.white;
    final dividerColor = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Container(
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(width: 40, height: 4,
            decoration: BoxDecoration(
              color: dividerColor, borderRadius: BorderRadius.circular(2))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
            child: Row(children: [
              Icon(Icons.wallpaper_rounded, color: const Color(0xFFFBBC05), size: 22),
              const SizedBox(width: 10),
              Expanded(child: Text('Chat Wallpaper',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: textColor))),
              TextButton(
                onPressed: () {
                  widget.onSelected(_selected);
                  Navigator.pop(context);
                },
                child: const Text('Apply',
                  style: TextStyle(color: Color(0xFFFBBC05), fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 0.75,
              ),
              itemCount: ChatWallpaper.values.length,
              itemBuilder: (_, i) {
                final w = ChatWallpaper.values[i];
                final isActive = w == _selected;
                return GestureDetector(
                  onTap: () => setState(() => _selected = w),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isActive ? const Color(0xFFFBBC05) : Colors.transparent,
                        width: 3,
                      ),
                      boxShadow: isActive ? [
                        BoxShadow(
                          color: const Color(0xFFFBBC05).withValues(alpha: 0.35),
                          blurRadius: 10, spreadRadius: 1,
                        ),
                      ] : [],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Stack(fit: StackFit.expand, children: [
                        // Mini wallpaper preview
                        _WallpaperPreview(wallpaper: w),
                        // Label at bottom
                        Positioned(
                          left: 0, right: 0, bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.black54, Colors.transparent],
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                              ),
                            ),
                            child: Text(w.label,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700,
                                color: Colors.white,
                                shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                              )),
                          ),
                        ),
                        // Check badge
                        if (isActive)
                          Positioned(top: 8, right: 8,
                            child: Container(
                              width: 22, height: 22,
                              decoration: const BoxDecoration(
                                color: Color(0xFFFBBC05),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.check, size: 14, color: Colors.white),
                            )),
                      ]),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Small preview tile — renders a specific wallpaper directly (bypasses the
/// global notifier so the picker grid can show all options simultaneously).
class _WallpaperPreview extends StatelessWidget {
  final ChatWallpaper wallpaper;
  const _WallpaperPreview({required this.wallpaper});

  @override
  Widget build(BuildContext context) {
    // Reuse the same background-builder logic from ChatWallpaperView
    return Stack(
      fit: StackFit.expand,
      children: [
        ChatWallpaperView._buildBackgroundFor(wallpaper),
        const SizedBox.expand(),
      ],
    );
  }
}
