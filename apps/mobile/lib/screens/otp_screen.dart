import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:pinput/pinput.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smart_auth/smart_auth.dart';
import '../config.dart';
import '../models/models.dart';
import '../services/sms_retriever_impl.dart';
import '../widgets/glass_card.dart';
import 'home_screen.dart';

class OtpScreen extends StatefulWidget {
  final String identifier;
  final String userName;
  final TenantModel tenant;

  const OtpScreen({
    super.key,
    required this.identifier,
    required this.userName,
    required this.tenant,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = false;
  String _otp = '';
  int _countdown = 60;
  Timer? _timer;
  bool _canResend = false;

  late AnimationController _ctrl;
  late Animation<double> _iconScale;
  late Animation<double> _fade;

  // Drives Pinput's one-tap SMS autofill on Android; harmless elsewhere.
  late final SmsRetrieverImpl _smsRetriever;

  @override
  void initState() {
    super.initState();
    _smsRetriever = SmsRetrieverImpl(SmartAuth.instance);
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
    _iconScale = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);
    _fade = CurvedAnimation(parent: _ctrl, curve: const Interval(0.4, 1.0, curve: Curves.easeIn));
    _startCountdown();
  }

  void _startCountdown() {
    setState(() { _countdown = 60; _canResend = false; });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        if (_countdown > 0) { _countdown--; } else { _canResend = true; t.cancel(); }
      });
    });
  }

  Future<void> _resendOtp() async {
    if (!_canResend) return;
    try {
      await http.post(
        Uri.parse('http://${Config.baseUrl}/api/v1/auth/request-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'identifier': widget.identifier, 'tenantSlug': widget.tenant.slug}),
      ).timeout(const Duration(seconds: 10));
      _startCountdown();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Code resent'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    } catch (_) {}
  }

  Future<void> _verifyOtp() async {
    if (_otp.length < 6 || _isLoading) return;
    setState(() => _isLoading = true);

    try {
      final res = await http.post(
        Uri.parse('http://${Config.baseUrl}/api/v1/auth/verify-otp'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': widget.identifier,
          'tenantSlug': widget.tenant.slug,
          'otp': _otp,
        }),
      ).timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final user = UserModel.fromJson(data['user']);
        final token = data['token'] as String;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', token);
        await prefs.setString('user', jsonEncode(user.toJson()));

        if (!mounted) return;
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => HomeScreen(user: user, token: token)),
          (_) => false,
        );
      } else {
        _showError('Invalid code. Please try again.');
      }
    } on Exception {
      _showError('Verification failed. Check your connection.');
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
    _timer?.cancel();
    _ctrl.dispose();
    _smsRetriever.dispose();
    super.dispose();
  }

  /// Six-box OTP input. On Android the incoming code auto-fills via one-tap SMS
  /// User Consent (wired through [_smsRetriever]); everywhere else it's normal
  /// manual entry with the OS one-time-code hint.
  Widget _buildOtpField(BuildContext context) {
    final defaultPinTheme = PinTheme(
      width: 52,
      height: 60,
      textStyle: const TextStyle(
        fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.brand, height: 1.0,
      ),
      decoration: BoxDecoration(
        color: context.cl.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.cl.divider, width: 1.8),
      ),
    );
    return Pinput(
      length: 6,
      defaultPinTheme: defaultPinTheme,
      focusedPinTheme: defaultPinTheme.copyBorderWith(
        border: Border.all(color: AppColors.brand, width: 1.8),
      ),
      smsRetriever: _smsRetriever,
      keyboardType: TextInputType.number,
      autofocus: true,
      onChanged: (code) => setState(() => _otp = code),
      onCompleted: (code) { setState(() => _otp = code); _verifyOtp(); },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Positioned(
            bottom: -60, right: -60,
            child: Container(
              width: 240, height: 240,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [AppColors.brand.withValues(alpha: 0.1), Colors.transparent],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Row(
                    children: [
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
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        const SizedBox(height: 32),
                        ScaleTransition(
                          scale: _iconScale,
                          child: Container(
                            width: 88, height: 88,
                            decoration: BoxDecoration(
                              gradient: AppColors.brandGradient,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(color: AppColors.brand.withValues(alpha: 0.4),
                                    blurRadius: 28, offset: const Offset(0, 6)),
                              ],
                            ),
                            child: const Icon(Icons.verified_user_rounded, size: 44, color: AppColors.bgMain),
                          ),
                        ),
                        const SizedBox(height: 28),
                        FadeTransition(
                          opacity: _fade,
                          child: Column(
                            children: [
                              Text('Verify your identity',
                                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: context.cl.text)),
                              const SizedBox(height: 12),
                              RichText(
                                textAlign: TextAlign.center,
                                text: TextSpan(
                                  style: TextStyle(fontSize: 14, color: context.cl.textSec, height: 1.6),
                                  children: [
                                    const TextSpan(text: 'A 6-digit code was sent to\n'),
                                    TextSpan(text: widget.userName,
                                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.brand)),
                                    const TextSpan(text: "'s registered contact"),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 40),
                              _buildOtpField(context),
                              const SizedBox(height: 36),
                              SizedBox(
                                width: double.infinity,
                                child: GoldButton(
                                  label: 'Verify & Continue',
                                  icon: Icons.shield_rounded,
                                  onTap: _otp.length == 6 ? _verifyOtp : null,
                                  isLoading: _isLoading,
                                ),
                              ),
                              const SizedBox(height: 28),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text("Didn't receive the code? ",
                                    style: TextStyle(color: context.cl.textSec, fontSize: 14)),
                                  Semantics(
                                    label: _canResend ? 'Resend code' : 'Resend available in ${_countdown} seconds',
                                    button: true,
                                    enabled: _canResend,
                                    child: InkWell(
                                      onTap: _canResend ? _resendOtp : null,
                                      borderRadius: BorderRadius.circular(8),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                                        child: Text(
                                          _canResend ? 'Resend' : 'Resend in ${_countdown}s',
                                          style: TextStyle(
                                            color: _canResend ? AppColors.brand : context.cl.textHint,
                                            fontSize: 14, fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
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
