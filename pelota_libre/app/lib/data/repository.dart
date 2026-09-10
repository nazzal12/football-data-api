import 'dart:async';
import 'dart:developer' as developer;

import '../core/config.dart';
import 'api_client.dart';
import 'models.dart';

void _log(String msg) => developer.log(msg, name: 'FootballRepo');

class MatchCardVm {
  MatchCardVm({
    required this.match,
    required this.home,
    required this.away,
    required this.competition,
  });

  final Match match;
  final Team home;
  final Team away;
  final Competition competition;
}

class LeagueGroupVm {
  LeagueGroupVm({required this.competition, required this.matches});
  final Competition competition;
  final List<MatchCardVm> matches;
}

class FootballRepository {
  FootballRepository(this._api);

  final FootballApi _api;
  final Map<String, Team> _teams = {};
  final Map<String, Competition> _comps = {};
  final Map<String, Match> _matches = {};
  final Map<String, String> _externalByInternal = {};
  final Map<String, String> _internalByExternalComp = {};
  /// Best-known league external id for a team (from match hydration).
  final Map<String, String> _teamLeagueExt = {};
  final Set<String> _featuredCompetitionIds = {};
  bool _featuredReady = false;
  Future<void>? _featuredInflight;

  /// Competitions / teams discovered from feeds (UUID keyed).
  final Map<String, Competition> discoveredCompetitions = {};
  final Map<String, Team> discoveredTeams = {};

  Future<String?> externalId(String internalId) async {
    final cached = _externalByInternal[internalId];
    if (cached != null) return cached;
    final ext = await _api.externalIdFor(internalId);
    if (ext != null) _externalByInternal[internalId] = ext;
    return ext;
  }

  /// Sync lookup for list sorting (populated from projections / featured warm).
  String? cachedExternalId(String internalId) => _externalByInternal[internalId];

  /// Warm featured leagues (by-external). Fast after first cache fill.
  Future<void> ensureFeaturedCompetitions() {
    if (_featuredReady && _featuredCompetitionIds.isNotEmpty) {
      return Future.value();
    }
    return _featuredInflight ??= _loadFeaturedCompetitions().whenComplete(() {
      _featuredInflight = null;
    });
  }

  Future<void> _loadFeaturedCompetitions() async {
    final sw = Stopwatch()..start();
    await _mapPool<Competition, String>(
      AppConfig.featuredLeagueExternalIds,
      (ext) async {
        try {
          final c = await _api.competitionByExternal(ext);
          _comps[c.id] = c;
          discoveredCompetitions[c.id] = c;
          _featuredCompetitionIds.add(c.id);
          _internalByExternalComp[ext] = c.id;
          _externalByInternal[c.id] = ext;
          return c;
        } catch (e) {
          _log('featured league $ext fail: $e');
          return null;
        }
      },
      concurrency: 8,
    );
    _featuredReady = _featuredCompetitionIds.isNotEmpty;
    _log(
      'featured leagues ready ${_featuredCompetitionIds.length} in ${sw.elapsedMilliseconds}ms',
    );
  }

  void _rememberTeamLeague(String teamInternalId, String? competitionInternalId) {
    if (competitionInternalId == null) return;
    final ext = _externalByInternal[competitionInternalId];
    if (ext == null || ext.isEmpty) return;
    final leagueExt = ext.contains(':') ? ext.split(':').first : ext;
    _teamLeagueExt[teamInternalId] ??= leagueExt;
  }

  Future<Team> team(String id) async {
    final cached = _teams[id];
    if (cached != null) {
      if (cached.logoUrl != null) return cached;
      final ext = _externalByInternal[id] ?? await externalId(id);
      if (ext == null) return cached;
      final withLogo = Team(
        id: cached.id,
        name: cached.name,
        shortName: cached.shortName,
        countryId: cached.countryId,
        venueId: cached.venueId,
        logoUrl: AppConfig.teamLogoFallback(ext),
      );
      _teams[id] = withLogo;
      discoveredTeams[id] = withLogo;
      return withLogo;
    }
    var t = await _api.team(id);
    if (t.logoUrl == null) {
      final ext = await externalId(id);
      if (ext != null) {
        t = Team(
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          countryId: t.countryId,
          venueId: t.venueId,
          logoUrl: AppConfig.teamLogoFallback(ext),
        );
      }
    }
    _teams[id] = t;
    discoveredTeams[id] = t;
    return t;
  }

  Future<Competition> getCompetition(String id) async {
    final cached = _comps[id];
    if (cached != null) return cached;
    final c = await _api.competition(id);
    _comps[id] = c;
    discoveredCompetitions[id] = c;
    return c;
  }

  Future<Match> match(String id, {bool forceRefresh = false}) async {
    final cached = _matches[id];
    // Finished snapshots are stable; lists poison memory with stale cards.
    if (!forceRefresh && cached != null && cached.isFinished) return cached;
    final m = await _api.match(
      id,
      forceRefresh: forceRefresh ||
          cached?.isLive == true ||
          (cached != null &&
              cached.isUpcoming &&
              !cached.kickoffAt.isAfter(DateTime.now().toUtc())),
    );
    _matches[id] = m;
    return m;
  }

  /// Instant cards from projection `items` (no per-match N+1).
  /// [liveOnly] null = all phases; true = live only; false = non-live only.
  /// [limit] null = no cutoff (show every projection item).
  List<MatchCardVm> cardsFromProjectionItems(
    List<MatchListItem> items, {
    int? limit,
    bool? liveOnly,
  }) {
    final out = <MatchCardVm>[];
    for (final item in items) {
      if (liveOnly == true && item.phase != 'live') continue;
      if (liveOnly == false && item.phase == 'live') continue;
      final m = item.toMatch();
      _matches[m.id] = m;
      final home = Team(
        id: item.homeTeamId,
        name: item.homeName,
        logoUrl: item.homeLogoUrl,
      );
      final away = Team(
        id: item.awayTeamId,
        name: item.awayName,
        logoUrl: item.awayLogoUrl,
      );
      final comp = Competition(
        id: item.competitionId,
        name: item.competitionName ?? 'Competition',
        format: 'league',
        isLeague: true,
        logoUrl: item.competitionLogoUrl,
      );
      _teams[home.id] = home;
      _teams[away.id] = away;
      _comps[comp.id] = comp;
      discoveredTeams[home.id] = home;
      discoveredTeams[away.id] = away;
      discoveredCompetitions[comp.id] = comp;
      final ext = item.competitionExternalId;
      if (ext != null && ext.isNotEmpty) {
        _externalByInternal[comp.id] = ext;
        _internalByExternalComp[ext] = comp.id;
      }
      out.add(
        MatchCardVm(match: m, home: home, away: away, competition: comp),
      );
      if (limit != null && out.length >= limit) break;
    }
    return out;
  }

  Future<String?> logoForTeam(Team team) async {
    if (team.logoUrl != null && team.logoUrl!.isNotEmpty) return team.logoUrl;
    final ext = await externalId(team.id);
    if (ext == null) return null;
    return AppConfig.teamLogoFallback(ext);
  }

  Future<List<T>> _mapPool<T, I>(
    List<I> items,
    Future<T?> Function(I item) fn, {
    int concurrency = AppConfig.hydrateConcurrency,
    int gapMs = AppConfig.hydrateGapMs,
  }) async {
    final out = <T>[];
    for (var i = 0; i < items.length; i += concurrency) {
      if (i > 0 && gapMs > 0) {
        await Future<void>.delayed(Duration(milliseconds: gapMs));
      }
      final chunk = items.skip(i).take(concurrency).toList();
      final part = await Future.wait(chunk.map(fn));
      out.addAll(part.whereType<T>());
    }
    return out;
  }

  Future<MatchCardVm?> hydrateMatch(Match m) async {
    _matches[m.id] = m;
    late Team home;
    late Team away;
    late Competition comp;
    try {
      home = await team(m.homeTeamId);
    } catch (_) {
      home = Team(id: m.homeTeamId, name: 'Home');
    }
    try {
      away = await team(m.awayTeamId);
    } catch (_) {
      away = Team(id: m.awayTeamId, name: 'Away');
    }
    try {
      comp = await getCompetition(m.competitionId);
    } catch (_) {
      comp = Competition(
        id: m.competitionId,
        name: 'Competition',
        format: 'other',
        isLeague: true,
      );
    }
    discoveredTeams[home.id] = home;
    discoveredTeams[away.id] = away;
    discoveredCompetitions[comp.id] = comp;
    _rememberTeamLeague(home.id, comp.id);
    _rememberTeamLeague(away.id, comp.id);
    return MatchCardVm(
      match: m,
      home: home,
      away: away,
      competition: comp,
    );
  }

  /// Pull match objects until we have enough featured-league fixtures.
  Future<List<Match>> _collectFeaturedMatches(
    List<String> ids, {
    required int limit,
  }) async {
    final scan = ids.take(AppConfig.projectionScanLimit).toList();
    final kept = <Match>[];
    final other = <Match>[];

    for (var i = 0; i < scan.length && kept.length < limit; i += AppConfig.hydrateConcurrency) {
      final chunk = scan.skip(i).take(AppConfig.hydrateConcurrency).toList();
      final matches = await _mapPool<Match, String>(
        chunk,
        (id) async {
          try {
            return await match(id);
          } catch (e) {
            _log('match fail $id: $e');
            return null;
          }
        },
      );
      for (final m in matches) {
        if (_featuredCompetitionIds.contains(m.competitionId)) {
          kept.add(m);
        } else {
          other.add(m);
        }
      }
    }

    // Summer / sparse days: fill with non-featured so the UI is not empty.
    if (kept.length < limit) {
      for (final m in other) {
        if (kept.length >= limit) break;
        kept.add(m);
      }
    }
    return kept.take(limit).toList();
  }

  Future<List<MatchCardVm>> hydrateMatches(
    List<String> ids, {
    int limit = AppConfig.homeMatchLimit,
    bool featuredOnly = false,
  }) async {
    final sw = Stopwatch()..start();
    if (featuredOnly) {
      await ensureFeaturedCompetitions();
    }

    final List<Match> matches;
    if (featuredOnly) {
      matches = await _collectFeaturedMatches(ids, limit: limit);
    } else {
      matches = await _mapPool<Match, String>(
        ids.take(limit).toList(),
        (id) async {
          try {
            return await match(id);
          } catch (e) {
            _log('match fail $id: $e');
            return null;
          }
        },
      );
    }

    final teamIds = <String>{};
    final compIds = <String>{};
    for (final m in matches) {
      teamIds.add(m.homeTeamId);
      teamIds.add(m.awayTeamId);
      compIds.add(m.competitionId);
    }

    await Future.wait([
      _mapPool<Team, String>(
        teamIds.toList(),
        (id) async {
          try {
            return await team(id);
          } catch (e) {
            _log('team fail $id: $e');
            return null;
          }
        },
      ),
      _mapPool<Competition, String>(
        compIds.toList(),
        (id) async {
          try {
            return await getCompetition(id);
          } catch (e) {
            _log('comp fail $id: $e');
            return null;
          }
        },
      ),
    ]);

    final cards = <MatchCardVm>[];
    for (final m in matches) {
      final card = await hydrateMatch(m);
      if (card != null) cards.add(card);
    }
    _log('hydrated ${cards.length} cards in ${sw.elapsedMilliseconds}ms');
    return cards;
  }

  Future<List<LeagueGroupVm>> groupByCompetition(List<MatchCardVm> cards) async {
    final map = <String, List<MatchCardVm>>{};
    for (final c in cards) {
      map.putIfAbsent(c.competition.id, () => []).add(c);
    }
    final groups = <LeagueGroupVm>[];
    for (final entry in map.entries) {
      final list = entry.value
        ..sort((a, b) => a.match.kickoffAt.compareTo(b.match.kickoffAt));
      groups.add(
        LeagueGroupVm(competition: list.first.competition, matches: list),
      );
    }
    groups.sort((a, b) {
      final aExt = _externalByInternal[a.competition.id];
      final bExt = _externalByInternal[b.competition.id];
      return AppConfig.compareLeaguesByPopularity(
        aExternalId: aExt,
        aName: a.competition.name,
        bExternalId: bExt,
        bName: b.competition.name,
      );
    });
    return groups;
  }

  Future<List<LeagueGroupVm>> homeFeed({
    required DateTime day,
    required bool liveOnly,
    bool forceRefresh = false,
    bool forceUpstream = false,
  }) async {
    final sw = Stopwatch()..start();
    // Featured warm is optional when projection items already carry league names.
    final featuredFuture = ensureFeaturedCompetitions();
    List<MatchCardVm> cards;
    if (liveOnly) {
      _log('homeFeed LIVE force=$forceRefresh upstream=$forceUpstream');
      final proj = await _api.matchesLive(
        forceRefresh: forceRefresh,
        forceUpstream: forceUpstream,
      );
      _log(
        'projection ids=${proj.matchIds.length} items=${proj.items.length} after ${sw.elapsedMilliseconds}ms',
      );
      if (proj.items.isNotEmpty) {
        cards = cardsFromProjectionItems(
          proj.items,
          liveOnly: true,
        );
        unawaited(featuredFuture);
      } else {
        await featuredFuture;
        cards = await hydrateMatches(
          proj.matchIds,
          limit: proj.matchIds.length,
          featuredOnly: false,
        );
        cards = cards.where((c) => c.match.isLive).toList();
      }
    } else {
      final viewerYmd =
          '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
      final providerDays = [
        day.subtract(const Duration(days: 1)),
        day,
        day.add(const Duration(days: 1)),
      ];
      _log('homeFeed date=$viewerYmd (±1) force=$forceRefresh upstream=$forceUpstream');
      final projs = await Future.wait(
        providerDays.map((d) {
          final ymd =
              '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
          return _api.matchesByDate(
            ymd,
            forceRefresh: forceRefresh,
            forceUpstream: forceUpstream,
          );
        }),
      );
      final byId = <String, MatchListItem>{};
      for (final proj in projs) {
        for (final item in proj.items) {
          final local = item.kickoffAt.toLocal();
          final localYmd =
              '${local.year.toString().padLeft(4, '0')}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
          if (localYmd != viewerYmd) continue;
          byId[item.matchId] = item;
        }
      }
      _log(
        'merged ${byId.length} viewer-day items after ${sw.elapsedMilliseconds}ms',
      );
      if (byId.isNotEmpty) {
        cards = cardsFromProjectionItems(
          byId.values.toList(),
        );
        unawaited(featuredFuture);
      } else {
        await featuredFuture;
        final ids = <String>{};
        for (final proj in projs) {
          ids.addAll(proj.matchIds);
        }
        cards = await hydrateMatches(
          ids.toList(),
          limit: ids.length,
          featuredOnly: false,
        );
        cards = cards.where((c) {
          final local = c.match.kickoffAt.toLocal();
          final localYmd =
              '${local.year.toString().padLeft(4, '0')}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
          return localYmd == viewerYmd;
        }).toList();
      }
    }
    _log('homeFeed done ${cards.length} in ${sw.elapsedMilliseconds}ms');
    return groupByCompetition(cards);
  }

  Future<List<MatchCardVm>> liveFeed({
    bool forceRefresh = true,
    bool forceUpstream = false,
  }) async {
    final proj = await _api.matchesLive(
      forceRefresh: forceRefresh,
      forceUpstream: forceUpstream,
    );
    if (proj.items.isNotEmpty) {
      return cardsFromProjectionItems(
        proj.items,
        liveOnly: true,
      );
    }
    await ensureFeaturedCompetitions();
    final cards = await hydrateMatches(
      proj.matchIds,
      limit: proj.matchIds.length,
      featuredOnly: false,
    );
    return cards.where((c) => c.match.isLive).toList();
  }

  Future<List<Competition>> competitionsCatalog() async {
    await ensureFeaturedCompetitions();
    // Seed discovery from today's board so Leagues tab matches Home leagues
    // even if the user opens Leagues first.
    try {
      final now = DateTime.now();
      final ymd =
          '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      final proj = await _api.matchesByDate(ymd);
      if (proj.items.isNotEmpty) {
        cardsFromProjectionItems(proj.items);
      }
    } catch (e) {
      _log('competitionsCatalog day seed fail: $e');
    }
    // Featured first (stable AppConfig order), then every other discovered league.
    final byId = Map<String, Competition>.from(discoveredCompetitions);
    final featured = <Competition>[];
    final seen = <String>{};
    for (final ext in AppConfig.featuredLeagueExternalIds) {
      final id = _internalByExternalComp[ext];
      final c = id != null ? byId[id] : null;
      if (c == null || !seen.add(c.id)) continue;
      featured.add(c);
    }
    final rest = byId.values.where((c) => !seen.contains(c.id)).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    return [...featured, ...rest];
  }

  Future<List<Team>> teamsCatalog() async {
    if (discoveredTeams.length >= 24) {
      return discoveredTeams.values.toList()
        ..sort((a, b) => a.name.compareTo(b.name));
    }
    await ensureFeaturedCompetitions();
    final year = AppConfig.defaultSeasonYear;
    // Seed from a few top-league tables (fast + logos).
    final seedExt = AppConfig.featuredLeagueExternalIds.take(4).toList();
    await _mapPool<bool, String>(
      seedExt,
      (ext) async {
        try {
          final s = await _api.standingsByExternal(ext, year);
          await _mapPool<Team, String>(
            s.rows.take(12).map((r) => r.teamId).toList(),
            (id) async {
              try {
                return await team(id);
              } catch (_) {
                return null;
              }
            },
            concurrency: 4,
          );
          return true;
        } catch (e) {
          _log('teams seed $ext fail: $e');
          return false;
        }
      },
      concurrency: 2,
    );
    return discoveredTeams.values.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
  }

  Future<Standings> standingsForCompetition(
    String competitionInternalId,
    int year,
  ) async {
    final ext = await externalId(competitionInternalId);
    if (ext == null) {
      throw ApiException(
        status: 404,
        message: 'No external id mapped for this competition yet',
      );
    }
    final leagueExt = ext.contains(':') ? ext.split(':').first : ext;
    return _api.standingsByExternal(leagueExt, year);
  }

  Future<List<MatchCardVm>> matchesForCompetition(
    String competitionInternalId,
  ) async {
    final year = AppConfig.defaultSeasonYear;
    final ext = await externalId(competitionInternalId);
    if (ext != null) {
      final leagueExt = ext.contains(':') ? ext.split(':').first : ext;
      try {
        final proj = await _api.matchesByLeague(leagueExt, year);
        if (proj.items.isNotEmpty) {
          return cardsFromProjectionItems(proj.items, limit: 20);
        }
        return hydrateMatches(
          proj.matchIds,
          limit: 20,
          featuredOnly: false,
        );
      } catch (e) {
        _log('by-league fail $leagueExt: $e — falling back to date scan');
      }
    }
    // Fallback: recent dates filtered to this competition.
    final now = DateTime.now();
    final days = [
      now.subtract(const Duration(days: 1)),
      now,
      now.add(const Duration(days: 1)),
    ];
    final ids = <String>{};
    for (final d in days) {
      final ymd =
          '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      try {
        final proj = await _api.matchesByDate(ymd);
        ids.addAll(proj.matchIds.take(30));
      } catch (_) {}
    }
    final cards = await hydrateMatches(
      ids.toList(),
      limit: 30,
      featuredOnly: false,
    );
    return cards
        .where((c) => c.match.competitionId == competitionInternalId)
        .toList();
  }

  Future<List<MatchCardVm>> matchesForTeam(String teamInternalId) async {
    final year = AppConfig.defaultSeasonYear;
    final ext = await externalId(teamInternalId);
    if (ext != null) {
      try {
        final proj = await _api.matchesByTeam(ext, year);
        if (proj.items.isNotEmpty) {
          return cardsFromProjectionItems(proj.items, limit: 20);
        }
        return hydrateMatches(
          proj.matchIds,
          limit: 20,
          featuredOnly: false,
        );
      } catch (e) {
        _log('by-team fail $ext: $e');
      }
    }
    final now = DateTime.now();
    final ymd =
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final proj = await _api.matchesByDate(ymd);
    final cards = await hydrateMatches(
      proj.matchIds,
      limit: 24,
      featuredOnly: false,
    );
    return cards
        .where(
          (c) =>
              c.match.homeTeamId == teamInternalId ||
              c.match.awayTeamId == teamInternalId,
        )
        .toList();
  }

  Future<Standings> standings(String leagueExt, int year) =>
      _api.standingsByExternal(leagueExt, year);

  Future<List<MatchCardVm>> leagueMatches(String leagueExt, int year) async {
    final proj = await _api.matchesByLeague(leagueExt, year);
    if (proj.items.isNotEmpty) {
      return cardsFromProjectionItems(proj.items, limit: 24);
    }
    return hydrateMatches(proj.matchIds, limit: 24, featuredOnly: false);
  }

  Future<List<MatchCardVm>> teamMatchesByExternal(
    String teamExt,
    int year,
  ) async {
    final proj = await _api.matchesByTeam(teamExt, year);
    if (proj.items.isNotEmpty) {
      return cardsFromProjectionItems(proj.items, limit: 24);
    }
    return hydrateMatches(proj.matchIds, limit: 24, featuredOnly: false);
  }

  /// Timeline + venue only — keep match open snappy; other tabs lazy-load.
  Future<({List<MatchEvent> events, Venue? venue})> matchTimelineExtras(
    Match m,
  ) async {
    Venue? venue;
    var events = m.events;
    await Future.wait([
      () async {
        if (m.venueId == null) return;
        try {
          venue = await _api.venue(m.venueId!);
        } catch (_) {}
      }(),
      () async {
        try {
          // Live: always refresh events. Others: fill if snapshot empty.
          events = await _api.matchEvents(
            m.id,
            forceRefresh: m.isLive || events.isEmpty,
          );
        } catch (_) {}
      }(),
    ]);
    // Newest first for the timeline UI.
    events = [...events]..sort((a, b) {
        final am = (a.minute ?? 0) * 100 + (a.extraMinute ?? 0);
        final bm = (b.minute ?? 0) * 100 + (b.extraMinute ?? 0);
        final byMin = bm.compareTo(am);
        if (byMin != 0) return byMin;
        return b.sequence.compareTo(a.sequence);
      });
    return (events: events, venue: venue);
  }

  Future<MatchStatistics?> matchStats(String matchId) async {
    try {
      final m = _matches[matchId];
      return await _api.matchStatistics(
        matchId,
        forceRefresh: m?.isLive == true || m?.isUpcoming == true,
      );
    } catch (e) {
      _log('matchStats fail $matchId: $e');
      return null;
    }
  }

  Future<MatchPrediction?> matchPreds(String matchId) async {
    try {
      return await _api.matchPrediction(matchId);
    } catch (_) {
      return null;
    }
  }

  Future<List<MatchLineup>> matchLineups(Match m) async {
    if (m.lineups.isNotEmpty) return m.lineups;
    try {
      return await _api.matchLineups(m.id);
    } catch (_) {
      return const [];
    }
  }

  Future<InjuryReport?> matchInjuries(String matchId) async {
    try {
      return await _api.matchInjuries(matchId);
    } catch (_) {
      return null;
    }
  }

  Future<List<MatchCardVm>> matchH2H(Match m) async {
    final homeExt = await externalId(m.homeTeamId);
    final awayExt = await externalId(m.awayTeamId);
    if (homeExt == null || awayExt == null) {
      throw ApiException(
        status: 404,
        message: 'Team external ids not ready for H2H yet',
      );
    }
    final h2h = await _api.h2hByExternal(homeExt, awayExt);
    return hydrateMatches(
      h2h.matchIds,
      limit: 10,
      featuredOnly: false,
    );
  }

  Future<TransferReport?> teamTransfers(String teamInternalId) async {
    final ext = await externalId(teamInternalId);
    if (ext == null) return null;
    try {
      return await _api.teamTransfers(ext);
    } catch (_) {
      return null;
    }
  }

  Future<InjuryReport?> teamInjuries(String teamInternalId, int year) async {
    final ext = await externalId(teamInternalId);
    if (ext == null) return null;
    try {
      return await _api.teamInjuries(ext, year);
    } catch (_) {
      return null;
    }
  }

  List<String> _leagueCandidatesForTeam(String teamInternalId) {
    final preferred = _teamLeagueExt[teamInternalId];
    final out = <String>[];
    if (preferred != null) out.add(preferred);
    for (final ext in AppConfig.featuredLeagueExternalIds) {
      if (!out.contains(ext)) out.add(ext);
    }
    return out;
  }

  /// Squad via by-external; prefer remembered league, then top 2 featured.
  Future<Squad> teamSquad(String teamInternalId, int year) async {
    final ext = await externalId(teamInternalId);
    if (ext == null) {
      throw ApiException(
        status: 404,
        message: 'Team external id not mapped yet — open Home first',
      );
    }
    Object? lastErr;
    for (final leagueExt in _leagueCandidatesForTeam(teamInternalId).take(3)) {
      try {
        final squad = await _api.squad(ext, leagueExt, year);
        if (squad.members.isNotEmpty) {
          _teamLeagueExt[teamInternalId] = leagueExt;
          return squad;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw ApiException(
      status: 404,
      message: 'Squad unavailable for this season',
      details: lastErr?.toString(),
    );
  }

  Future<TeamSeasonStatistics> teamSeasonStats(
    String teamInternalId,
    int year,
  ) async {
    final ext = await externalId(teamInternalId);
    if (ext == null) {
      throw ApiException(
        status: 404,
        message: 'Team external id not mapped yet — open Home first',
      );
    }
    Object? lastErr;
    for (final leagueExt in _leagueCandidatesForTeam(teamInternalId).take(3)) {
      try {
        final stats = await _api.teamStats(ext, leagueExt, year);
        _teamLeagueExt[teamInternalId] = leagueExt;
        return stats;
      } catch (e) {
        lastErr = e;
      }
    }
    throw ApiException(
      status: 404,
      message: 'Season stats unavailable',
      details: lastErr?.toString(),
    );
  }

  Future<Coach?> teamCoach(String teamInternalId) async {
    final ext = await externalId(teamInternalId);
    if (ext == null) return null;
    try {
      return await _api.teamCoach(ext);
    } catch (_) {
      return null;
    }
  }

  Future<Venue?> teamVenue(Team team) async {
    if (team.venueId == null) return null;
    try {
      return await _api.venue(team.venueId!);
    } catch (_) {
      return null;
    }
  }

  /// Local search over discovered + featured catalogs (no extra origin blast).
  Future<
      ({
        List<Competition> competitions,
        List<Team> teams,
        List<MatchCardVm> matches,
      })> search(String query) async {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) {
      return (competitions: <Competition>[], teams: <Team>[], matches: <MatchCardVm>[]);
    }
    await ensureFeaturedCompetitions();
    if (discoveredTeams.length < 12) {
      try {
        await teamsCatalog();
      } catch (_) {}
    }

    final comps = discoveredCompetitions.values
        .where((c) => c.name.toLowerCase().contains(q))
        .toList()
      ..sort((a, b) {
        final aExact = a.name.toLowerCase() == q;
        final bExact = b.name.toLowerCase() == q;
        if (aExact != bExact) return aExact ? -1 : 1;
        final aStarts = a.name.toLowerCase().startsWith(q);
        final bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts != bStarts) return aStarts ? -1 : 1;
        return a.name.compareTo(b.name);
      });
    final topComps = comps.take(20).toList();
    final compIds = topComps.map((c) => c.id).toSet();

    final teams = discoveredTeams.values
        .where(
          (t) =>
              t.name.toLowerCase().contains(q) ||
              (t.shortName?.toLowerCase().contains(q) ?? false),
        )
        .toList()
      ..sort((a, b) {
        final aExact = a.name.toLowerCase() == q;
        final bExact = b.name.toLowerCase() == q;
        if (aExact != bExact) return aExact ? -1 : 1;
        return a.name.compareTo(b.name);
      });
    final topTeams = teams.take(30).toList();
    final teamIds = topTeams.map((t) => t.id).toSet();

    // Matches first priority: related to matched leagues/teams, then name hits.
    final related = <MatchCardVm>[];
    final nameHits = <MatchCardVm>[];
    final seen = <String>{};

    Future<void> consider(Match m, {required bool prioritized}) async {
      if (seen.contains(m.id)) return;
      final card = await hydrateMatch(m);
      if (card == null) return;
      seen.add(m.id);
      if (prioritized) {
        related.add(card);
      } else {
        nameHits.add(card);
      }
    }

    for (final m in _matches.values) {
      final byLeague = compIds.contains(m.competitionId);
      final byTeam =
          teamIds.contains(m.homeTeamId) || teamIds.contains(m.awayTeamId);
      if (byLeague || byTeam) {
        await consider(m, prioritized: true);
        if (related.length >= 40) break;
      }
    }

    if (related.length + nameHits.length < 40) {
      for (final m in _matches.values) {
        if (seen.contains(m.id)) continue;
        final home = _teams[m.homeTeamId];
        final away = _teams[m.awayTeamId];
        final comp = _comps[m.competitionId];
        final hay = [
          home?.name,
          away?.name,
          comp?.name,
          home?.shortName,
          away?.shortName,
        ].whereType<String>().join(' ').toLowerCase();
        if (!hay.contains(q)) continue;
        await consider(m, prioritized: false);
        if (related.length + nameHits.length >= 40) break;
      }
    }

    // Prefer live → upcoming → finished within each bucket.
    int phaseRank(MatchCardVm c) {
      if (c.match.isLive) return 0;
      if (c.match.isUpcoming) return 1;
      return 2;
    }

    related.sort((a, b) {
      final p = phaseRank(a).compareTo(phaseRank(b));
      if (p != 0) return p;
      return a.match.kickoffAt.compareTo(b.match.kickoffAt);
    });
    nameHits.sort((a, b) {
      final p = phaseRank(a).compareTo(phaseRank(b));
      if (p != 0) return p;
      return a.match.kickoffAt.compareTo(b.match.kickoffAt);
    });

    return (
      competitions: topComps,
      teams: topTeams,
      matches: [...related, ...nameHits],
    );
  }

  FootballApi get api => _api;
}
