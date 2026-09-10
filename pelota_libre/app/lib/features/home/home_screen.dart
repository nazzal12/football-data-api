import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/config.dart';
import '../../core/theme/app_colors.dart';
import '../../data/feed_providers.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';
import '../../widgets/offline_retry.dart';

/// Matches tab: Finished · Upcoming · Live (+ date scroller for Finished/Upcoming).
/// Live scores come from [liveMatchesProvider]; day lists from [dayMatchesViewProvider].
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late DateTime _selectedDate;
  late ScrollController _dateScrollController;

  @override
  void initState() {
    super.initState();
    // Finished · Upcoming · Live
    _tabController = TabController(length: 3, vsync: this, initialIndex: 1);
    _selectedDate = DateTime.now();
    _dateScrollController = ScrollController(initialScrollOffset: 7 * 48.0);
    _tabController.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _dateScrollController.dispose();
    super.dispose();
  }

  String get _dateString => DateFormat('yyyy-MM-dd').format(_selectedDate);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context)!;

    return Column(
      children: [
        const PlAppBar(),
        // Date applies to Finished / Upcoming; Live is always now.
        if (_tabController.index != 2)
          ColoredBox(
            color: dark ? PlColors.darkSurfaceLow : PlColors.lightSurfaceHigh,
            child: _buildDateScroller(dark, l10n),
          ),
        Material(
          color: dark ? PlColors.darkBackground : PlColors.lightSurface,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            indicatorColor: PlColors.electricGreen,
            labelColor: dark ? PlColors.electricGreen : PlColors.lightOnSurface,
            unselectedLabelColor: dark
                ? PlColors.darkOnSurfaceVariant
                : PlColors.lightOnSurfaceVariant,
            labelStyle: GoogleFonts.jetBrainsMono(
              fontSize: 10,
              letterSpacing: 0.8,
              fontWeight: FontWeight.w600,
            ),
            tabs: [
              Tab(text: l10n.finishedTab.toUpperCase()),
              Tab(text: l10n.upcomingTab.toUpperCase()),
              Tab(text: l10n.live.toUpperCase()),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _DayPhaseTab(
                date: _dateString,
                emptyMessage: l10n.noFinishedMatches,
                predicate: (m) => m.isFinished,
              ),
              _DayPhaseTab(
                date: _dateString,
                emptyMessage: l10n.noUpcomingMatches,
                predicate: (m) => m.isUpcoming,
              ),
              const _LiveMatchesTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDateScroller(bool dark, AppLocalizations l10n) {
    final now = DateTime.now();
    return SizedBox(
      height: 36,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: 15,
        controller: _dateScrollController,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        itemBuilder: (context, index) {
          final date = now.subtract(Duration(days: 7 - index));
          final isSelected = date.year == _selectedDate.year &&
              date.month == _selectedDate.month &&
              date.day == _selectedDate.day;
          final isToday = date.year == now.year &&
              date.month == now.month &&
              date.day == now.day;

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Material(
              color: isSelected
                  ? PlColors.electricGreen
                  : (dark ? PlColors.darkSurfaceContainer : PlColors.lightSurface),
              child: InkWell(
                onTap: () => setState(() => _selectedDate = date),
                child: SizedBox(
                  width: 40,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        isToday
                            ? l10n.today
                            : DateFormat('EEE').format(date).toUpperCase(),
                        style: GoogleFonts.jetBrainsMono(
                          color: isSelected
                              ? Colors.black
                              : (dark
                                  ? PlColors.darkOnSurfaceVariant
                                  : PlColors.lightOnSurfaceVariant),
                          fontSize: 7,
                          letterSpacing: 0.4,
                          height: 1,
                        ),
                      ),
                      Text(
                        DateFormat('d').format(date),
                        style: GoogleFonts.jetBrainsMono(
                          color: isSelected
                              ? Colors.black
                              : (dark
                                  ? PlColors.darkOnSurface
                                  : PlColors.lightOnSurface),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          height: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _DayPhaseTab extends ConsumerWidget {
  const _DayPhaseTab({
    required this.date,
    required this.emptyMessage,
    required this.predicate,
  });

  final String date;
  final String emptyMessage;
  final bool Function(Match m) predicate;

  Future<void> _reload(WidgetRef ref) async {
    try {
      await evictCalendarCacheForDate(ref, date);
      await ref
          .read(matchesProvider(date).notifier)
          .refresh(force: true, forceUpstream: true);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(dayMatchesViewProvider(date));

    return async.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => OfflineRetryPane(
        error: e,
        onRetry: () => _reload(ref),
      ),
      data: (groups) {
        final filtered = filterGroupsByPhase(groups, predicate: predicate);
        if (filtered.isEmpty) {
          return Center(
            child: Text(
              emptyMessage,
              style: GoogleFonts.jetBrainsMono(
                letterSpacing: 2,
                color: PlColors.darkOnSurfaceVariant,
              ),
            ),
          );
        }
        return RefreshIndicator(
          color: PlColors.electricGreen,
          onRefresh: () => _reload(ref),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
            itemCount: filtered.length,
            itemBuilder: (context, i) {
              final g = filtered[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LeagueSectionHeader(
                      title: g.competition.name,
                      logoUrl: g.competition.logoUrl,
                      onTap: () => context.push('/league/${g.competition.id}'),
                    ),
                    const SizedBox(height: 4),
                    for (final m in g.matches)
                      MatchListCard(
                        card: m,
                        onTap: () => context.push('/match/${m.match.id}'),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _LiveMatchesTab extends ConsumerWidget {
  const _LiveMatchesTab();

  Future<void> _reload(WidgetRef ref) async {
    try {
      await evictLiveCalendarCache(ref);
      await ref.read(liveMatchesProvider.notifier).refreshIfNeeded(
            force: true,
            forceUpstream: true,
          );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final boardAsync = ref.watch(liveMatchesProvider);

    return boardAsync.when(
      skipLoadingOnReload: true,
      skipLoadingOnRefresh: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => OfflineRetryPane(
        error: e,
        onRetry: () => _reload(ref),
      ),
      data: (board) {
        final cards = board.matches;
        if (cards.isEmpty) {
          final l10n = AppLocalizations.of(context)!;
          return Center(
            child: Text(
              l10n.noLiveMatches.toUpperCase(),
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }

        // Group by competition for consistent list chrome.
        final byComp = <String, List<MatchCardVm>>{};
        final comps = <String, Competition>{};
        for (final c in cards) {
          byComp.putIfAbsent(c.competition.id, () => []).add(c);
          comps[c.competition.id] = c.competition;
        }
        final groups = byComp.entries
            .map(
              (e) => LeagueGroupVm(
                competition: comps[e.key]!,
                matches: e.value,
              ),
            )
            .toList()
          ..sort(
            (a, b) => AppConfig.compareLeaguesByPopularity(
              aExternalId: ref
                  .read(footballRepositoryProvider)
                  .cachedExternalId(a.competition.id),
              aName: a.competition.name,
              bExternalId: ref
                  .read(footballRepositoryProvider)
                  .cachedExternalId(b.competition.id),
              bName: b.competition.name,
            ),
          );

        return RefreshIndicator(
          color: PlColors.electricGreen,
          onRefresh: () => _reload(ref),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
            itemCount: groups.length,
            itemBuilder: (context, i) {
              final g = groups[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LeagueSectionHeader(
                      title: g.competition.name,
                      logoUrl: g.competition.logoUrl,
                      onTap: () => context.push('/league/${g.competition.id}'),
                    ),
                    const SizedBox(height: 4),
                    for (final m in g.matches)
                      MatchListCard(
                        card: m,
                        onTap: () => context.push('/match/${m.match.id}'),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}
