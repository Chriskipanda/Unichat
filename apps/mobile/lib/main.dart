import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config.dart';
import 'theme/theme_controller.dart';
import 'theme/branding_controller.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.init();
  await BrandingController.init();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.bgSurface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const UniChatApp());
}

class UniChatApp extends StatelessWidget {
  const UniChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.mode,
      builder: (_, mode, _) => ValueListenableBuilder<TenantBranding>(
        valueListenable: BrandingController.branding,
        builder: (_, brd, _) {
          final base = _textTheme(brd.fontFamily);
          return MaterialApp(
            title: 'UniChat',
            debugShowCheckedModeBanner: false,
            themeMode: mode,
            theme: _lightTheme(base, brd.primaryColor, brd.accentColor),
            darkTheme: _darkTheme(base, brd.primaryColor, brd.accentColor),
            home: const SplashScreen(),
          );
        },
      ),
    );
  }

  TextTheme _textTheme(String fontFamily) {
    switch (fontFamily.toLowerCase()) {
      case 'roboto':     return GoogleFonts.robotoTextTheme();
      case 'lato':       return GoogleFonts.latoTextTheme();
      case 'open sans':  return GoogleFonts.openSansTextTheme();
      case 'nunito':     return GoogleFonts.nunitoTextTheme();
      case 'montserrat': return GoogleFonts.montserratTextTheme();
      case 'inter':      return GoogleFonts.interTextTheme();
      default:           return GoogleFonts.poppinsTextTheme();
    }
  }

  ThemeData _darkTheme(TextTheme base, Color primary, Color accent) => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.bgMain,
    colorScheme: ColorScheme.dark(
      primary: primary,
      secondary: accent,
      surface: AppColors.bgSurface,
      error: AppColors.error,
    ),
    textTheme: base.apply(
      bodyColor: AppColors.textPrimary,
      displayColor: AppColors.textPrimary,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.bgSurface,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary,
      ),
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: AppColors.bgSurface,
      selectedItemColor: primary,
      unselectedItemColor: AppColors.textHint,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
      labelStyle: const TextStyle(color: AppColors.textSecondary),
      hintStyle: const TextStyle(color: AppColors.textHint),
    ),
    dividerColor: AppColors.divider,
    useMaterial3: true,
  );

  ThemeData _lightTheme(TextTheme base, Color primary, Color accent) {
    const lightBg = Color(0xFFF0F2F5);
    const lightSurface = Colors.white;
    const lightText = Color(0xFF0F172A);
    const lightTextSec = Color(0xFF475569);
    const lightDivider = Color(0xFFE2E8F0);

    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: lightBg,
      colorScheme: ColorScheme.light(
        primary: primary,
        secondary: accent,
        surface: lightSurface,
        error: AppColors.error,
      ),
      textTheme: base.apply(bodyColor: lightText, displayColor: lightText),
      appBarTheme: AppBarTheme(
        backgroundColor: lightSurface,
        foregroundColor: lightText,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 18, fontWeight: FontWeight.w700, color: lightText,
        ),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: lightSurface,
        selectedItemColor: primary,
        unselectedItemColor: lightTextSec,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: lightDivider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: lightDivider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
        labelStyle: const TextStyle(color: lightTextSec),
        hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
      ),
      dividerColor: lightDivider,
      useMaterial3: true,
    );
  }
}
