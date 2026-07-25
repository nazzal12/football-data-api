import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';
import '../data/models.dart';

bool looksOffline(Object error) {
  if (error is ApiException) {
    final m = error.message.toLowerCase();
    return error.status == 0 ||
        m.contains('host lookup') ||
        m.contains('failed host') ||
        m.contains('connection') ||
        m.contains('network') ||
        m.contains('socket');
  }
  final s = error.toString().toLowerCase();
  return s.contains('socket') ||
      s.contains('connection') ||
      s.contains('host lookup') ||
      s.contains('network');
}

class OfflineRetryPane extends StatelessWidget {
  const OfflineRetryPane({
    super.key,
    required this.error,
    required this.onRetry,
  });

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final offline = looksOffline(error);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              offline ? Icons.wifi_off_rounded : Icons.error_outline,
              size: 48,
              color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
            ),
            const SizedBox(height: 16),
            Text(
              offline ? 'YOU ARE OFFLINE' : 'COULD NOT LOAD',
              textAlign: TextAlign.center,
              style: GoogleFonts.jetBrainsMono(
                letterSpacing: 2,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              offline
                  ? 'Check your connection, then try again.'
                  : error.toString(),
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: dark
                    ? PlColors.darkOnSurfaceVariant
                    : PlColors.lightOnSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(
                'RETRY',
                style: GoogleFonts.jetBrainsMono(
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: TextButton.styleFrom(
                backgroundColor: PlColors.electricGreen,
                foregroundColor: Colors.black,
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
