import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/match_time.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';
import '../../widgets/offline_retry.dart';

final teamsCatalogProvider =
    FutureProvider.autoDispose<List<Team>>((ref) async {
  ref.keepAlive();
  return ref.read(footballRepositoryProvider).teamsCatalog();
});

class TeamsScreen extends ConsumerWidget {
  const TeamsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final async = ref.watch(teamsCatalogProvider);

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
              onRetry: () => ref.invalidate(teamsCatalogProvider),
            ),
            data: (teams) {
              if (teams.isEmpty) {
                return Center(
                  child: Text(
                    'NO TEAMS YET — OPEN HOME FIRST',
                    style: GoogleFonts.jetBrainsMono(letterSpacing: 1),
                  ),
                );
              }
              return RefreshIndicator(
                color: PlColors.electricGreen,
                onRefresh: () async => ref.invalidate(teamsCatalogProvider),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: teams.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final team = teams[i];
                    return InkWell(
                      onTap: () => context.push('/team/${team.id}'),
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
                          ),
                        ),
                        child: Row(
                          children: [
                            EntityMark(
                              label: team.name,
                              logoUrl: team.logoUrl,
                              size: 40,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                team.name.toUpperCase(),
                                style: dark
                                    ? GoogleFonts.archivoNarrow(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                      )
                                    : GoogleFonts.anton(fontSize: 20),
                              ),
                            ),
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

final teamTabProvider = StateProvider.family<int, String>((ref, id) => 0);

final teamByIdProvider =
    FutureProvider.autoDispose.family<Team, String>((ref, id) {
  return ref.read(footballRepositoryProvider).team(id);
});

final teamMatchesInternalProvider =
    FutureProvider.autoDispose.family<List<MatchCardVm>, String>((ref, id) {
  return ref.read(footballRepositoryProvider).matchesForTeam(id);
});

final teamSquadProvider = FutureProvider.autoDispose
    .family<Squad, (String, int)>((ref, args) {
  return ref.read(footballRepositoryProvider).teamSquad(args.$1, args.$2);
});

final teamSeasonStatsProvider = FutureProvider.autoDispose
    .family<TeamSeasonStatistics, (String, int)>((ref, args) {
  return ref
      .read(footballRepositoryProvider)
      .teamSeasonStats(args.$1, args.$2);
});

final teamCoachProvider =
    FutureProvider.autoDispose.family<Coach?, String>((ref, id) {
  return ref.read(footballRepositoryProvider).teamCoach(id);
});

final teamTransfersProvider =
    FutureProvider.autoDispose.family<TransferReport?, String>((ref, id) {
  return ref.read(footballRepositoryProvider).teamTransfers(id);
});

final teamInjuriesProvider = FutureProvider.autoDispose
    .family<InjuryReport?, (String, int)>((ref, args) {
  return ref.read(footballRepositoryProvider).teamInjuries(args.$1, args.$2);
});

class TeamDetailScreen extends ConsumerWidget {
  const TeamDetailScreen({super.key, required this.teamInternalId});

  final String teamInternalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final year = ref.watch(seasonYearProvider);
    final tab = ref.watch(teamTabProvider(teamInternalId));
    final teamAsync = ref.watch(teamByIdProvider(teamInternalId));

    return Scaffold(
      body: SafeArea(
        child: teamAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: PlColors.electricGreen),
          ),
          error: (e, _) => Center(child: Text('$e')),
          data: (team) => Column(
            children: [
              PlAppBar(
                leading: IconButton(
                  icon: Icon(
                    Icons.arrow_back,
                    color:
                        dark ? PlColors.electricGreen : PlColors.lightPrimary,
                  ),
                  onPressed: () => context.pop(),
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: dark
                          ? PlColors.darkOutlineVariant
                          : PlColors.lightBorder,
                    ),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    EntityMark(
                      label: team.name,
                      logoUrl: team.logoUrl,
                      size: 96,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        team.name.toUpperCase(),
                        style: dark
                            ? GoogleFonts.archivoNarrow(
                                fontSize: 36,
                                fontWeight: FontWeight.w800,
                                height: 1,
                              )
                            : GoogleFonts.anton(fontSize: 36, height: 1),
                      ),
                    ),
                  ],
                ),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final entry in const [
                      (0, 'MATCHES'),
                      (1, 'SQUAD'),
                      (2, 'STATS'),
                      (3, 'TRANSFERS'),
                      (4, 'INJURIES'),
                      (5, 'INFO'),
                    ])
                      InkWell(
                        onTap: () => ref
                            .read(teamTabProvider(teamInternalId).notifier)
                            .state = entry.$1,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            vertical: 14,
                            horizontal: 14,
                          ),
                          decoration: BoxDecoration(
                            border: Border(
                              top: BorderSide(
                                color: tab == entry.$1
                                    ? PlColors.electricGreen
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                          child: Text(
                            entry.$2,
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 11,
                              letterSpacing: 1,
                              color: tab == entry.$1
                                  ? (dark
                                      ? Colors.white
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
                  0 => _TeamMatches(
                      teamId: teamInternalId,
                      team: team,
                    ),
                  1 => _TeamSquadPane(
                      teamInternalId: teamInternalId,
                      year: year,
                    ),
                  2 => _TeamStatsPane(
                      teamInternalId: teamInternalId,
                      year: year,
                    ),
                  3 => _TeamTransfersPane(teamInternalId: teamInternalId),
                  4 => _TeamInjuriesPane(
                      teamInternalId: teamInternalId,
                      year: year,
                    ),
                  _ => _TeamInfoPane(
                      teamInternalId: teamInternalId,
                      team: team,
                    ),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeamMatches extends ConsumerWidget {
  const _TeamMatches({required this.teamId, required this.team});
  final String teamId;
  final Team team;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teamMatchesInternalProvider(teamId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (cards) {
        final finished = cards.where((c) => c.match.isFinished).toList();
        final form = finished.take(5).map((c) {
          final m = c.match;
          final home = m.homeTeamId == teamId;
          final hs = m.score?.home ?? 0;
          final as_ = m.score?.away ?? 0;
          if (hs == as_) return 'D';
          final won = home ? hs > as_ : as_ > hs;
          return won ? 'W' : 'L';
        }).join();
        final pts = form.split('').fold<int>(0, (p, c) {
          if (c == 'W') return p + 3;
          if (c == 'D') return p + 1;
          return p;
        });
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (form.isNotEmpty) ...[
              FormGuideBar(form: form, points: pts),
              const SizedBox(height: 24),
            ],
            Text(
              'RECENT & UPCOMING',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
            const Divider(),
            for (final c in cards.take(20))
              _TeamMatchTile(card: c, focusTeamId: teamId),
          ],
        );
      },
    );
  }
}

class _TeamMatchTile extends StatelessWidget {
  const _TeamMatchTile({required this.card, required this.focusTeamId});
  final MatchCardVm card;
  final String focusTeamId;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final m = card.match;
    final status = m.isFinished
        ? 'FT'
        : m.isLive
            ? "${m.minute ?? ''}'"
            : MatchTimeFormat.localWeekdayKickoff(m.kickoffAt).toUpperCase();
    return InkWell(
      onTap: () => context.push('/match/${m.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color:
              dark ? PlColors.darkSurfaceContainer : PlColors.lightSurfaceLowest,
          border: Border.all(
            color: dark ? PlColors.darkOutlineVariant : PlColors.lightBorder,
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    card.competition.name.toUpperCase(),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      letterSpacing: 1,
                      color: dark
                          ? PlColors.darkOnSurfaceVariant
                          : PlColors.lightOnSurfaceVariant,
                    ),
                  ),
                ),
                Text(status, style: GoogleFonts.jetBrainsMono(fontSize: 11)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      _abbrRow(card.home),
                      const SizedBox(height: 8),
                      _abbrRow(card.away),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      m.isUpcoming ? '-' : '${m.score?.home ?? '-'}',
                      style: GoogleFonts.archivoNarrow(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: PlColors.electricGreen,
                      ),
                    ),
                    Text(
                      m.isUpcoming ? '-' : '${m.score?.away ?? '-'}',
                      style: GoogleFonts.archivoNarrow(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _abbrRow(Team t) {
    return Row(
      children: [
        EntityMark(label: t.code, size: 24),
        const SizedBox(width: 8),
        Text(
          t.code,
          style: GoogleFonts.archivoNarrow(
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _TeamSquadPane extends ConsumerWidget {
  const _TeamSquadPane({required this.teamInternalId, required this.year});
  final String teamInternalId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teamSquadProvider((teamInternalId, year)));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Squad unavailable.\nOpen Home first so the team id is mapped, then retry.\n\n$e',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (squad) {
        if (squad.members.isEmpty) {
          return Center(
            child: Text(
              'NO SQUAD DATA',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        return ListView.builder(
          itemCount: squad.members.length,
          itemBuilder: (context, i) {
            final m = squad.members[i];
            final name = (m.playerName?.trim().isNotEmpty == true)
                ? m.playerName!
                : 'Player';
            return ListTile(
              leading: EntityMark(
                label: name,
                logoUrl: m.photoUrl,
                size: 40,
              ),
              title: Text(
                name.toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                [
                  if (m.position != null) m.position!,
                  if (m.shirtNumber != null) '#${m.shirtNumber}',
                ].join(' · '),
              ),
            );
          },
        );
      },
    );
  }
}

class _TeamStatsPane extends ConsumerWidget {
  const _TeamStatsPane({required this.teamInternalId, required this.year});
  final String teamInternalId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teamSeasonStatsProvider((teamInternalId, year)));
    return async.when(
      skipLoadingOnReload: true,
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Stats unavailable for this season.\n$e',
            textAlign: TextAlign.center,
          ),
        ),
      ),
      data: (s) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _stat('PLAYED', '${s.fixturesPlayed ?? '—'}'),
          _stat('WINS', '${s.wins ?? '—'}'),
          _stat('DRAWS', '${s.draws ?? '—'}'),
          _stat('LOSSES', '${s.losses ?? '—'}'),
          _stat('GOALS FOR', '${s.goalsFor ?? '—'}'),
          _stat('GOALS AGAINST', '${s.goalsAgainst ?? '—'}'),
          if (s.form != null) ...[
            const SizedBox(height: 16),
            FormGuideBar(form: s.form!),
          ],
          if (s.metrics.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text(
              'EXTRA METRICS',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
            const SizedBox(height: 8),
            for (final e in s.metrics.entries.take(24))
              if (e.value != null)
                _stat(
                  e.key.replaceAll('_', ' ').toUpperCase(),
                  '${e.value}',
                ),
          ],
        ],
      ),
    );
  }

  Widget _stat(String k, String v) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: PlColors.darkBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(k, style: GoogleFonts.jetBrainsMono(letterSpacing: 1)),
          ),
          Text(
            v,
            style: GoogleFonts.archivoNarrow(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: PlColors.electricGreen,
            ),
          ),
        ],
      ),
    );
  }
}

class _TeamInfoPane extends ConsumerWidget {
  const _TeamInfoPane({required this.teamInternalId, required this.team});
  final String teamInternalId;
  final Team team;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coachAsync = ref.watch(teamCoachProvider(teamInternalId));
    final venueFuture = ref
        .read(footballRepositoryProvider)
        .teamVenue(team);

    return FutureBuilder<Venue?>(
      future: venueFuture,
      builder: (context, venueSnap) {
        final venue = venueSnap.data;
        final coach = coachAsync.asData?.value;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('NAME', style: GoogleFonts.jetBrainsMono(letterSpacing: 1)),
            Text(
              team.name.toUpperCase(),
              style: GoogleFonts.archivoNarrow(
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (team.shortName != null) ...[
              const SizedBox(height: 12),
              Text('CODE', style: GoogleFonts.jetBrainsMono(letterSpacing: 1)),
              Text(
                team.shortName!.toUpperCase(),
                style: GoogleFonts.archivoNarrow(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 16),
            Text('COACH', style: GoogleFonts.jetBrainsMono(letterSpacing: 1)),
            if (coachAsync.isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: LinearProgressIndicator(color: PlColors.electricGreen),
              )
            else
              Row(
                children: [
                  if (coach?.photoUrl != null) ...[
                    EntityMark(
                      label: coach!.name,
                      logoUrl: coach.photoUrl,
                      size: 40,
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Text(
                      (coach?.name ?? '—').toUpperCase(),
                      style: GoogleFonts.archivoNarrow(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 16),
            Text('VENUE', style: GoogleFonts.jetBrainsMono(letterSpacing: 1)),
            Text(
              (venue?.name ?? '—').toUpperCase(),
              style: GoogleFonts.archivoNarrow(
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (venue?.city != null)
              Text(
                venue!.city!,
                style: GoogleFonts.inter(color: PlColors.darkOnSurfaceVariant),
              ),
            if (venue?.capacity != null)
              Text(
                'Capacity ${venue!.capacity}',
                style: GoogleFonts.jetBrainsMono(fontSize: 12),
              ),
          ],
        );
      },
    );
  }
}

class _TeamTransfersPane extends ConsumerWidget {
  const _TeamTransfersPane({required this.teamInternalId});
  final String teamInternalId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teamTransfersProvider(teamInternalId));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (report) {
        final list = report?.transfers ?? const [];
        if (list.isEmpty) {
          return Center(
            child: Text(
              'NO TRANSFERS',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.take(40).length,
          separatorBuilder: (_, _) => const Divider(height: 16),
          itemBuilder: (context, i) {
            final t = list[i];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (t.playerName ?? t.playerId).toUpperCase(),
                  style: GoogleFonts.archivoNarrow(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [t.type, t.date]
                      .whereType<String>()
                      .where((s) => s.isNotEmpty)
                      .join(' · ')
                      .toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(fontSize: 11),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _TeamInjuriesPane extends ConsumerWidget {
  const _TeamInjuriesPane({
    required this.teamInternalId,
    required this.year,
  });
  final String teamInternalId;
  final int year;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(teamInjuriesProvider((teamInternalId, year)));
    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: PlColors.electricGreen),
      ),
      error: (e, _) => Center(child: Text('$e')),
      data: (report) {
        final list = report?.injuries ?? const [];
        if (list.isEmpty) {
          return Center(
            child: Text(
              'NO INJURIES',
              style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
            ),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, _) => const Divider(height: 16),
          itemBuilder: (context, i) {
            final e = list[i];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (e.playerName ?? e.playerId).toUpperCase(),
                  style: GoogleFonts.archivoNarrow(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [e.type, e.reason]
                      .whereType<String>()
                      .where((s) => s.isNotEmpty)
                      .join(' · ')
                      .toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(fontSize: 11),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
