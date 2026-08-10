import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import 'language_provider.dart';

/// First-launch (and settings) language picker. Spanish is preselected.
class LanguageSelectionDialog extends ConsumerStatefulWidget {
  const LanguageSelectionDialog({super.key, this.isDismissible = false});

  final bool isDismissible;

  @override
  ConsumerState<LanguageSelectionDialog> createState() =>
      _LanguageSelectionDialogState();
}

class _LanguageSelectionDialogState
    extends ConsumerState<LanguageSelectionDialog> {
  /// Default preselection: Spanish.
  String _selected = 'es';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final current = ref.read(languageProvider)?.languageCode;
      if (current == 'en' || current == 'es') {
        setState(() => _selected = current!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: widget.isDismissible,
      child: Dialog(
        backgroundColor:
            dark ? PlColors.darkSurface : PlColors.lightSurfaceLowest,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.language,
                size: 48,
                color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
              ),
              const SizedBox(height: 16),
              Text(
                'Welcome! / ¡Bienvenido!',
                style: GoogleFonts.archivoNarrow(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: dark ? PlColors.darkOnSurface : PlColors.lightOnSurface,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Please select your preferred language.\nPor favor seleccione su idioma preferido.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: dark
                      ? PlColors.darkOnSurfaceVariant
                      : PlColors.lightOnSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              _LangOption(
                label: 'Español',
                selected: _selected == 'es',
                onTap: () => setState(() => _selected = 'es'),
              ),
              const SizedBox(height: 10),
              _LangOption(
                label: 'English',
                selected: _selected == 'en',
                onTap: () => setState(() => _selected = 'en'),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: PlColors.electricGreen,
                    foregroundColor: Colors.black,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.zero,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () async {
                    await ref
                        .read(languageProvider.notifier)
                        .changeLanguage(_selected);
                    if (context.mounted) Navigator.of(context).pop();
                  },
                  child: Text(
                    _selected == 'es' ? 'Continuar' : 'Continue',
                    style: GoogleFonts.jetBrainsMono(
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LangOption extends StatelessWidget {
  const _LangOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? PlColors.electricGreen.withValues(alpha: dark ? 0.2 : 0.35)
              : (dark ? PlColors.darkSurfaceContainer : PlColors.lightSurfaceHigh),
          border: Border.all(
            color: selected
                ? PlColors.electricGreen
                : (dark ? PlColors.darkBorder : PlColors.lightBorder),
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected
                  ? PlColors.electricGreen
                  : (dark
                      ? PlColors.darkOnSurfaceVariant
                      : PlColors.lightOnSurfaceVariant),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: dark ? PlColors.darkOnSurface : PlColors.lightOnSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
