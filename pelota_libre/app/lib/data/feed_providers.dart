import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'models.dart';
import 'providers.dart';
import 'repository.dart';

/// Align with Worker Cache-Control / soft TTLs (see docs/API.md).
const pastCalendarKeepAlive = Duration(hours: 6);
const todayCalendarKeepAlive = Duration(seconds: 60); // dateListPolicy max-age
const liveKeepAlive = Duration(seconds: 5); // liveListPolicy

/// Viewer's local civil date (`yyyy-MM-dd`).
String todayCalendarDateKey() =>
    DateFormat('yyyy-MM-dd').format(DateTime.now());

String addDaysYmd(String ymd, int delta) {
  final d = DateTime.parse(ymd);
  final next = DateTime(d.year, d.month, d.day + delta);
  return DateFormat('yyyy-MM-dd').format(next);
}

List<String> providerDatesForViewerDay(String viewerYmd) => [
      addDaysYmd(viewerYmd, -1),
      viewerYmd,
      addDaysYmd(viewerYmd, 1),
    ];

Future<void> evictLiveCalendarCache(WidgetRef ref) async {
  final cache = ref.read(responseCacheProvider);
  await cache.delete('/v1/projections/matches/live');
}

Future<void> evictCalendarCacheForDate(WidgetRef ref, String date) async {
  final cache = ref.read(responseCacheProvider);
  final ymd = date.isEmpty ? todayCalendarDateKey() : date;
  await Future.wait(
    providerDatesForViewerDay(ymd).map(
      (d) => cache.delete('/v1/projections/matches/by-date/$d'),
    ),
  );
}

Future<void> _evictLiveAndToday(WidgetRef ref) async {
  final cache = ref.read(responseCacheProvider);
  final today = todayCalendarDateKey();
  await Future.wait([
    cache.delete('/v1/projections/matches/live'),
    ...providerDatesForViewerDay(today).map(
      (d) => cache.delete('/v1/projections/matches/by-date/$d'),
    ),
  ]);
}

/// Cold start / return-to-foreground: hit the Worker immediately.
Future<void> refreshFeedsOnAppOpen(WidgetRef ref) async {
  try {
    await _evictLiveAndToday(ref);
  } catch (_) {}

  final today = todayCalendarDateKey();

  try {
    await Future.wait<void>([
      ref
          .read(liveMatchesProvider.notifier)
          .refreshIfNeeded(force: true, forceUpstream: true),
      ref
          .read(matchesProvider(today).notifier)
          .refresh(force: true, forceUpstream: true),
    ]);
  } catch (_) {}

  // Soft follow-up — avoid a burst of overlapping polls that race.
  unawaited(() async {
    await Future<void>.delayed(const Duration(seconds: 4));
    try {
      await ref.read(liveMatchesProvider.notifier).refreshIfNeeded(force: true);
    } catch (_) {}
  }());
}

/// Soft-stale polls can briefly report an older clock than the last good one.
MatchCardVm mergeLiveCardMonotonic({
  MatchCardVm? previous,
  required MatchCardVm incoming,
  bool replace = false,
}) {
  if (replace || previous == null) return incoming;
  final prev = previous.match;
  final inc = incoming.match;

  final prevMin = prev.minute;
  final incMin = inc.minute;
  final minute = () {
    // Non-minute status labels (HT / ET / PEN) must replace a frozen minute.
    if (incMin == null &&
        inc.status.isNotEmpty &&
        !RegExp(r'^\d').hasMatch(inc.status)) {
      return incMin;
    }
    if (prevMin != null && (incMin == null || prevMin > incMin)) {
      return prevMin;
    }
    return incMin;
  }();

  int maxScore(int a, int b) => a > b ? a : b;
  MatchScore? score;
  if (prev.score != null || inc.score != null) {
    score = MatchScore(
      home: maxScore(prev.score?.home ?? 0, inc.score?.home ?? 0),
      away: maxScore(prev.score?.away ?? 0, inc.score?.away ?? 0),
    );
  }

  return MatchCardVm(
    match: inc.copyWith(
      minute: minute ?? inc.minute,
      score: score ?? inc.score,
      phase: inc.phase,
      status: (prevMin != null && (incMin == null || prevMin > incMin))
          ? prev.status
          : inc.status,
    ),
    home: incoming.home,
    away: incoming.away,
    competition: incoming.competition,
  );
}

List<MatchCardVm> mergeLiveMatchesMonotonic({
  List<MatchCardVm>? previous,
  required List<MatchCardVm> incoming,
  bool replace = false,
}) {
  if (replace || previous == null || previous.isEmpty) return incoming;
  final prevById = {for (final m in previous) m.match.id: m};
  return [
    for (final inc in incoming)
      mergeLiveCardMonotonic(
        previous: prevById[inc.match.id],
        incoming: inc,
        replace: false,
      ),
  ];
}

/// Live board snapshot — [generation] always changes so UI rebuilds every poll.
@immutable
class LiveBoardSnapshot {
  const LiveBoardSnapshot({
    required this.matches,
    required this.fetchedAt,
    required this.generation,
  });

  final List<MatchCardVm> matches;
  final DateTime fetchedAt;
  final int generation;

  MatchCardVm? byId(String id) {
    for (final m in matches) {
      if (m.match.id == id) return m;
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is LiveBoardSnapshot && other.generation == generation;

  @override
  int get hashCode => generation;
}

/// Shared live board — single source of truth for in-play score/minute.
class LiveMatchesNotifier extends AsyncNotifier<LiveBoardSnapshot> {
  static const ttl = liveKeepAlive;

  DateTime? _fetchedAt;
  Future<LiveBoardSnapshot>? _inFlight;
  Timer? _pollTimer;
  int _generation = 0;
  int _fetchEpoch = 0;
  int _pollTick = 0;

  @override
  Future<LiveBoardSnapshot> build() {
    _pollTimer?.cancel();
    _pollTick = 0;
    _pollTimer = Timer.periodic(ttl, (_) {
      _pollTick++;
      // Every ~15s ask Worker to rebuild (not soft-serve).
      final forceUpstream = _pollTick % 3 == 0;
      unawaited(
        refreshIfNeeded(force: true, forceUpstream: forceUpstream),
      );
    });
    ref.onDispose(() {
      _pollTimer?.cancel();
      _pollTimer = null;
      _fetchedAt = null;
      _inFlight = null;
    });
    return _runFetch();
  }

  bool get isFresh =>
      _fetchedAt != null && DateTime.now().difference(_fetchedAt!) < ttl;

  Future<LiveBoardSnapshot> refreshIfNeeded({
    bool force = false,
    bool forceUpstream = false,
  }) async {
    if (!force && !forceUpstream && isFresh) {
      final current = state.asData?.value;
      if (current != null) return current;
    }
    if (!forceUpstream && _inFlight != null) return _inFlight!;

    try {
      return await _runFetch(forceUpstream: forceUpstream);
    } catch (e, st) {
      if (!state.hasValue) state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<LiveBoardSnapshot> _runFetch({bool forceUpstream = false}) async {
    final epoch = ++_fetchEpoch;
    final future = _fetch(forceUpstream: forceUpstream);
    _inFlight = future;
    try {
      final data = await future;
      if (epoch != _fetchEpoch) {
        return state.asData?.value ?? data;
      }
      state = AsyncData(data);
      return data;
    } finally {
      if (identical(_inFlight, future)) _inFlight = null;
    }
  }

  Future<LiveBoardSnapshot> _fetch({bool forceUpstream = false}) async {
    final repo = ref.read(footballRepositoryProvider);
    final items = await repo.liveFeed(
      forceRefresh: true,
      forceUpstream: forceUpstream,
    );

    final merged = mergeLiveMatchesMonotonic(
      previous: state.asData?.value.matches,
      incoming: items,
      replace: forceUpstream,
    );

    _fetchedAt = DateTime.now();
    _generation++;
    return LiveBoardSnapshot(
      matches: merged,
      fetchedAt: _fetchedAt!,
      generation: _generation,
    );
  }
}

final liveMatchesProvider =
    AsyncNotifierProvider<LiveMatchesNotifier, LiveBoardSnapshot>(
  LiveMatchesNotifier.new,
);

final liveMatchByIdProvider = Provider.family<MatchCardVm?, String>((ref, id) {
  return ref.watch(liveMatchesProvider).asData?.value.byId(id);
});

/// Day calendar — source of truth for Finished / Upcoming.
class DayMatchesNotifier extends AsyncNotifier<List<LeagueGroupVm>> {
  DayMatchesNotifier(this.ymd);
  final String ymd;

  Future<List<LeagueGroupVm>>? _inFlight;
  Timer? _pollTimer;

  bool get _isRacing {
    final key = ymd.isEmpty ? todayCalendarDateKey() : ymd;
    return key.compareTo(todayCalendarDateKey()) >= 0;
  }

  @override
  Future<List<LeagueGroupVm>> build() {
    ref.onDispose(() {
      _pollTimer?.cancel();
      _pollTimer = null;
      _inFlight = null;
    });
    if (_isRacing) {
      _pollTimer = Timer.periodic(todayCalendarKeepAlive, (_) {
        unawaited(refresh(force: true));
      });
    }
    return _runFetch(force: _isRacing);
  }

  Future<List<LeagueGroupVm>> refresh({
    bool force = false,
    bool forceUpstream = false,
  }) async {
    if (!forceUpstream && _inFlight != null) return _inFlight!;
    try {
      final data = await _runFetch(
        force: force || _isRacing || forceUpstream,
        forceUpstream: forceUpstream,
      );
      state = AsyncData(data);
      return data;
    } catch (e, st) {
      if (!state.hasValue) state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<List<LeagueGroupVm>> _runFetch({
    required bool force,
    bool forceUpstream = false,
  }) {
    final future = _fetch(force: force, forceUpstream: forceUpstream);
    _inFlight = future;
    return future.whenComplete(() {
      if (identical(_inFlight, future)) _inFlight = null;
    });
  }

  Future<List<LeagueGroupVm>> _fetch({
    required bool force,
    bool forceUpstream = false,
  }) async {
    final key = ymd.isEmpty ? todayCalendarDateKey() : ymd;
    final day = DateTime.parse(key);
    final repo = ref.read(footballRepositoryProvider);
    return repo.homeFeed(
      day: day,
      liveOnly: false,
      forceRefresh: force || forceUpstream,
      forceUpstream: forceUpstream,
    );
  }
}

final matchesProvider = AsyncNotifierProvider.family<DayMatchesNotifier,
    List<LeagueGroupVm>, String>(
  DayMatchesNotifier.new,
);

MatchCardVm _overlayLiveOntoCard(MatchCardVm card, MatchCardVm live) {
  if (card.match.isFinished) return card;
  if (!live.match.isLive) return card;

  final prevMin = card.match.minute;
  final liveMin = live.match.minute;
  final minute =
      (prevMin != null && (liveMin == null || prevMin > liveMin))
          ? prevMin
          : liveMin;

  int maxScore(int a, int b) => a > b ? a : b;
  MatchScore? score;
  if (card.match.score != null || live.match.score != null) {
    score = MatchScore(
      home: maxScore(card.match.score?.home ?? 0, live.match.score?.home ?? 0),
      away: maxScore(card.match.score?.away ?? 0, live.match.score?.away ?? 0),
    );
  }

  return MatchCardVm(
    match: card.match.copyWith(
      phase: live.match.phase,
      status: live.match.status,
      minute: minute ?? live.match.minute,
      score: score ?? live.match.score,
    ),
    home: card.home,
    away: card.away,
    competition: card.competition,
  );
}

List<LeagueGroupVm> overlayLiveOntoDayMatches(
  List<LeagueGroupVm> day,
  LiveBoardSnapshot? live,
) {
  if (live == null || live.matches.isEmpty) return day;
  final byId = {for (final m in live.matches) m.match.id: m};
  return [
    for (final g in day)
      LeagueGroupVm(
        competition: g.competition,
        matches: [
          for (final c in g.matches)
            byId[c.match.id] != null
                ? _overlayLiveOntoCard(c, byId[c.match.id]!)
                : c,
        ],
      ),
  ];
}

/// Day list with live-board scores/minutes overlaid (Finished / Upcoming).
final dayMatchesViewProvider =
    Provider.family<AsyncValue<List<LeagueGroupVm>>, String>((ref, date) {
  final day = ref.watch(matchesProvider(date));
  final live = ref.watch(liveMatchesProvider).asData?.value;
  return day.whenData((data) => overlayLiveOntoDayMatches(data, live));
});

List<LeagueGroupVm> filterGroupsByPhase(
  List<LeagueGroupVm> groups, {
  required bool Function(Match m) predicate,
}) {
  final out = <LeagueGroupVm>[];
  for (final g in groups) {
    final matches = g.matches.where((c) => predicate(c.match)).toList();
    if (matches.isEmpty) continue;
    out.add(LeagueGroupVm(competition: g.competition, matches: matches));
  }
  return out;
}

/// Apply live board onto a hydrated match detail card (in-play only).
MatchCardVm applyLiveBoardToCard(MatchCardVm card, MatchCardVm? live) {
  if (live == null) return card;
  if (card.match.isFinished) return card;
  if (!live.match.isLive) return card;
  return _overlayLiveOntoCard(card, live);
}
