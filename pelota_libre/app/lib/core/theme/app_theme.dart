import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

abstract final class AppTheme {
  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: PlColors.darkBackground,
      canvasColor: PlColors.darkCanvas,
    );
    final archivo = GoogleFonts.archivoNarrowTextTheme(base.textTheme);
    final inter = GoogleFonts.interTextTheme(base.textTheme);
    return base.copyWith(
      colorScheme: const ColorScheme.dark(
        primary: PlColors.electricGreen,
        onPrimary: Color(0xFF003911),
        primaryContainer: PlColors.darkPrimaryContainer,
        onPrimaryContainer: PlColors.darkOnPrimaryContainer,
        surface: PlColors.darkSurface,
        onSurface: PlColors.darkOnSurface,
        onSurfaceVariant: PlColors.darkOnSurfaceVariant,
        outline: PlColors.darkOutlineVariant,
        error: Color(0xFFFFB4AB),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: PlColors.darkBackground,
        foregroundColor: PlColors.electricGreen,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: GoogleFonts.archivoNarrow(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: PlColors.electricGreen,
          letterSpacing: -0.5,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: PlColors.darkOutlineVariant,
        thickness: 1,
        space: 1,
      ),
      cardTheme: const CardThemeData(
        color: PlColors.darkSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
          side: BorderSide(color: PlColors.darkBorder),
        ),
      ),
      textTheme: archivo.copyWith(
        bodyMedium: inter.bodyMedium?.copyWith(color: PlColors.darkOnSurface),
        bodyLarge: inter.bodyLarge?.copyWith(color: PlColors.darkOnSurface),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: PlColors.darkBackground,
        indicatorColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith((s) {
          final active = s.contains(WidgetState.selected);
          return GoogleFonts.jetBrainsMono(
            fontSize: 10,
            letterSpacing: 1,
            fontWeight: FontWeight.w500,
            color: active ? PlColors.electricGreen : PlColors.darkOnSurfaceVariant,
          );
        }),
      ),
    );
  }

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: PlColors.lightBackground,
    );
    final anton = GoogleFonts.antonTextTheme(base.textTheme);
    final archivo = GoogleFonts.archivoNarrowTextTheme(base.textTheme);
    return base.copyWith(
      colorScheme: const ColorScheme.light(
        primary: PlColors.lightPrimary,
        onPrimary: Colors.white,
        primaryContainer: PlColors.lightPrimaryContainer,
        onPrimaryContainer: PlColors.lightOnPrimaryContainer,
        surface: PlColors.lightSurfaceLowest,
        onSurface: PlColors.lightOnSurface,
        onSurfaceVariant: PlColors.lightOnSurfaceVariant,
        outline: PlColors.lightBorder,
        error: Color(0xFFBA1A1A),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: PlColors.lightSurface,
        foregroundColor: PlColors.lightOnSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.anton(
          fontSize: 24,
          fontWeight: FontWeight.w400,
          fontStyle: FontStyle.italic,
          color: PlColors.lightOnSurface,
          letterSpacing: -0.5,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: PlColors.lightBorder,
        thickness: 2,
        space: 2,
      ),
      cardTheme: const CardThemeData(
        color: PlColors.lightSurfaceLowest,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.zero,
          side: BorderSide(color: PlColors.lightBorder, width: 1),
        ),
      ),
      textTheme: archivo.copyWith(
        headlineLarge: anton.headlineLarge,
        headlineMedium: anton.headlineMedium,
        headlineSmall: anton.headlineSmall,
        displayLarge: anton.displayLarge,
        displayMedium: anton.displayMedium,
      ),
    );
  }
}
