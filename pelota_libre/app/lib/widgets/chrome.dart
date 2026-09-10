import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/theme/app_colors.dart';

class EntityMark extends StatelessWidget {
  const EntityMark({
    super.key,
    required this.label,
    this.logoUrl,
    this.size = 24,
    this.whiteBackdrop = false,
  });

  final String label;
  final String? logoUrl;
  final double size;
  /// White plate behind logos so dark crests stay visible in dark mode.
  final bool whiteBackdrop;

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
        color: whiteBackdrop
            ? Colors.white
            : (dark ? PlColors.darkSurfaceHigh : PlColors.lightSurfaceHigh),
        border: Border.all(
          color: dark ? PlColors.darkBorder : PlColors.lightBorder,
        ),
      ),
      child: Text(
        short,
        style: GoogleFonts.jetBrainsMono(
          fontSize: size * 0.35,
          fontWeight: FontWeight.w600,
          color: dark && !whiteBackdrop
              ? PlColors.darkOnSurface
              : PlColors.lightOnSurface,
        ),
      ),
    );
    final url = logoUrl;
    if (url == null || url.isEmpty) return fallback;
    final image = Image.network(
      url,
      fit: BoxFit.contain,
      gaplessPlayback: true,
      filterQuality: FilterQuality.medium,
      errorBuilder: (_, _, _) => fallback,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return Center(
          child: SizedBox(
            width: size * 0.35,
            height: size * 0.35,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
            ),
          ),
        );
      },
    );
    return Container(
      width: size,
      height: size,
      padding: whiteBackdrop ? EdgeInsets.all(size * 0.08) : EdgeInsets.zero,
      decoration: BoxDecoration(
        color: whiteBackdrop
            ? Colors.white
            : Colors.transparent,
        border: whiteBackdrop
            ? Border.all(
                color: dark ? PlColors.darkBorder : PlColors.lightBorder,
              )
            : null,
      ),
      child: image,
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
  Size get preferredSize => const Size.fromHeight(44);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final titleStyle = dark
        ? GoogleFonts.archivoNarrow(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: PlColors.electricGreen,
            letterSpacing: -0.5,
          )
        : GoogleFonts.anton(
            fontSize: 16,
            fontStyle: FontStyle.italic,
            color: PlColors.lightOnSurface,
            letterSpacing: -0.5,
          );
    return Material(
      color: dark ? PlColors.darkBackground : PlColors.lightSurface,
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 12),
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
                  size: 20,
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
              iconSize: 20,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
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
    required this.labels,
  });

  final int index;
  final ValueChanged<int> onChanged;
  final List<String> labels;

  static const _icons = [
    Icons.sports_soccer,
    Icons.emoji_events,
    Icons.search,
    Icons.settings,
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
          for (var i = 0; i < _icons.length; i++)
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
                        _icons[i],
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
                        labels[i].toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
  const LeagueSectionHeader({
    super.key,
    required this.title,
    this.logoUrl,
    this.onTap,
  });

  final String title;
  final String? logoUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final mark = EntityMark(
      label: title,
      logoUrl: logoUrl,
      size: 26,
      whiteBackdrop: true,
    );

    if (!dark) {
      return InkWell(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          color: PlColors.lightOnSurface,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              mark,
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.anton(
                    color: Colors.white,
                    fontSize: 15,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return InkWell(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        color: PlColors.darkSurfaceLow,
        child: Row(
          children: [
            mark,
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 13,
                  letterSpacing: 1,
                  fontWeight: FontWeight.w600,
                  color: PlColors.darkOnSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
