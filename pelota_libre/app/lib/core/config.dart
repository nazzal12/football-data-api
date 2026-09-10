/// Football API + app defaults.
abstract final class AppConfig {
  static const baseUrl = 'https://football-api.nazzalkausar12.workers.dev';

  /// Football season year (Aug–May style): Jul+ → current calendar year.
  static int get defaultSeasonYear {
    final now = DateTime.now();
    return now.month >= 7 ? now.year : now.year - 1;
  }

  /// API-Football league ids ordered by display popularity (most popular first).
  /// See https://www.api-football.com — How to find IDs / docs/API.md.
  static const featuredLeagueExternalIds = <String>[
    '39', // Premier League
    '2', // UEFA Champions League
    '140', // La Liga
    '135', // Serie A
    '78', // Bundesliga
    '61', // Ligue 1
    '3', // UEFA Europa League
    '848', // Conference League
    '128', // Argentina Liga Profesional
    '13', // Copa Libertadores
    '71', // Brazil Serie A
    '11', // Copa Sudamericana
    '88', // Eredivisie
    '94', // Primeira Liga
    '144', // Belgian Pro League
    '203', // Super Lig
    '253', // MLS
    '307', // Saudi Pro League
    '262', // Liga MX
  ];

  /// Lower = higher on Matches / Live boards. Unknown leagues sort after featured.
  static int leaguePopularityRank({
    String? externalId,
    String? name,
  }) {
    final n = (name ?? '').toLowerCase();
    if (n.contains('friendly') ||
        n.contains('friendlies') ||
        n.contains('amistoso') ||
        n.contains('amistosos')) {
      return featuredLeagueExternalIds.length + 500;
    }
    if (externalId != null && externalId.isNotEmpty) {
      final i = featuredLeagueExternalIds.indexOf(externalId);
      if (i >= 0) return i;
    }
    // Name fallbacks when external id is missing on a card.
    const nameHints = <(String, int)>[
      ('premier league', 0),
      ('uefa champions', 1),
      ('champions league', 1),
      ('la liga', 2),
      ('serie a', 3),
      ('bundesliga', 4),
      ('ligue 1', 5),
      ('europa league', 6),
      ('conference league', 7),
      ('liga profesional', 8),
      ('libertadores', 9),
      ('brasileir', 10),
      ('brazil', 10),
      ('sudamericana', 11),
      ('eredivisie', 12),
      ('primeira liga', 13),
      ('pro league', 14),
      ('süper lig', 15),
      ('super lig', 15),
      ('major league soccer', 16),
      ('mls', 16),
      ('saudi', 17),
      ('liga mx', 18),
    ];
    for (final hint in nameHints) {
      if (n.contains(hint.$1)) return hint.$2;
    }
    return featuredLeagueExternalIds.length + 50;
  }

  static int compareLeaguesByPopularity({
    String? aExternalId,
    String? aName,
    String? bExternalId,
    String? bName,
  }) {
    final ar = leaguePopularityRank(externalId: aExternalId, name: aName);
    final br = leaguePopularityRank(externalId: bExternalId, name: bName);
    if (ar != br) return ar.compareTo(br);
    return (aName ?? '').compareTo(bName ?? '');
  }

  /// How many match cards to hydrate when projection `items` are missing
  /// (legacy fallback only — projection items are shown without cutoff).
  static const homeMatchLimit = 5000;
  static const liveMatchLimit = 5000;
  /// Keep low — high concurrency caused connection resets + provider 502 storms.
  static const hydrateConcurrency = 4;
  static const hydrateGapMs = 80;
  /// Scan at most this many projection ids while hunting featured matches (legacy fallback).
  static const projectionScanLimit = 5000;

  /// CDN fallback when Team.logoUrl is missing (API-Sports media).
  static String teamLogoFallback(String externalTeamId) =>
      'https://media.api-sports.io/football/teams/$externalTeamId.png';

  static String leagueLogoFallback(String externalLeagueId) =>
      'https://media.api-sports.io/football/leagues/$externalLeagueId.png';
}
