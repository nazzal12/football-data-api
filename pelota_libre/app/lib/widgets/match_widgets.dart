import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../core/theme/app_colors.dart';
import '../data/repository.dart';
import '../l10n/app_localizations.dart';
import 'chrome.dart';

/// Compact horizontal match row — same layout in light and dark.
class MatchListCard extends StatelessWidget {
  const MatchListCard({
    super.key,
    required this.card,
    required this.onTap,
  });

  final MatchCardVm card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context)!;
    final m = card.match;
    final live = m.isLive;
    final finished = m.isFinished;

    final border = dark ? PlColors.darkBorder : PlColors.lightBorder;
    final bg = dark
        ? PlColors.darkSurface
        : (finished ? PlColors.lightSurfaceLow : PlColors.lightSurfaceLowest);
    final nameColor = dark ? PlColors.darkOnSurface : PlColors.lightOnSurface;
    final muted = dark
        ? PlColors.darkOnSurfaceVariant
        : PlColors.lightOnSurfaceVariant;

    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                card.home.name.toUpperCase(),
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.archivoNarrow(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  height: 1.1,
                  color: nameColor,
                ),
              ),
            ),
            const SizedBox(width: 6),
            EntityMark(
              label: card.home.name,
              logoUrl: card.home.logoUrl,
              size: 28,
              whiteBackdrop: true,
            ),
            const SizedBox(width: 6),
            SizedBox(
              width: 58,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (live)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 1,
                      ),
                      color: PlColors.electricGreen,
                      child: Text(
                        "${m.minute ?? ''}'",
                        style: GoogleFonts.archivoNarrow(
                          fontWeight: FontWeight.w700,
                          fontSize: 10,
                          color: PlColors.lightOnPrimaryContainer,
                        ),
                      ),
                    )
                  else if (finished)
                    Text(
                      'FT',
                      style: GoogleFonts.archivoNarrow(
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                        color: muted,
                      ),
                    )
                  else
                    Text(
                      DateFormat.Hm().format(m.kickoffAt.toLocal()),
                      style: GoogleFonts.archivoNarrow(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: nameColor,
                      ),
                    ),
                  const SizedBox(height: 2),
                  Text(
                    m.isUpcoming
                        ? 'VS'
                        : '${m.score?.home ?? '-'} - ${m.score?.away ?? '-'}',
                    style: GoogleFonts.anton(
                      fontSize: m.isUpcoming ? 13 : 17,
                      color: m.isUpcoming ? muted : nameColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            EntityMark(
              label: card.away.name,
              logoUrl: card.away.logoUrl,
              size: 28,
              whiteBackdrop: true,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                card.away.name.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.archivoNarrow(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  height: 1.1,
                  color: nameColor,
                ),
              ),
            ),
            if (live) ...[
              const SizedBox(width: 4),
              Text(
                l10n.live,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 8,
                  letterSpacing: 0.5,
                  color: PlColors.liveRed,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class FormGuideBar extends StatelessWidget {
  const FormGuideBar({super.key, required this.form, this.points});

  /// e.g. "WWDLW"
  final String form;
  final int? points;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final chars = form.toUpperCase().replaceAll(RegExp(r'[^WDL]'), '').split('');
    final last5 = chars.length > 5 ? chars.sublist(chars.length - 5) : chars;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'FORM GUIDE (LAST 5)',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12,
                letterSpacing: 1,
                color: dark
                    ? PlColors.darkOnSurfaceVariant
                    : PlColors.lightOnSurfaceVariant,
              ),
            ),
            const Spacer(),
            if (points != null)
              Text(
                '$points PTS',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 14,
                  color: dark ? PlColors.darkOnSurface : PlColors.lightOnSurface,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (final c in last5)
              Expanded(
                child: Container(
                  height: 40,
                  margin: const EdgeInsets.only(right: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: c == 'W'
                        ? PlColors.electricGreen
                        : c == 'L'
                            ? (dark
                                ? const Color(0xFFFFB4AB)
                                : const Color(0xFFBA1A1A))
                            : (dark
                                ? PlColors.darkSurfaceHigh
                                : PlColors.lightSurfaceHigh),
                    border: Border.all(
                      color: dark
                          ? PlColors.darkOutlineVariant
                          : PlColors.lightBorder,
                    ),
                  ),
                  child: Text(
                    c,
                    style: GoogleFonts.jetBrainsMono(
                      fontWeight: FontWeight.w600,
                      color: c == 'W'
                          ? PlColors.darkOnPrimaryContainer
                          : c == 'L'
                              ? (dark ? const Color(0xFF690005) : Colors.white)
                              : (dark
                                  ? PlColors.darkOnSurface
                                  : PlColors.lightOnSurface),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
