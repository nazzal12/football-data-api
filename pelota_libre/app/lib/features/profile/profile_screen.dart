import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/chrome.dart';
import '../settings/language_provider.dart';
import '../settings/language_selection_dialog.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(themeModePrefProvider);
    final year = ref.watch(seasonYearProvider);
    final l10n = AppLocalizations.of(context)!;
    final lang = ref.watch(languageProvider);

    return Column(
      children: [
        const PlAppBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                l10n.settingsTab.toUpperCase(),
                style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
              ),
              const SizedBox(height: 16),
              _tile(
                context,
                title: l10n.language.toUpperCase(),
                trailing: Text(
                  lang?.languageCode == 'en' ? l10n.english : l10n.spanish,
                  style: GoogleFonts.jetBrainsMono(
                    color: PlColors.electricGreen,
                  ),
                ),
                onTap: () {
                  showDialog(
                    context: context,
                    builder: (_) =>
                        const LanguageSelectionDialog(isDismissible: true),
                  );
                },
              ),
              _tile(
                context,
                title: l10n.darkMode.toUpperCase(),
                trailing: Switch(
                  value: dark,
                  activeThumbColor: Colors.black,
                  activeTrackColor: PlColors.electricGreen,
                  onChanged: (v) =>
                      ref.read(themeModePrefProvider.notifier).setDark(v),
                ),
              ),
              _tile(
                context,
                title: l10n.seasonYear.toUpperCase(),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: () => ref
                          .read(seasonYearProvider.notifier)
                          .setYear(year - 1),
                      icon: const Icon(Icons.remove),
                    ),
                    Text(
                      '$year',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 18,
                        color: PlColors.electricGreen,
                      ),
                    ),
                    IconButton(
                      onPressed: () => ref
                          .read(seasonYearProvider.notifier)
                          .setYear(year + 1),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
              ),
              _tile(
                context,
                title: l10n.clearLocalCache.toUpperCase(),
                onTap: () async {
                  await ref.read(responseCacheProvider).clear();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(l10n.cacheCleared)),
                    );
                  }
                },
              ),
              const SizedBox(height: 32),
              Text(
                'PELOTA LIBRE',
                style: GoogleFonts.archivoNarrow(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: PlColors.electricGreen,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Scores powered by Football API.\nLocal cache + API Cache-Control for minimal origin traffic.',
                style: GoogleFonts.inter(
                  color: PlColors.darkOnSurfaceVariant,
                ),
              ),
              const SizedBox(height: 28),
              Text(
                l10n.disclaimer.toUpperCase(),
                style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.disclaimerText,
                style: GoogleFonts.inter(
                  color: PlColors.darkOnSurfaceVariant,
                  height: 1.45,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tile(
    BuildContext context, {
    required String title,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(
            color: dark ? PlColors.darkBorder : PlColors.lightBorder,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.jetBrainsMono(letterSpacing: 1),
              ),
            ),
            ?trailing,
            if (onTap != null && trailing == null)
              const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
