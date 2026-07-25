import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';
import '../../widgets/offline_retry.dart';

final competitionsCatalogProvider =
    FutureProvider.autoDispose<List<Competition>>((ref) async {
  final link = ref.keepAlive();
  Timer? timer;
  ref.onCancel(() {
    timer = Timer(const Duration(minutes: 5), link.close);
  });
  ref.onResume(() => timer?.cancel());
  ref.onDispose(() => timer?.cancel());
  return ref.read(footballRepositoryProvider).competitionsCatalog();
});

final competitionByIdProvider =
    FutureProvider.autoDispose.family<Competition, String>((ref, id) {
  return ref.read(footballRepositoryProvider).getCompetition(id);
});

class LeaguesScreen extends ConsumerWidget {
  const LeaguesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final async = ref.watch(competitionsCatalogProvider);

    return Column(
      children: [
        PlAppBar(onSearch: () => context.push('/search')),
        Expanded(
          child: async.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: PlColors.electricGreen),
            ),
            error: (e, _) => OfflineRetryPane(
              error: e,
              onRetry: () => ref.invalidate(competitionsCatalogProvider),
            ),
            data: (leagues) {
              if (leagues.isEmpty) {
                return Center(
                  child: Text(
                    'NO LEAGUES YET — OPEN HOME FIRST',
                    style: GoogleFonts.jetBrainsMono(letterSpacing: 1),
                  ),
                );
              }
              return RefreshIndicator(
                color: PlColors.electricGreen,
                onRefresh: () async =>
                    ref.invalidate(competitionsCatalogProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: leagues.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final league = leagues[i];
                    return InkWell(
                      onTap: () => context.push('/league/${league.id}'),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: dark
                              ? PlColors.darkSurface
                              : PlColors.lightSurfaceLowest,
                          border: Border.all(
                            color: dark
                                ? PlColors.darkBorder
                                : PlColors.lightBorder,
                            width: dark ? 1 : 2,
                          ),
                        ),
                        child: Row(
                          children: [
                            EntityMark(
                              label: league.name,
                              logoUrl: league.logoUrl,
                              size: 40,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                league.name.toUpperCase(),
                                style: dark
                                    ? GoogleFonts.archivoNarrow(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                      )
                                    : GoogleFonts.anton(fontSize: 20),
                              ),
                            ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

final leagueTabProvider = StateProvider.family<int, String>((ref, id) => 0);

final standingsByCompetitionProvider = FutureProvider.autoDispose
    .family<(Standings, Map<String, Team>), (String, int)>((ref, args) async {
  final repo = ref.read(footballRepositoryProvider);
  final s = await repo.standingsForCompetition(args.$1, args.$2);
  final ids = s.rows.take(24).map((r) => r.teamId).toList();
  final teams = await Future.wait(ids.map((id) async {
    try {
      return MapEntry(id, await repo.team(id));
    } catch (_) {
      return null;
    }
  }));
  final map = <String, Team>{
    for (final e in teams.whereType<MapEntry<String, Team>>()) e.key: e.value,
  };
  return (s, map);
});

final competitionMatchesProvider =
    FutureProvider.autoDispose.family<List<MatchCardVm>, String>((ref, id) {
  return ref.read(footballRepositoryProvider).matchesForCompetition(id);
});

final leagueLeadersProvider = FutureProvider.autoDispose
    .family<SeasonLeaders?, (String, int)>((ref, args) async {
  final repo = ref.read(footballRepositoryProvider);
  final ext = await repo.externalId(args.$1);
  if (ext == null) return null;
  final leagueExt = ext.contains(':') ? ext.split(':').first : ext;
  return repo.api.leaders(leagueExt, args.$2, 'goals');
});

class LeagueDetailScreen extends ConsumerWidget {
  const LeagueDetailScreen({super.key, required this.leagueInternalId});

  final String leagueInternalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final year = ref.watch(seasonYearProvider);
    final tab = ref.watch(leagueTabProvider(leagueInternalId));
    final repo = ref.watch(footballRepositoryProvider);
    final compAsync = ref.watch(competitionByIdProvider(leagueInternalId));
    final cached = repo.discoveredCompetitions[leagueInternalId];
    final name = compAsync.asData?.value.name ?? cached?.name ?? 'LEAGUE';
    final logoUrl = compAsync.asData?.value.logoUrl ?? cached?.logoUrl;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PlAppBar(
              leading: IconButton(
                icon: Icon(
                  Icons.arrow_back,
                  color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
                ),
                onPressed: () => context.pop(),
              ),
            ),
            Container(
              width: double.infinity,
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: dark ? PlColors.darkSurface : PlColors.lightSurfaceLowest,
                border: Border.all(
                  color: dark ? PlColors.darkBorder : PlColors.lightBorder,
                ),
              ),
              child: Column(
                children: [
                  EntityMark(
                    label: name,
                    logoUrl: logoUrl,
                    size: 64,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    name.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: dark
                        ? GoogleFonts.archivoNarrow(
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                          )
                        : GoogleFonts.anton(fontSize: 28),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Season $year',
                    style: GoogleFonts.jetBrainsMono(
                      color: dark
                          ? PlColors.darkOnSurfaceVariant
                          : PlColors.lightOnSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Row(
              children: [
                for (final entry in const [
                  (0, 'TABLE'),
                  (1, 'MATCHES'),
                  (2, 'STATS'),
                  (3, 'TEAMS'),
                ])
                  Expanded(
                    child: InkWell(
                      onTap: () => ref
                          .read(leagueTabProvider(leagueInternalId).notifier)
                          .state = entry.$1,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: tab == entry.$1
                                  ? (dark
                                      ? PlColors.electricGreen
                                      : PlColors.lightOnSurface)
                                  : Colors.transparent,
                              width: 2,
                            ),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          entry.$2,
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 11,
                            letterSpacing: 1,
                            color: tab == entry.$1
                                ? (dark
                                    ? PlColors.electricGreen
                                    : PlColors.lightOnSurface)
                                : (dark
                                    ? PlColors.darkOnSurfaceVariant
                                    : PlColors.lightOnSurfaceVariant),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Expanded(
              child: switch (tab) {
                0 => _StandingsPane(competitionId: leagueInternalId, year: year),
                1 => _MatchesPane(competitionId: leagueInternalId),
                2 => _LeadersPane(competitionId: leagueInternalId, year: year),
                _ => _TeamsPane(competitionId: leagueInternalId, year: year),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _StandingsPane extends ConsumerWidget {
  const _StandingsPane({required this.competitionId, required this.year});
  final String competitionId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async =
        ref.watch(standingsByCompetitionProvider((competitionId, year)));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Standings unavailable.\nOpen Home first, then retry.\n\n$e',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (data) => StandingsTableView(standings: data.$1, teams: data.$2),
    );
  }
}

class StandingsTableView extends StatelessWidget {
  const StandingsTableView({
    super.key,
    required this.standings,
    required this.teams,
  });

  final Standings standings;
  final Map<String, Team> teams;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: DataTable(
          headingRowColor: WidgetStatePropertyAll(
            dark ? PlColors.darkSurfaceLow : PlColors.lightSurfaceLow,
          ),
          border: TableBorder.all(
            color: dark ? PlColors.darkBorder : PlColors.lightBorder,
          ),
          columns: const [
            DataColumn(label: Text('POS')),
            DataColumn(label: Text('TEAM')),
            DataColumn(label: Text('MP')),
            DataColumn(label: Text('W')),
            DataColumn(label: Text('D')),
            DataColumn(label: Text('L')),
            DataColumn(label: Text('GF')),
            DataColumn(label: Text('GA')),
            DataColumn(label: Text('GD')),
            DataColumn(label: Text('PTS')),
          ],
          rows: [
            for (final row in standings.rows)
              DataRow(
                cells: [
                  DataCell(Text('${row.rank}')),
                  DataCell(
                    Row(
                      children: [
                        EntityMark(
                          label: teams[row.teamId]?.name ?? '?',
                          logoUrl: teams[row.teamId]?.logoUrl,
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            (teams[row.teamId]?.name ?? '—').toUpperCase(),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
                  DataCell(Text('${row.played}')),
                  DataCell(Text('${row.won}')),
                  DataCell(Text('${row.drawn}')),
                  DataCell(Text('${row.lost}')),
                  DataCell(Text('${row.goalsFor}')),
                  DataCell(Text('${row.goalsAgainst}')),
                  DataCell(Text('${row.goalDifference}')),
                  DataCell(
                    Text(
                      '${row.points}',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: row.rank <= 2 ? PlColors.electricGreen : null,
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _MatchesPane extends ConsumerWidget {
  const _MatchesPane({required this.competitionId});
  final String competitionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(competitionMatchesProvider(competitionId));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Matches unavailable.\n$e',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (cards) {
        if (cards.isEmpty) {
          return Center(
            child: Text(
              'NO MATCHES',
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

class _LeadersPane extends ConsumerWidget {
  const _LeadersPane({required this.competitionId, required this.year});
  final String competitionId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(leagueLeadersProvider((competitionId, year)));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (leaders) {
        if (leaders == null || leaders.rows.isEmpty) {
          return Center(
            child: Text(
              'LEADERS UNAVAILABLE',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: leaders.rows.length.clamp(0, 20),
          itemBuilder: (context, i) {
            final r = leaders.rows[i];
            final name = r.playerName?.trim().isNotEmpty == true
                ? r.playerName!
                : 'Player';
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: Theme.of(context).dividerColor),
                ),
              ),
              child: Row(
                children: [
                  SizedBox(width: 36, child: Text('#${r.rank}')),
                  EntityMark(
                    label: name,
                    logoUrl: r.playerPhotoUrl,
                    size: 32,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.toUpperCase(),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        if (r.teamName != null && r.teamName!.isNotEmpty)
                          Text(
                            r.teamName!,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: PlColors.darkOnSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    '${r.value}',
                    style: GoogleFonts.jetBrainsMono(
                      color: PlColors.electricGreen,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _TeamsPane extends ConsumerWidget {
  const _TeamsPane({required this.competitionId, required this.year});
  final String competitionId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async =
        ref.watch(standingsByCompetitionProvider((competitionId, year)));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (data) {
        final teams = data.$2.values.toList()
          ..sort((a, b) => a.name.compareTo(b.name));
        return ListView.builder(
          itemCount: teams.length,
          itemBuilder: (context, i) {
            final t = teams[i];
            return ListTile(
              leading: EntityMark(label: t.name, logoUrl: t.logoUrl, size: 36),
              title: Text(t.name.toUpperCase()),
              onTap: () => context.push('/team/${t.id}'),
            );
          },
        );
      },
    );
  }
}
