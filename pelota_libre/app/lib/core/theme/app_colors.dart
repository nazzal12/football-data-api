import 'package:flutter/material.dart';

/// Tokens from UI Templates DESIGN.md (Pelota Libre dark + Velocity light).
abstract final class PlColors {
  // Shared accents from templates
  static const electricGreen = Color(0xFF00FF66);
  static const electricGreenDim = Color(0xFF00E55B);
  static const liveRed = Color(0xFFFF0000);
  /// Timeline / match sides
  static const homeAccent = Color(0xFF00FF66);
  static const awayAccent = Color(0xFF3B82F6);

  // Dark (pelota_libre DESIGN.md + HTML)
  static const darkCanvas = Color(0xFF050505);
  static const darkBackground = Color(0xFF131313);
  static const darkSurface = Color(0xFF121212);
  static const darkSurfaceContainer = Color(0xFF201F1F);
  static const darkSurfaceLow = Color(0xFF1C1B1B);
  static const darkSurfaceHigh = Color(0xFF2A2A2A);
  static const darkBorder = Color(0xFF222222);
  static const darkOutlineVariant = Color(0xFF3B4B3A);
  static const darkOnSurface = Color(0xFFE5E2E1);
  static const darkOnSurfaceVariant = Color(0xFFB9CCB5);
  static const darkPrimaryContainer = electricGreen;
  static const darkOnPrimaryContainer = Color(0xFF007128);

  // Light (velocity_light + homepage light HTML)
  static const lightBackground = Color(0xFFFCF9F8);
  static const lightSurface = Color(0xFFFCF9F8);
  static const lightSurfaceLowest = Color(0xFFFFFFFF);
  static const lightSurfaceLow = Color(0xFFF6F3F2);
  static const lightSurfaceContainer = Color(0xFFF0EDED);
  static const lightSurfaceHigh = Color(0xFFEAE7E7);
  static const lightOnSurface = Color(0xFF1C1B1B);
  static const lightOnSurfaceVariant = Color(0xFF3B4B3A);
  static const lightPrimary = Color(0xFF006E27);
  static const lightPrimaryContainer = electricGreen;
  static const lightOnPrimaryContainer = Color(0xFF007128);
  static const lightBorder = Color(0xFF1C1B1B);
}
