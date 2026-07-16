import 'package:pinput/pinput.dart';
import 'package:smart_auth/smart_auth.dart';

/// Bridges Pinput's SMS-autofill hook to Android's SMS User Consent API.
///
/// When the OTP field is on screen, Android shows a one-tap "allow this app to
/// read the code?" dialog as the SMS arrives, then Pinput fills itself. No SMS
/// permission and no app-signature hash are needed (unlike the Retriever API).
///
/// On iOS, web, or any platform without support the calls simply return
/// nothing, so the field falls back to manual entry — never an error.
class SmsRetrieverImpl implements SmsRetriever {
  SmsRetrieverImpl(this.smartAuth);

  final SmartAuth smartAuth;

  @override
  bool get listenForMultipleSms => false;

  @override
  Future<String?> getSmsCode() async {
    try {
      final res = await smartAuth.getSmsWithUserConsentApi();
      return res.hasData ? res.data?.code : null;
    } catch (_) {
      return null; // unsupported platform or user dismissed — manual entry
    }
  }

  @override
  Future<void> dispose() async {
    try {
      await smartAuth.removeUserConsentApiListener();
    } catch (_) {}
  }
}
