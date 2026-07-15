import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:unichat_mobile/main.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('App boots to the splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const UniChatApp());
    await tester.pump();

    expect(find.text('UniChat'), findsWidgets);

    // The splash hands off on a 2.6s timer; leaving it pending fails the test.
    // Let it fire and settle the screen it lands on — with no saved session
    // that's the institution picker, whose fetch fails harmlessly here.
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
  });
}
