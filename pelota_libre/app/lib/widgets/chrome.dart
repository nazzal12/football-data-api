import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';

class EntityMark extends StatelessWidget {
  const EntityMark({
    super.key,
    required this.label,
    this.logoUrl,
    this.size = 24,
  });

  final String label;
  final String? logoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final text = label.isEmpty
        ? '?'
        : label.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    final short = text.isEmpty
        ? '?'
        : text.length >= 2
            ? text.substring(0, 2)
            : text;
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: dark ? PlColors.darkSurfaceHigh : PlColors.lightSurfaceHigh,
        border: Border.all(
          color: dark ? PlColors.darkBorder : PlColors.lightBorder,
        ),
      ),
      child: Text(
        short,
        style: GoogleFonts.jetBrainsMono(
          fontSize: size * 0.35,
          fontWeight: FontWeight.w600,
          color: dark ? PlColors.darkOnSurface : PlColors.lightOnSurface,
        ),
      ),
    );
    final url = logoUrl;
    if (url == null || url.isEmpty) return fallback;
    return SizedBox(
      width: size,
      height: size,
      child: Image.network(
        url,
        fit: BoxFit.contain,
        gaplessPlayback: true,
        filterQuality: FilterQuality.medium,
        errorBuilder: (_, _, _) => fallback,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(
            width: size,
            height: size,
            child: Center(
              child: SizedBox(
                width: size * 0.35,
                height: size * 0.35,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class PlAppBar extends StatelessWidget implements PreferredSizeWidget {
  const PlAppBar({
    super.key,
    this.onSearch,
    this.leading,
  });

  final VoidCallback? onSearch;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final titleStyle = dark
        ? GoogleFonts.archivoNarrow(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: PlColors.electricGreen,
            letterSpacing: -0.5,
          )
        : GoogleFonts.anton(
            fontSize: 22,
            fontStyle: FontStyle.italic,
            color: PlColors.lightOnSurface,
            letterSpacing: -0.5,
          );
    return Material(
      color: dark ? PlColors.darkBackground : PlColors.lightSurface,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: dark ? PlColors.darkOutlineVariant : PlColors.lightBorder,
              width: dark ? 1 : 2,
            ),
          ),
        ),
        child: Row(
          children: [
            leading ??
                Icon(
                  Icons.sports_soccer,
                  color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
                ),
            Expanded(
              child: Text(
                'PELOTA LIBRE+',
                textAlign: TextAlign.center,
                style: titleStyle,
              ),
            ),
            IconButton(
              onPressed: onSearch,
              icon: Icon(
                Icons.search,
                color: dark
                    ? PlColors.darkOnSurfaceVariant
                    : PlColors.lightPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PlBottomNav extends StatelessWidget {
  const PlBottomNav({
    super.key,
    required this.index,
    required this.onChanged,
  });

  final int index;
  final ValueChanged<int> onChanged;

  static const _items = [
    (Icons.home, 'HOME'),
    (Icons.emoji_events, 'LEAGUES'),
    (Icons.sensors, 'LIVE'),
    (Icons.groups, 'TEAMS'),
    (Icons.person, 'PROFILE'),
  ];

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: 64,
      decoration: BoxDecoration(
        color: dark ? PlColors.darkBackground : PlColors.lightSurfaceLowest,
        border: Border(
          top: BorderSide(
            color: dark ? PlColors.darkOutlineVariant : PlColors.lightBorder,
            width: 2,
          ),
        ),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _items.length; i++)
            Expanded(
              child: InkWell(
                onTap: () => onChanged(i),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: index == i
                            ? PlColors.electricGreen
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    color: !dark && index == i
                        ? PlColors.electricGreen
                        : Colors.transparent,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _items[i].$1,
                        size: 22,
                        color: index == i
                            ? (dark
                                ? PlColors.electricGreen
                                : PlColors.lightOnSurface)
                            : (dark
                                ? PlColors.darkOnSurfaceVariant
                                : PlColors.lightOnSurfaceVariant),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _items[i].$2,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w500,
                          color: index == i
                              ? (dark
                                  ? PlColors.electricGreen
                                  : PlColors.lightOnSurface)
                              : (dark
                                  ? PlColors.darkOnSurfaceVariant
                                  : PlColors.lightOnSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class LeagueSectionHeader extends StatelessWidget {
  const LeagueSectionHeader({super.key, required this.title, this.onTap});

  final String title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    if (!dark) {
      return InkWell(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          color: PlColors.lightOnSurface,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.emoji_events, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text(
                title.toUpperCase(),
                style: GoogleFonts.anton(
                  color: Colors.white,
                  fontSize: 16,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              color: PlColors.darkSurfaceContainer,
              alignment: Alignment.center,
              child: const Icon(
                Icons.emoji_events,
                size: 16,
                color: PlColors.darkOnSurfaceVariant,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12,
                letterSpacing: 2,
                fontWeight: FontWeight.w500,
                color: PlColors.darkOnSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
