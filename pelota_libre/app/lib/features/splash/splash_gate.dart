import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';

/// Brief branded hold while the first frame / router settles after native splash.
class SplashGate extends StatefulWidget {
  const SplashGate({super.key, required this.child});

  final Widget child;

  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate>
    with SingleTickerProviderStateMixin {
  bool _ready = false;
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return widget.child;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: dark ? PlColors.darkCanvas : PlColors.lightSurface,
      child: Center(
        child: FadeTransition(
          opacity: Tween(begin: 0.55, end: 1.0).animate(_pulse),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/branding/logo.png',
                width: 128,
                height: 128,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 20),
              Text(
                'PELOTA LIBRE+',
                style: GoogleFonts.archivoNarrow(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'SCORES · LIVE · LIBRE',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 11,
                  letterSpacing: 2,
                  color: dark
                      ? PlColors.darkOnSurfaceVariant
                      : PlColors.lightOnSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
