import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../data/feed_providers.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../l10n/app_localizations.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';

/// Match document once — live score/minute come from [liveMatchesProvider].
final matchCardProvider =
    FutureProvider.autoDispose.family<MatchCardVm, String>((ref, id) async {
  final repo = ref.read(footballRepositoryProvider);
  final m = await repo.match(id, forceRefresh: true);
  final card = await repo.hydrateMatch(m);
  if (card == null) {
    throw ApiException(status: 404, message: 'Unable to hydrate match');
  }
  return card;
});

/// Timeline only — while live, invalidate every 15s (do not re-poll /matches/{id}).
final matchTimelineProvider = FutureProvider.autoDispose
    .family<({List<MatchEvent> events, Venue? venue}), String>((ref, id) async {
  final repo = ref.read(footballRepositoryProvider);
  final m = await repo.match(id);
  if (m.isLive) {
    final timer = Timer(const Duration(seconds: 15), () {
      ref.invalidateSelf();
    });
    ref.onDispose(timer.cancel);
  }
  return repo.matchTimelineExtras(m);
});

final matchStatsProvider =
    FutureProvider.autoDispose.family<MatchStatistics?, String>((ref, id) {
  return ref.read(footballRepositoryProvider).matchStats(id);
});

final matchPredsProvider =
    FutureProvider.autoDispose.family<MatchPrediction?, String>((ref, id) {
  return ref.read(footballRepositoryProvider).matchPreds(id);
});

final matchLineupsProvider =
    FutureProvider.autoDispose.family<List<MatchLineup>, String>((ref, id) async {
  final repo = ref.read(footballRepositoryProvider);
  final m = await repo.match(id);
  return repo.matchLineups(m);
});

final matchH2HProvider =
    FutureProvider.autoDispose.family<List<MatchCardVm>, String>((ref, id) async {
  final repo = ref.read(footballRepositoryProvider);
  final m = await repo.match(id);
  return repo.matchH2H(m);
});

final matchDetailTabProvider =
    StateProvider.family<int, String>((ref, id) => 0);

class MatchDetailScreen extends ConsumerWidget {
  const MatchDetailScreen({super.key, required this.matchId});

  final String matchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context)!;
    final cardAsync = ref.watch(matchCardProvider(matchId));
    final liveRow = ref.watch(liveMatchByIdProvider(matchId));
    final tab = ref.watch(matchDetailTabProvider(matchId));

    return Scaffold(
      body: SafeArea(
        child: cardAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: PlColors.electricGreen),
          ),
          error: (e, _) => Center(child: Text('$e')),
          data: (raw) {
            final card = applyLiveBoardToCard(raw, liveRow);
            final timeline = ref.watch(matchTimelineProvider(matchId));
            return Column(
              children: [
                PlAppBar(
                  leading: IconButton(
                    icon: Icon(
                      Icons.arrow_back,
                      color: dark
                          ? PlColors.electricGreen
                          : PlColors.lightPrimary,
                    ),
                    onPressed: () => context.pop(),
                  ),
                ),
                _Scoreboard(
                  card: card,
                  venue: timeline.asData?.value.venue,
                ),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final entry in [
                        (0, l10n.timeline),
                        (1, l10n.stats),
                        (2, l10n.lineups),
                        (3, l10n.h2h),
                        (4, l10n.predictions),
                      ])
                        InkWell(
                          onTap: () => ref
                              .read(matchDetailTabProvider(matchId).notifier)
                              .state = entry.$1,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 14,
                              horizontal: 16,
                            ),
                            decoration: BoxDecoration(
                              color: tab == entry.$1
                                  ? (dark
                                      ? PlColors.darkSurfaceLow
                                      : PlColors.lightSurfaceLow)
                                  : null,
                              border: Border(
                                bottom: BorderSide(
                                  color: tab == entry.$1
                                      ? (dark
                                          ? PlColors.darkOnSurface
                                          : PlColors.lightOnSurface)
                                      : Colors.transparent,
                                  width: 4,
                                ),
                              ),
                            ),
                            child: Text(
                              entry.$2.toUpperCase(),
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 11,
                                letterSpacing: 1.5,
                                color: tab == entry.$1
                                    ? (dark
                                        ? PlColors.darkOnSurface
                                        : PlColors.lightOnSurface)
                                    : (dark
                                        ? PlColors.darkOnSurfaceVariant
                                        : PlColors.lightOnSurfaceVariant),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(
                  child: switch (tab) {
                    0 => timeline.when(
                        loading: () => const Center(
                          child: CircularProgressIndicator(
                            color: PlColors.electricGreen,
                          ),
                        ),
                        error: (e, _) => Center(child: Text('$e')),
                        data: (ex) =>
                            _Timeline(events: ex.events, card: card),
                      ),
                    1 => _StatsTab(matchId: matchId, card: card),
                    2 => _LineupsTab(matchId: matchId, card: card),
                    3 => _H2HTab(matchId: matchId),
                    _ => _PredsTab(matchId: matchId),
                  },
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Scoreboard extends StatelessWidget {
  const _Scoreboard({required this.card, this.venue});
  final MatchCardVm card;
  final Venue? venue;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context)!;
    final m = card.match;
    final date = DateFormat('d MMM yyyy').format(m.kickoffAt.toLocal()).toUpperCase();
    final status = m.isLive
        ? '${l10n.live} ${m.minute ?? ''}\''
        : m.isFinished
            ? l10n.fullTime.toUpperCase()
            : DateFormat.Hm().format(m.kickoffAt.toLocal());

    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: dark ? PlColors.darkSurface : PlColors.lightSurfaceLowest,
        border: Border.all(
          color: dark ? PlColors.darkBorder : PlColors.lightBorder,
          width: 2,
        ),
      ),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: dark ? PlColors.darkSurfaceLow : PlColors.lightSurfaceLow,
              border: Border(
                bottom: BorderSide(
                  color: dark ? PlColors.darkBorder : PlColors.lightBorder,
                  width: 2,
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '$date • ${card.competition.name.toUpperCase()}',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      letterSpacing: 1,
                      color: dark
                          ? PlColors.darkOnSurfaceVariant
                          : PlColors.lightOnSurfaceVariant,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  color: m.isLive
                      ? PlColors.liveRed
                      : PlColors.electricGreen,
                  child: Text(
                    status,
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: m.isLive
                          ? Colors.white
                          : PlColors.darkOnPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 8),
            child: Row(
              children: [
                Expanded(child: _teamCol(card.home, dark)),
                Column(
                  children: [
                    Row(
                      children: [
                        Text(
                          m.isUpcoming ? '-' : '${m.score?.home ?? 0}',
                          style: dark
                              ? GoogleFonts.archivoNarrow(
                                  fontSize: 48,
                                  fontWeight: FontWeight.w800,
                                )
                              : GoogleFonts.anton(fontSize: 56),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            '-',
                            style: GoogleFonts.archivoNarrow(
                              fontSize: 28,
                              color: dark
                                  ? PlColors.darkOnSurfaceVariant
                                  : PlColors.lightOnSurfaceVariant,
                            ),
                          ),
                        ),
                        Text(
                          m.isUpcoming ? '-' : '${m.score?.away ?? 0}',
                          style: dark
                              ? GoogleFonts.archivoNarrow(
                                  fontSize: 48,
                                  fontWeight: FontWeight.w800,
                                )
                              : GoogleFonts.anton(fontSize: 56),
                        ),
                      ],
                    ),
                  ],
                ),
                Expanded(child: _teamCol(card.away, dark)),
              ],
            ),
          ),
          if (venue != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Wrap(
                spacing: 8,
                children: [
                  _chip(Icons.stadium, venue!.name, dark),
                  if (venue!.city != null)
                    _chip(Icons.location_city, venue!.city!, dark),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _teamCol(Team t, bool dark) {
    return Column(
      children: [
        EntityMark(label: t.name, logoUrl: t.logoUrl, size: 72),
        const SizedBox(height: 8),
        Text(
          t.name.toUpperCase(),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: dark
              ? GoogleFonts.archivoNarrow(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                )
              : GoogleFonts.anton(fontSize: 18),
        ),
      ],
    );
  }

  Widget _chip(IconData icon, String label, bool dark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: dark ? PlColors.darkSurfaceLow : PlColors.lightSurfaceLow,
        border: Border.all(
          color: dark ? PlColors.darkBorder : PlColors.lightBorder,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.jetBrainsMono(fontSize: 11, letterSpacing: 1),
          ),
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.events, required this.card});
  final List<MatchEvent> events;
  final MatchCardVm card;

  String _teamLabel(MatchEvent e) {
    if (e.teamName != null && e.teamName!.isNotEmpty) return e.teamName!;
    if (e.teamId == card.home.id) return card.home.name;
    if (e.teamId == card.away.id) return card.away.name;
    return 'Team';
  }

  bool _isHome(MatchEvent e) {
    if (e.teamId == card.home.id) return true;
    if (e.teamId == card.away.id) return false;
    final n = e.teamName?.toLowerCase() ?? '';
    if (n.isNotEmpty && n == card.home.name.toLowerCase()) return true;
    return false;
  }

  Color _sideColor(MatchEvent e) =>
      _isHome(e) ? PlColors.homeAccent : PlColors.awayAccent;

  String _actor(MatchEvent e) {
    final player = e.playerName?.trim();
    if (player != null && player.isNotEmpty) return player;
    return _teamLabel(e);
  }

  String _headline(MatchEvent e) {
    final type = e.type.replaceAll('_', ' ').toUpperCase();
    final assist = e.assistPlayerName?.trim();
    final team = _teamLabel(e);
    final who = _actor(e);
    switch (e.type) {
      case 'goal':
      case 'penalty':
      case 'own_goal':
        final asst = assist?.isNotEmpty == true ? ' (assist: $assist)' : '';
        return '$type — $who$asst';
      case 'substitution':
        final out = e.playerName?.trim().isNotEmpty == true
            ? e.playerName!
            : 'Out';
        final inn = assist?.isNotEmpty == true ? assist! : 'In';
        return 'SUB — $inn ON for $out';
      case 'yellow_card':
      case 'red_card':
        return '$type — $who';
      default:
        return '$type — $who · $team';
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    if (events.isEmpty) {
      return Center(
        child: Text(
          'NO EVENTS YET',
          style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: _legend(card.home.name, PlColors.homeAccent, dark),
            ),
            Expanded(
              child: _legend(card.away.name, PlColors.awayAccent, dark),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Newest events first; kickoff marker at the bottom.
        for (final e in events)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 48,
                  child: Text(
                    e.minute != null
                        ? e.extraMinute != null
                            ? "${e.minute}+${e.extraMinute}'"
                            : "${e.minute}'"
                        : '—',
                    style: GoogleFonts.jetBrainsMono(
                      color: _sideColor(e),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 10, top: 10),
                  child: _EventGlyph(type: e.type),
                ),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border(
                        left: BorderSide(color: _sideColor(e), width: 4),
                        top: BorderSide(
                          color: dark
                              ? PlColors.darkBorder
                              : PlColors.lightBorder,
                        ),
                        right: BorderSide(
                          color: dark
                              ? PlColors.darkBorder
                              : PlColors.lightBorder,
                        ),
                        bottom: BorderSide(
                          color: dark
                              ? PlColors.darkBorder
                              : PlColors.lightBorder,
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _teamLabel(e).toUpperCase(),
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            letterSpacing: 1,
                            color: _sideColor(e),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _headline(e),
                          style: GoogleFonts.archivoNarrow(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        if (e.detail != null && e.detail!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            e.detail!,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: dark
                                  ? PlColors.darkOnSurfaceVariant
                                  : PlColors.lightOnSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 8),
        Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              border: Border.all(
                color: dark ? PlColors.darkBorder : PlColors.lightBorder,
                width: 2,
              ),
            ),
            child: Text(
              'KICKOFF',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2, fontSize: 11),
            ),
          ),
        ),
      ],
    );
  }

  Widget _legend(String name, Color color, bool dark) {
    return Row(
      children: [
        Container(width: 10, height: 10, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            name.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 10,
              letterSpacing: 1,
              color: dark
                  ? PlColors.darkOnSurfaceVariant
                  : PlColors.lightOnSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

class _EventGlyph extends StatelessWidget {
  const _EventGlyph({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    switch (type) {
      case 'goal':
      case 'penalty':
      case 'own_goal':
        return const Icon(Icons.sports_soccer, size: 22, color: PlColors.electricGreen);
      case 'yellow_card':
        return Container(
          width: 14,
          height: 20,
          decoration: BoxDecoration(
            color: const Color(0xFFF5D90A),
            borderRadius: BorderRadius.circular(2),
            border: Border.all(color: Colors.black54, width: 0.5),
          ),
        );
      case 'red_card':
        return Container(
          width: 14,
          height: 20,
          decoration: BoxDecoration(
            color: PlColors.liveRed,
            borderRadius: BorderRadius.circular(2),
            border: Border.all(color: Colors.black54, width: 0.5),
          ),
        );
      case 'substitution':
        return const Icon(Icons.swap_vert, size: 22, color: PlColors.awayAccent);
      default:
        return Icon(
          Icons.circle,
          size: 10,
          color: Theme.of(context).brightness == Brightness.dark
              ? PlColors.darkOnSurfaceVariant
              : PlColors.lightOnSurfaceVariant,
        );
    }
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats, required this.card});
  final MatchStatistics? stats;
  final MatchCardVm card;

  @override
  Widget build(BuildContext context) {
    if (stats == null || stats!.teams.length < 2) {
      return Center(
        child: Text(
          'STATS UNAVAILABLE',
          style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
        ),
      );
    }
    final home = stats!.teams.firstWhere(
      (t) => t.teamId == card.home.id,
      orElse: () => stats!.teams.first,
    );
    final away = stats!.teams.firstWhere(
      (t) => t.teamId == card.away.id,
      orElse: () => stats!.teams.last,
    );
    final keys = {...home.metrics.keys, ...away.metrics.keys}.toList()..sort();
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: keys.length,
      itemBuilder: (context, i) {
        final k = keys[i];
        final hv = home.metrics[k];
        final av = away.metrics[k];
        if (hv == null && av == null) {
          return const SizedBox.shrink();
        }
        String fmt(Object? v) {
          if (v == null) return '—';
          return '$v';
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            children: [
              Text(
                k.replaceAll('_', ' ').toUpperCase(),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 11,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      fmt(hv),
                      textAlign: TextAlign.left,
                      style: GoogleFonts.archivoNarrow(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      fmt(av),
                      textAlign: TextAlign.right,
                      style: GoogleFonts.archivoNarrow(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ],
              ),
              const Divider(height: 16),
            ],
          ),
        );
      },
    );
  }
}

class _Preds extends StatelessWidget {
  const _Preds({required this.pred});
  final MatchPrediction? pred;

  bool get _hasAdvice {
    final a = pred?.advice?.trim().toLowerCase() ?? '';
    if (a.isEmpty) return false;
    if (a.contains('no prediction') || a.contains('not available')) {
      return false;
    }
    return true;
  }

  bool get _hasPercents =>
      pred?.percentHome != null ||
      pred?.percentDraw != null ||
      pred?.percentAway != null;

  @override
  Widget build(BuildContext context) {
    if (pred == null || (!_hasAdvice && !_hasPercents)) {
      return Center(
        child: Text(
          'PREDICTIONS UNAVAILABLE',
          style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_hasAdvice)
          Text(
            pred!.advice!.toUpperCase(),
            style: GoogleFonts.archivoNarrow(
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          )
        else
          Text(
            'WIN PROBABILITY',
            style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
          ),
        const SizedBox(height: 24),
        _bar('HOME', pred!.percentHome),
        _bar('DRAW', pred!.percentDraw),
        _bar('AWAY', pred!.percentAway),
      ],
    );
  }

  Widget _bar(String label, double? pct) {
    final v = ((pct ?? 0) / 100).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$label ${pct?.toStringAsFixed(0) ?? '—'}%',
            style: GoogleFonts.jetBrainsMono(letterSpacing: 1),
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(
            value: v,
            minHeight: 12,
            backgroundColor: PlColors.darkSurfaceHigh,
            color: PlColors.electricGreen,
          ),
        ],
      ),
    );
  }
}

class _StatsTab extends ConsumerWidget {
  const _StatsTab({required this.matchId, required this.card});
  final String matchId;
  final MatchCardVm card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(matchStatsProvider(matchId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (stats) => _Stats(stats: stats, card: card),
    );
  }
}

class _PredsTab extends ConsumerWidget {
  const _PredsTab({required this.matchId});
  final String matchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(matchPredsProvider(matchId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (pred) => _Preds(pred: pred),
    );
  }
}

class _LineupsTab extends ConsumerWidget {
  const _LineupsTab({required this.matchId, required this.card});
  final String matchId;
  final MatchCardVm card;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(matchLineupsProvider(matchId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (lineups) {
        if (lineups.isEmpty) {
          return Center(
            child: Text(
              'LINEUPS UNAVAILABLE',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        MatchLineup? forTeam(String id) {
          for (final l in lineups) {
            if (l.teamId == id) return l;
          }
          return lineups.isEmpty ? null : lineups.first;
        }

        final home = forTeam(card.home.id);
        final away = forTeam(card.away.id);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (home != null) ...[
              _lineupBlock(card.home.name, home, starters: true),
              _lineupBlock('BENCH · ${card.home.name}', home, starters: false),
            ],
            if (away != null) ...[
              const SizedBox(height: 16),
              _lineupBlock(card.away.name, away, starters: true),
              _lineupBlock('BENCH · ${card.away.name}', away, starters: false),
            ],
          ],
        );
      },
    );
  }

  Widget _lineupBlock(String title, MatchLineup lineup, {required bool starters}) {
    final players = lineup.players.where((p) => p.isStarter == starters).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: GoogleFonts.jetBrainsMono(letterSpacing: 2, fontSize: 12),
          ),
          const SizedBox(height: 8),
          if (players.isEmpty)
            Text(
              '—',
              style: GoogleFonts.inter(color: PlColors.darkOnSurfaceVariant),
            )
          else
            for (final p in players)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    _PlayerFace(name: p.playerName ?? '?', photoUrl: p.photoUrl),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 28,
                      child: Text(
                        p.shirtNumber?.toString() ?? '·',
                        style: GoogleFonts.jetBrainsMono(),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        (p.playerName ?? 'Player').toUpperCase(),
                        style: GoogleFonts.archivoNarrow(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (p.position != null)
                      Text(
                        p.position!,
                        style: GoogleFonts.jetBrainsMono(fontSize: 11),
                      ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _PlayerFace extends StatelessWidget {
  const _PlayerFace({required this.name, this.photoUrl});
  final String name;
  final String? photoUrl;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fallback = Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: dark ? PlColors.darkSurfaceHigh : PlColors.lightSurfaceHigh,
        border: Border.all(
          color: dark ? PlColors.darkBorder : PlColors.lightBorder,
        ),
      ),
      child: Text(
        name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
        style: GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
    final url = photoUrl;
    if (url == null || url.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.zero,
      child: Image.network(
        url,
        width: 36,
        height: 36,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

class _H2HTab extends ConsumerWidget {
  const _H2HTab({required this.matchId});
  final String matchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(matchH2HProvider(matchId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('$e', textAlign: TextAlign.center),
        ),
      ),
      data: (cards) {
        if (cards.isEmpty) {
          return Center(
            child: Text(
              'NO H2H HISTORY',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: cards.length,
          itemBuilder: (context, i) => MatchListCard(
            card: cards[i],
            onTap: () => context.push('/match/${cards[i].match.id}'),
          ),
        );
      },
    );
  }
}
