import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';
import '../widgets/chat_wallpaper.dart';
import '../models/models.dart';
import 'tenant_screen.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;
  late Animation<double> _fade;
  late Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
    _scale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.0, 0.55, curve: Curves.elasticOut)),
    );
    _fade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.45, 1.0, curve: Curves.easeIn)),
    );
    _glow = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: const Interval(0.3, 0.8, curve: Curves.easeOut)),
    );
    _ctrl.forward();
    Future.delayed(const Duration(milliseconds: 2600), _checkSession);
  }

  Future<void> _checkSession() async {
    await ChatThemeService.init();

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final userJson = prefs.getString('user');

    if (!mounted) return;

    if (token != null && userJson != null) {
      try {
        final user = UserModel.fromJson(jsonDecode(userJson));
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => HomeScreen(user: user, token: token)),
        );
        return;
      } catch (_) {}
    }

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const TenantScreen()),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Center(
            child: AnimatedBuilder(
              animation: _glow,
              builder: (_, __) => Container(
                width: 260 * _glow.value,
                height: 260 * _glow.value,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.brand.withValues(alpha: 0.18 * _glow.value),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                ScaleTransition(
                  scale: _scale,
                  child: Container(
                    width: 96, height: 96,
                    decoration: BoxDecoration(
                      gradient: AppColors.brandGradient,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brand.withValues(alpha: 0.45),
                          blurRadius: 32, offset: const Offset(0, 8), spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.school_rounded, size: 52, color: AppColors.bgMain),
                  ),
                ),
                const SizedBox(height: 28),
                FadeTransition(
                  opacity: _fade,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text('UniChat',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 38, fontWeight: FontWeight.w800,
                          color: context.cl.text, letterSpacing: 0.5,
                        )),
                      const SizedBox(height: 8),
                      Text('Academic Communication Ecosystem',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: context.cl.textSec, letterSpacing: 0.4)),
                    ],
                  ),
                ),
                const Spacer(flex: 2),
                FadeTransition(
                  opacity: _fade,
                  child: Column(
                    children: [
                      SizedBox(
                        width: 22, height: 22,
                        child: CircularProgressIndicator(
                          color: AppColors.brand.withValues(alpha: 0.7), strokeWidth: 2.5,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text('UniChat Enterprise v2.0',
                        style: TextStyle(fontSize: 11, color: context.cl.textHint)),
                      const SizedBox(height: 36),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
