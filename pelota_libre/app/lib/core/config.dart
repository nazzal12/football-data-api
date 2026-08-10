/// Football API + app defaults.
abstract final class AppConfig {
  static const baseUrl = 'https://football-api.nazzalkausar12.workers.dev';

  /// Football season year (Aug–May style): Jul+ → current calendar year.
  static int get defaultSeasonYear {
    final now = DateTime.now();
    return now.month >= 7 ? now.year : now.year - 1;
  }

  /// API-Football league ids we care about (cuts worldwide date noise).
  /// See https://www.api-football.com — How to find IDs / docs/API.md.
  static const featuredLeagueExternalIds = <String>[
    '39', // Premier League
    '140', // La Liga
    '135', // Serie A
    '78', // Bundesliga
    '61', // Ligue 1
    '2', // UEFA Champions League
    '3', // UEFA Europa League
    '848', // Conference League
    '88', // Eredivisie
    '94', // Primeira Liga
    '144', // Belgian Pro League
    '203', // Super Lig
    '71', // Brazil Serie A
    '128', // Argentina Liga Profesional
    '253', // MLS
    '307', // Saudi Pro League
    '262', // Liga MX
    '13', // Copa Libertadores
    '11', // Copa Sudamericana
  ];

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
