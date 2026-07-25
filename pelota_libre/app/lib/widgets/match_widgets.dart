import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../core/theme/app_colors.dart';
import '../data/repository.dart';
import 'chrome.dart';

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
    return dark ? _DarkCard(card: card, onTap: onTap) : _LightCard(card: card, onTap: onTap);
  }
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({required this.card, required this.onTap});
  final MatchCardVm card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final m = card.match;
    final live = m.isLive;
    final finished = m.isFinished;
    final statusLabel = live
        ? "${m.minute ?? m.status}'"
        : finished
            ? 'FT'
            : DateFormat.Hm().format(m.kickoffAt.toLocal());

    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: PlColors.darkSurface,
          border: Border(
            left: BorderSide(
              color: live ? PlColors.electricGreenDim : PlColors.darkBorder,
              width: live ? 4 : 1,
            ),
            top: const BorderSide(color: PlColors.darkBorder),
            right: const BorderSide(color: PlColors.darkBorder),
            bottom: const BorderSide(color: PlColors.darkBorder),
          ),
        ),
        child: Stack(
          children: [
            if (live)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  color: PlColors.liveRed,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  child: Text(
                    'LIVE',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 10,
                      color: Colors.white,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  SizedBox(
                    width: 50,
                    child: Text(
                      statusLabel,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 14,
                        color: live
                            ? PlColors.electricGreenDim
                            : PlColors.darkOnSurfaceVariant,
                      ),
                    ),
                  ),
                  Container(width: 1, height: 48, color: PlColors.darkBorder),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      children: [
                        _darkRow(
                          card.home.name,
                          m.score?.home,
                          logoUrl: card.home.logoUrl,
                          highlight: live &&
                              m.score != null &&
                              m.score!.home > m.score!.away,
                          upcoming: m.isUpcoming,
                        ),
                        const SizedBox(height: 6),
                        _darkRow(
                          card.away.name,
                          m.score?.away,
                          logoUrl: card.away.logoUrl,
                          highlight: live &&
                              m.score != null &&
                              m.score!.away > m.score!.home,
                          upcoming: m.isUpcoming,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _darkRow(
    String name,
    int? score, {
    String? logoUrl,
    bool highlight = false,
    bool upcoming = false,
  }) {
    return Row(
      children: [
        EntityMark(label: name, logoUrl: logoUrl, size: 24),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            name.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: PlColors.darkOnSurface,
            ),
          ),
        ),
        Text(
          upcoming ? '-' : '${score ?? '-'}',
          style: GoogleFonts.archivoNarrow(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
            color: highlight
                ? PlColors.electricGreenDim
                : PlColors.darkOnSurface,
          ),
        ),
      ],
    );
  }
}

class _LightCard extends StatelessWidget {
  const _LightCard({required this.card, required this.onTap});
  final MatchCardVm card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final m = card.match;
    final live = m.isLive;
    final finished = m.isFinished;
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: finished ? PlColors.lightSurfaceLow : PlColors.lightSurfaceLowest,
          border: Border.all(color: PlColors.lightBorder),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                card.home.name.toUpperCase(),
                textAlign: TextAlign.right,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.archivoNarrow(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 8),
            EntityMark(label: card.home.name, logoUrl: card.home.logoUrl, size: 28),
            const SizedBox(width: 8),
            SizedBox(
              width: 72,
              child: Column(
                children: [
                  if (live)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      color: PlColors.electricGreen,
                      child: Text(
                        "${m.minute ?? ''}'",
                        style: GoogleFonts.archivoNarrow(
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                          color: PlColors.lightOnPrimaryContainer,
                        ),
                      ),
                    )
                  else if (finished)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      color: PlColors.lightSurfaceHigh,
                      child: Text(
                        'FT',
                        style: GoogleFonts.archivoNarrow(
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    )
                  else
                    Text(
                      DateFormat.Hm().format(m.kickoffAt.toLocal()),
                      style: GoogleFonts.archivoNarrow(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    m.isUpcoming
                        ? 'VS'
                        : '${m.score?.home ?? '-'} - ${m.score?.away ?? '-'}',
                    style: GoogleFonts.anton(
                      fontSize: m.isUpcoming ? 16 : 22,
                      color: m.isUpcoming
                          ? PlColors.lightOnSurfaceVariant
                          : PlColors.lightOnSurface,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            EntityMark(label: card.away.name, logoUrl: card.away.logoUrl, size: 28),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                card.away.name.toUpperCase(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.archivoNarrow(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
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
