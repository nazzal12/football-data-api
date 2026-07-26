import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';

import '../core/cache/response_cache.dart';
import '../core/config.dart';
import 'models.dart';

typedef JsonMap = Map<String, dynamic>;

void _log(String msg) => developer.log(msg, name: 'FootballApi');

/// HTTP client with local SWR cache, 502/429 retries, and request dedupe.
class FootballApiClient {
  FootballApiClient({
    required ResponseCache cache,
    Dio? dio,
    String? baseUrl,
  })  : _cache = cache,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl ?? AppConfig.baseUrl,
                connectTimeout: const Duration(seconds: 12),
                receiveTimeout: const Duration(seconds: 35),
                headers: {'Accept': 'application/json'},
                // Treat problem JSON as data so we can parse 502 bodies.
                validateStatus: (s) => s != null && s < 600,
              ),
            );

  final Dio _dio;
  final ResponseCache _cache;
  final Map<String, Future<JsonMap>> _inflight = {};

  Future<JsonMap> getJson(
    String path, {
    bool forceRefresh = false,
    int fallbackMaxAge = 60,
  }) {
    final existing = _inflight[path];
    if (existing != null && !forceRefresh) return existing;

    final future = _getJsonImpl(
      path,
      forceRefresh: forceRefresh,
      fallbackMaxAge: fallbackMaxAge,
    );
    _inflight[path] = future;
    future.whenComplete(() {
      if (identical(_inflight[path], future)) {
        _inflight.remove(path);
      }
    });
    return future;
  }

  Future<JsonMap> _getJsonImpl(
    String path, {
    required bool forceRefresh,
    required int fallbackMaxAge,
  }) async {
    final cached = _cache.get(path);

    if (!forceRefresh && cached != null && cached.isFresh) {
      _log('CACHE HIT fresh $path');
      return jsonDecode(cached.body) as JsonMap;
    }

    if (!forceRefresh && cached != null && cached.isUsable) {
      _log('CACHE HIT stale $path (revalidate)');
      unawaited(() async {
        try {
          await _networkFetchWithRetry(path, fallbackMaxAge: fallbackMaxAge);
        } catch (e) {
          _log('BG revalidate fail $path: $e');
        }
      }());
      return jsonDecode(cached.body) as JsonMap;
    }

    try {
      return await _networkFetchWithRetry(path, fallbackMaxAge: fallbackMaxAge);
    } on ApiException catch (e) {
      if (cached != null && cached.isEmergencyUsable) {
        _log('NET FAIL $path → emergency cache (${e.message})');
        return jsonDecode(cached.body) as JsonMap;
      }
      rethrow;
    }
  }

  Future<JsonMap> _networkFetchWithRetry(
    String path, {
    required int fallbackMaxAge,
  }) async {
    ApiException? last;
    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        if (attempt > 0) {
          final wait = Duration(milliseconds: 800 * (1 << (attempt - 1)));
          _log('RETRY $path attempt=${attempt + 1} wait=${wait.inMilliseconds}ms');
          await Future<void>.delayed(wait);
        }
        return await _networkFetch(path, fallbackMaxAge: fallbackMaxAge);
      } on ApiException catch (e) {
        last = e;
        // DNS / offline (status 0) — do not burn retries.
        final dnsOrOffline = e.status == 0 ||
            e.message.toLowerCase().contains('host lookup') ||
            e.message.toLowerCase().contains('failed host');
        final connectionClosed = e.status == 0 &&
            e.message.toLowerCase().contains('connection');
        final retryable = (!dnsOrOffline || connectionClosed) &&
            (connectionClosed ||
                e.status == 429 ||
                e.status == 502 ||
                e.status == 503 ||
                e.isRateLimited);
        // Cap connection-closed retries to once.
        if (connectionClosed && attempt >= 1) rethrow;
        if (!retryable) rethrow;
      }
    }
    throw last ?? ApiException(status: 502, message: 'Request failed');
  }

  Future<JsonMap> _networkFetch(
    String path, {
    required int fallbackMaxAge,
  }) async {
    try {
      _log('GET $path');
      final res = await _dio.get<dynamic>(path);
      final status = res.statusCode ?? 0;
      final data = res.data;

      if (data is! Map) {
        throw ApiException(status: status, message: 'Invalid JSON');
      }
      final map = Map<String, dynamic>.from(data);

      // Problem details (API returns these on 4xx/5xx with validateStatus)
      if (map['code'] != null && map['status'] != null && map['title'] != null) {
        final code = map['code'] as String?;
        final detail =
            map['detail'] as String? ?? map['title'] as String? ?? 'Error';
        _log('ERR $path status=$status code=$code detail=$detail');
        throw ApiException(
          status: (map['status'] as num?)?.toInt() ?? status,
          message: detail,
          code: code,
          details: map['details'],
        );
      }

      if (status >= 400) {
        throw ApiException(status: status, message: 'HTTP $status');
      }

      final maxAge = parseMaxAge(
        res.headers.value('cache-control'),
        fallback: fallbackMaxAge,
      );
      await _cache.put(
        path,
        CacheEntry(
          body: jsonEncode(map),
          storedAtMs: DateTime.now().millisecondsSinceEpoch,
          maxAgeSeconds: maxAge,
          etag: res.headers.value('etag'),
        ),
      );
      _log('OK $path');
      return map;
    } on DioException catch (e) {
      final status = e.response?.statusCode ?? 0;
      final data = e.response?.data;
      if (data is Map) {
        throw ApiException(
          status: status,
          message: data['detail'] as String? ?? e.message ?? 'Network error',
          code: data['code'] as String?,
          details: data['details'],
        );
      }
      throw ApiException(status: status, message: e.message ?? 'Network error');
    }
  }
}

class FootballApi {
  FootballApi(this.client);
  final FootballApiClient client;

  Future<MatchListProjection> matchesByDate(
    String ymd, {
    bool forceRefresh = false,
  }) async {
    final j = await client.getJson(
      '/v1/projections/matches/by-date/$ymd',
      forceRefresh: forceRefresh,
      fallbackMaxAge: 60,
    );
    return MatchListProjection.fromJson(j);
  }

  Future<MatchListProjection> matchesLive({bool forceRefresh = false}) async {
    final j = await client.getJson(
      '/v1/projections/matches/live',
      forceRefresh: forceRefresh,
      fallbackMaxAge: 5,
    );
    return MatchListProjection.fromJson(j);
  }

  Future<MatchListProjection> matchesByLeague(String leagueId, int year) async {
    final j = await client.getJson(
      '/v1/projections/matches/by-league/$leagueId/$year',
      fallbackMaxAge: 120,
    );
    return MatchListProjection.fromJson(j);
  }

  Future<MatchListProjection> matchesByTeam(String teamExtId, int year) async {
    final j = await client.getJson(
      '/v1/projections/matches/by-team/$teamExtId/$year',
      fallbackMaxAge: 120,
    );
    return MatchListProjection.fromJson(j);
  }

  Future<Match> match(String id, {bool forceRefresh = false}) async {
    final j = await client.getJson(
      '/v1/matches/$id',
      forceRefresh: forceRefresh,
      fallbackMaxAge: 5,
    );
    return Match.fromJson(j);
  }

  Future<Team> team(String id) async {
    final j = await client.getJson('/v1/teams/$id', fallbackMaxAge: 86400);
    return Team.fromJson(j);
  }

  Future<Team> teamByExternal(String externalId) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$externalId',
      fallbackMaxAge: 86400,
    );
    return Team.fromJson(j);
  }

  Future<Competition> competition(String id) async {
    final j =
        await client.getJson('/v1/competitions/$id', fallbackMaxAge: 86400);
    return Competition.fromJson(j);
  }

  Future<Competition> competitionByExternal(String externalId) async {
    final j = await client.getJson(
      '/v1/competitions/by-external/$externalId',
      fallbackMaxAge: 86400,
    );
    return Competition.fromJson(j);
  }

  Future<String?> externalIdFor(String internalId) async {
    try {
      final j = await client.getJson(
        '/v1/ids/$internalId',
        fallbackMaxAge: 86400,
      );
      return j['externalId'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<Standings> standingsByExternal(String leagueId, int year) async {
    final j = await client.getJson(
      '/v1/standings/by-external/$leagueId/$year',
      fallbackMaxAge: 300,
    );
    return Standings.fromJson(j);
  }

  Future<Squad> squad(String teamExt, String leagueId, int year) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$teamExt/squads/$leagueId/$year',
      fallbackMaxAge: 3600,
    );
    return Squad.fromJson(j);
  }

  Future<Coach> teamCoach(String teamExt) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$teamExt/coach',
      fallbackMaxAge: 3600,
    );
    return Coach.fromJson(j);
  }

  Future<TeamSeasonStatistics> teamStats(
    String teamExt,
    String leagueId,
    int year,
  ) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$teamExt/statistics/$leagueId/$year',
      fallbackMaxAge: 600,
    );
    return TeamSeasonStatistics.fromJson(j);
  }

  Future<Player> player(String id) async {
    final j = await client.getJson('/v1/players/$id', fallbackMaxAge: 86400);
    return Player.fromJson(j);
  }

  Future<Venue> venue(String id) async {
    final j = await client.getJson('/v1/venues/$id', fallbackMaxAge: 86400);
    return Venue.fromJson(j);
  }

  Future<List<MatchEvent>> matchEvents(
    String matchId, {
    bool forceRefresh = false,
  }) async {
    final j = await client.getJson(
      '/v1/matches/$matchId/events',
      forceRefresh: forceRefresh,
      fallbackMaxAge: 5,
    );
    return (j['events'] as List<dynamic>)
        .map((e) => MatchEvent.fromJson(e as JsonMap))
        .toList();
  }

  Future<MatchStatistics> matchStatistics(
    String matchId, {
    bool forceRefresh = false,
  }) async {
    final j = await client.getJson(
      '/v1/matches/$matchId/statistics',
      forceRefresh: forceRefresh,
      fallbackMaxAge: 15,
    );
    return MatchStatistics.fromJson(j);
  }

  Future<MatchPrediction> matchPrediction(String matchId) async {
    final j = await client.getJson(
      '/v1/matches/$matchId/predictions',
      fallbackMaxAge: 300,
    );
    return MatchPrediction.fromJson(j);
  }

  Future<List<MatchLineup>> matchLineups(String matchId) async {
    final j = await client.getJson(
      '/v1/matches/$matchId/lineups',
      fallbackMaxAge: 60,
    );
    return (j['lineups'] as List<dynamic>?)
            ?.map((e) => MatchLineup.fromJson(e as JsonMap))
            .toList() ??
        const [];
  }

  Future<InjuryReport> matchInjuries(String matchId) async {
    final j = await client.getJson(
      '/v1/matches/$matchId/injuries',
      fallbackMaxAge: 120,
    );
    return InjuryReport.fromJson(j);
  }

  Future<HeadToHead> h2hByExternal(String teamA, String teamB) async {
    final j = await client.getJson(
      '/v1/h2h/by-external/$teamA/$teamB',
      fallbackMaxAge: 300,
    );
    return HeadToHead.fromJson(j);
  }

  Future<TransferReport> teamTransfers(String teamExt) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$teamExt/transfers',
      fallbackMaxAge: 3600,
    );
    return TransferReport.fromJson(j);
  }

  Future<InjuryReport> teamInjuries(String teamExt, int year) async {
    final j = await client.getJson(
      '/v1/teams/by-external/$teamExt/injuries/$year',
      fallbackMaxAge: 600,
    );
    return InjuryReport.fromJson(j);
  }

  Future<SeasonLeaders> leaders(
    String leagueId,
    int year,
    String kind,
  ) async {
    final j = await client.getJson(
      '/v1/leaders/by-external/$leagueId/$year/$kind',
      fallbackMaxAge: 600,
    );
    return SeasonLeaders.fromJson(j);
  }
}
