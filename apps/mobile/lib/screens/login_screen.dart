import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/models.dart';
import '../widgets/glass_card.dart';
import 'otp_screen.dart';

class LoginScreen extends StatefulWidget {
  final TenantModel tenant;

  const LoginScreen({super.key, required this.tenant});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _idController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  late AnimationController _ctrl;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _ctrl.forward();
  }

  Future<void> _handleContinue() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final res = await http.post(
        Uri.parse('http://${Config.baseUrl}/api/v1/auth/request-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': _idController.text.trim(),
          'tenantSlug': widget.tenant.slug,
        }),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => OtpScreen(
              identifier: _idController.text.trim(),
              userName: data['user']?['fullName'] ?? 'User',
              tenant: widget.tenant,
            ),
          ),
        );
      } else {
        final err = jsonDecode(res.body);
        _showError(err['error'] ?? 'Login failed. Check your ID.');
      }
    } on Exception {
      _showError('Network error. Make sure you are connected.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  void dispose() {
    _idController.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            top: -80, right: -80,
            child: Container(
              width: 280, height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [AppColors.brand.withValues(alpha: 0.12), Colors.transparent],
                ),
              ),
            ),
          ),
          SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: SlideTransition(
                position: _slide,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 24),
                        Semantics(
                          label: 'Go back',
                          button: true,
                          child: Material(
                            color: context.cl.card,
                            borderRadius: BorderRadius.circular(12),
                            child: InkWell(
                              onTap: () => Navigator.pop(context),
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                width: 48, height: 48,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: context.cl.divider),
                                ),
                                child: Icon(Icons.arrow_back_ios_new_rounded,
                                    size: 16, color: context.cl.text),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 32),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: context.cl.card,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: context.cl.divider),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 36, height: 36,
                                decoration: BoxDecoration(
                                  gradient: AppColors.brandGradient,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.school_rounded, color: AppColors.bgMain, size: 20),
                              ),
                              const SizedBox(width: 10),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(widget.tenant.shortName,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.brand)),
                                  Text(widget.tenant.location,
                                    style: TextStyle(fontSize: 11, color: context.cl.textHint)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        Text('Welcome back',
                          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: context.cl.text)),
                        const SizedBox(height: 6),
                        Text('Enter your Student or Staff ID to continue',
                          style: TextStyle(fontSize: 14, color: context.cl.textSec)),
                        const SizedBox(height: 36),
                        GlassCard(
                          borderRadius: 16,
                          padding: const EdgeInsets.all(4),
                          child: TextFormField(
                            controller: _idController,
                            textInputAction: TextInputAction.done,
                            onFieldSubmitted: (_) => _handleContinue(),
                            style: TextStyle(color: context.cl.text, fontSize: 15, fontWeight: FontWeight.w500),
                            decoration: InputDecoration(
                              labelText: 'Student / Staff ID',
                              hintText: 'e.g. 2023/CS/001',
                              prefixIcon: const Icon(Icons.badge_rounded, color: AppColors.brand),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              filled: false,
                              labelStyle: TextStyle(color: context.cl.textSec),
                              hintStyle: TextStyle(color: context.cl.textHint),
                            ),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return 'Please enter your ID';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(height: 28),
                        SizedBox(
                          width: double.infinity,
                          child: GoldButton(
                            label: 'Continue',
                            icon: Icons.arrow_forward_rounded,
                            onTap: _handleContinue,
                            isLoading: _isLoading,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: context.cl.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: context.cl.divider),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.info_outline, size: 16, color: AppColors.brand),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Use the ID provided by your institution. A verification code will be sent to your registered contact.',
                                  style: TextStyle(fontSize: 12, color: context.cl.textSec, height: 1.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 48),
                        Center(
                          child: Text('UniChat Enterprise v2.0',
                            style: TextStyle(fontSize: 11, color: context.cl.textHint)),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
