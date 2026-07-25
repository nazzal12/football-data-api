class ApiException implements Exception {
  ApiException({
    required this.status,
    required this.message,
    this.code,
    this.details,
  });

  final int status;
  final String message;
  final String? code;
  final Object? details;

  bool get isRateLimited =>
      status == 502 &&
      (details?.toString().contains('rateLimit') == true ||
          message.toLowerCase().contains('rate'));

  @override
  String toString() => 'ApiException($status, $code): $message';
}

class MatchScore {
  MatchScore({required this.home, required this.away});
  final int home;
  final int away;

  factory MatchScore.fromJson(Map<String, dynamic> j) => MatchScore(
        home: j['home'] as int,
        away: j['away'] as int,
      );
}

class LineupPlayer {
  LineupPlayer({
    required this.playerId,
    required this.isStarter,
    this.playerName,
    this.photoUrl,
    this.shirtNumber,
    this.position,
  });

  final String playerId;
  final bool isStarter;
  final String? playerName;
  final String? photoUrl;
  final int? shirtNumber;
  final String? position;

  factory LineupPlayer.fromJson(Map<String, dynamic> j) => LineupPlayer(
        playerId: j['playerId'] as String,
        isStarter: j['isStarter'] as bool? ?? false,
        playerName: j['playerName'] as String?,
        photoUrl: j['photoUrl'] as String?,
        shirtNumber: j['shirtNumber'] as int?,
        position: j['position'] as String?,
      );
}

class MatchLineup {
  MatchLineup({required this.teamId, required this.players});
  final String teamId;
  final List<LineupPlayer> players;

  factory MatchLineup.fromJson(Map<String, dynamic> j) => MatchLineup(
        teamId: j['teamId'] as String,
        players: (j['players'] as List<dynamic>?)
                ?.map((e) => LineupPlayer.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class Match {
  Match({
    required this.id,
    required this.seasonId,
    required this.competitionId,
    required this.phase,
    required this.status,
    required this.kickoffAt,
    required this.homeTeamId,
    required this.awayTeamId,
    this.venueId,
    this.score,
    this.minute,
    this.events = const [],
    this.lineups = const [],
  });

  final String id;
  final String seasonId;
  final String competitionId;
  final String phase;
  final String status;
  final DateTime kickoffAt;
  final String homeTeamId;
  final String awayTeamId;
  final String? venueId;
  final MatchScore? score;
  final int? minute;
  final List<MatchEvent> events;
  final List<MatchLineup> lineups;

  bool get isLive => phase == 'live';
  bool get isFinished => phase == 'finished' || phase == 'historical';
  bool get isUpcoming => phase == 'future';

  factory Match.fromJson(Map<String, dynamic> j) => Match(
        id: j['id'] as String,
        seasonId: j['seasonId'] as String,
        competitionId: j['competitionId'] as String,
        phase: j['phase'] as String,
        status: j['status'] as String,
        kickoffAt: DateTime.parse(j['kickoffAt'] as String).toUtc(),
        homeTeamId: j['homeTeamId'] as String,
        awayTeamId: j['awayTeamId'] as String,
        venueId: j['venueId'] as String?,
        score: j['score'] != null
            ? MatchScore.fromJson(j['score'] as Map<String, dynamic>)
            : null,
        minute: j['minute'] as int?,
        events: (j['events'] as List<dynamic>?)
                ?.map((e) => MatchEvent.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        lineups: (j['lineups'] as List<dynamic>?)
                ?.map((e) => MatchLineup.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class Team {
  Team({
    required this.id,
    required this.name,
    this.shortName,
    this.countryId,
    this.venueId,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String? shortName;
  final String? countryId;
  final String? venueId;
  final String? logoUrl;

  String get code {
    final s = shortName ?? name;
    final letters = s.replaceAll(RegExp(r'[^A-Za-z]'), '');
    if (letters.length >= 3) return letters.substring(0, 3).toUpperCase();
    return s.toUpperCase().padRight(3).substring(0, 3);
  }

  factory Team.fromJson(Map<String, dynamic> j) => Team(
        id: j['id'] as String,
        name: j['name'] as String,
        shortName: j['shortName'] as String?,
        countryId: j['countryId'] as String?,
        venueId: j['venueId'] as String?,
        logoUrl: j['logoUrl'] as String?,
      );
}

class Competition {
  Competition({
    required this.id,
    required this.name,
    required this.format,
    required this.isLeague,
    this.countryId,
    this.logoUrl,
  });

  final String id;
  final String name;
  final String format;
  final bool isLeague;
  final String? countryId;
  final String? logoUrl;

  factory Competition.fromJson(Map<String, dynamic> j) => Competition(
        id: j['id'] as String,
        name: j['name'] as String,
        format: j['format'] as String,
        isLeague: j['isLeague'] as bool,
        countryId: j['countryId'] as String?,
        logoUrl: j['logoUrl'] as String?,
      );
}

class Season {
  Season({
    required this.id,
    required this.competitionId,
    required this.label,
  });

  final String id;
  final String competitionId;
  final String label;

  factory Season.fromJson(Map<String, dynamic> j) => Season(
        id: j['id'] as String,
        competitionId: j['competitionId'] as String,
        label: j['label'] as String,
      );
}

class StandingRow {
  StandingRow({
    required this.rank,
    required this.teamId,
    required this.played,
    required this.won,
    required this.drawn,
    required this.lost,
    required this.goalsFor,
    required this.goalsAgainst,
    required this.goalDifference,
    required this.points,
    this.form,
  });

  final int rank;
  final String teamId;
  final int played;
  final int won;
  final int drawn;
  final int lost;
  final int goalsFor;
  final int goalsAgainst;
  final int goalDifference;
  final int points;
  final String? form;

  factory StandingRow.fromJson(Map<String, dynamic> j) => StandingRow(
        rank: j['rank'] as int,
        teamId: j['teamId'] as String,
        played: j['played'] as int,
        won: j['won'] as int,
        drawn: j['drawn'] as int,
        lost: j['lost'] as int,
        goalsFor: j['goalsFor'] as int,
        goalsAgainst: j['goalsAgainst'] as int,
        goalDifference: j['goalDifference'] as int,
        points: j['points'] as int,
        form: j['form'] as String?,
      );
}

class Standings {
  Standings({
    required this.id,
    required this.seasonId,
    required this.rows,
    this.stage,
    this.group,
  });

  final String id;
  final String seasonId;
  final String? stage;
  final String? group;
  final List<StandingRow> rows;

  factory Standings.fromJson(Map<String, dynamic> j) => Standings(
        id: j['id'] as String,
        seasonId: j['seasonId'] as String,
        stage: j['stage'] as String?,
        group: j['group'] as String?,
        rows: (j['rows'] as List<dynamic>)
            .map((e) => StandingRow.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class MatchListItem {
  MatchListItem({
    required this.matchId,
    required this.competitionId,
    required this.homeTeamId,
    required this.awayTeamId,
    required this.kickoffAt,
    required this.phase,
    required this.status,
    required this.homeName,
    required this.awayName,
    this.score,
    this.minute,
    this.homeLogoUrl,
    this.awayLogoUrl,
    this.competitionName,
    this.competitionLogoUrl,
  });

  final String matchId;
  final String competitionId;
  final String homeTeamId;
  final String awayTeamId;
  final DateTime kickoffAt;
  final String phase;
  final String status;
  final MatchScore? score;
  final int? minute;
  final String homeName;
  final String awayName;
  final String? homeLogoUrl;
  final String? awayLogoUrl;
  final String? competitionName;
  final String? competitionLogoUrl;

  factory MatchListItem.fromJson(Map<String, dynamic> j) => MatchListItem(
        matchId: j['matchId'] as String,
        competitionId: j['competitionId'] as String,
        homeTeamId: j['homeTeamId'] as String,
        awayTeamId: j['awayTeamId'] as String,
        kickoffAt: DateTime.parse(j['kickoffAt'] as String).toUtc(),
        phase: j['phase'] as String,
        status: j['status'] as String,
        score: j['score'] != null
            ? MatchScore.fromJson(j['score'] as Map<String, dynamic>)
            : null,
        minute: j['minute'] as int?,
        homeName: j['homeName'] as String,
        awayName: j['awayName'] as String,
        homeLogoUrl: j['homeLogoUrl'] as String?,
        awayLogoUrl: j['awayLogoUrl'] as String?,
        competitionName: j['competitionName'] as String?,
        competitionLogoUrl: j['competitionLogoUrl'] as String?,
      );

  Match toMatch() => Match(
        id: matchId,
        seasonId: '',
        competitionId: competitionId,
        phase: phase,
        status: status,
        kickoffAt: kickoffAt,
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId,
        score: score,
        minute: minute,
      );
}

class MatchListProjection {
  MatchListProjection({
    required this.id,
    required this.key,
    required this.matchIds,
    this.items = const [],
  });

  final String id;
  final String key;
  final List<String> matchIds;
  final List<MatchListItem> items;

  factory MatchListProjection.fromJson(Map<String, dynamic> j) =>
      MatchListProjection(
        id: j['id'] as String,
        key: j['key'] as String,
        matchIds: (j['matchIds'] as List<dynamic>).cast<String>(),
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => MatchListItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class MatchEvent {
  MatchEvent({
    required this.sequence,
    required this.type,
    this.minute,
    this.extraMinute,
    this.teamId,
    this.teamName,
    this.playerId,
    this.playerName,
    this.assistPlayerId,
    this.assistPlayerName,
    this.detail,
  });

  final int sequence;
  final String type;
  final int? minute;
  final int? extraMinute;
  final String? teamId;
  final String? teamName;
  final String? playerId;
  final String? playerName;
  final String? assistPlayerId;
  final String? assistPlayerName;
  final String? detail;

  factory MatchEvent.fromJson(Map<String, dynamic> j) => MatchEvent(
        sequence: j['sequence'] as int,
        type: j['type'] as String,
        minute: j['minute'] as int?,
        extraMinute: j['extraMinute'] as int?,
        teamId: j['teamId'] as String?,
        teamName: j['teamName'] as String?,
        playerId: j['playerId'] as String?,
        playerName: j['playerName'] as String?,
        assistPlayerId: j['assistPlayerId'] as String?,
        assistPlayerName: j['assistPlayerName'] as String?,
        detail: j['detail'] as String?,
      );
}

class MatchStatistics {
  MatchStatistics({
    required this.id,
    required this.matchId,
    required this.teams,
  });

  final String id;
  final String matchId;
  final List<({String teamId, Map<String, dynamic> metrics})> teams;

  factory MatchStatistics.fromJson(Map<String, dynamic> j) => MatchStatistics(
        id: j['id'] as String,
        matchId: j['matchId'] as String,
        teams: (j['teams'] as List<dynamic>).map((e) {
          final m = e as Map<String, dynamic>;
          return (
            teamId: m['teamId'] as String,
            metrics: Map<String, dynamic>.from(m['metrics'] as Map),
          );
        }).toList(),
      );
}

class MatchPrediction {
  MatchPrediction({
    required this.id,
    required this.matchId,
    this.advice,
    this.percentHome,
    this.percentDraw,
    this.percentAway,
    this.winnerTeamId,
  });

  final String id;
  final String matchId;
  final String? advice;
  final double? percentHome;
  final double? percentDraw;
  final double? percentAway;
  final String? winnerTeamId;

  factory MatchPrediction.fromJson(Map<String, dynamic> j) => MatchPrediction(
        id: j['id'] as String,
        matchId: j['matchId'] as String,
        advice: j['advice'] as String?,
        percentHome: (j['percentHome'] as num?)?.toDouble(),
        percentDraw: (j['percentDraw'] as num?)?.toDouble(),
        percentAway: (j['percentAway'] as num?)?.toDouble(),
        winnerTeamId: j['winnerTeamId'] as String?,
      );
}

class HeadToHead {
  HeadToHead({
    required this.id,
    required this.teamAId,
    required this.teamBId,
    required this.matchIds,
  });

  final String id;
  final String teamAId;
  final String teamBId;
  final List<String> matchIds;

  factory HeadToHead.fromJson(Map<String, dynamic> j) => HeadToHead(
        id: j['id'] as String,
        teamAId: j['teamAId'] as String,
        teamBId: j['teamBId'] as String,
        matchIds: (j['matchIds'] as List<dynamic>).cast<String>(),
      );
}

class SquadMember {
  SquadMember({
    required this.playerId,
    this.playerName,
    this.photoUrl,
    this.shirtNumber,
    this.position,
  });
  final String playerId;
  final String? playerName;
  final String? photoUrl;
  final int? shirtNumber;
  final String? position;

  factory SquadMember.fromJson(Map<String, dynamic> j) => SquadMember(
        playerId: j['playerId'] as String,
        playerName: j['playerName'] as String?,
        photoUrl: j['photoUrl'] as String?,
        shirtNumber: j['shirtNumber'] as int?,
        position: j['position'] as String?,
      );
}

class Squad {
  Squad({
    required this.id,
    required this.seasonId,
    required this.teamId,
    required this.members,
  });

  final String id;
  final String seasonId;
  final String teamId;
  final List<SquadMember> members;

  factory Squad.fromJson(Map<String, dynamic> j) => Squad(
        id: j['id'] as String,
        seasonId: j['seasonId'] as String,
        teamId: j['teamId'] as String,
        members: (j['members'] as List<dynamic>)
            .map((e) => SquadMember.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class Player {
  Player({
    required this.id,
    required this.name,
    this.position,
    this.nationality,
    this.photoUrl,
  });

  final String id;
  final String name;
  final String? position;
  final String? nationality;
  final String? photoUrl;

  factory Player.fromJson(Map<String, dynamic> j) => Player(
        id: j['id'] as String,
        name: j['name'] as String,
        position: j['position'] as String?,
        nationality: j['nationality'] as String?,
        photoUrl: j['photoUrl'] as String?,
      );
}

class Coach {
  Coach({
    required this.id,
    required this.name,
    this.nationality,
    this.teamId,
    this.photoUrl,
  });
  final String id;
  final String name;
  final String? nationality;
  final String? teamId;
  final String? photoUrl;

  factory Coach.fromJson(Map<String, dynamic> j) => Coach(
        id: j['id'] as String,
        name: j['name'] as String,
        nationality: j['nationality'] as String?,
        teamId: j['teamId'] as String?,
        photoUrl: j['photoUrl'] as String?,
      );
}

class Venue {
  Venue({required this.id, required this.name, this.city, this.capacity});
  final String id;
  final String name;
  final String? city;
  final int? capacity;

  factory Venue.fromJson(Map<String, dynamic> j) => Venue(
        id: j['id'] as String,
        name: j['name'] as String,
        city: j['city'] as String?,
        capacity: j['capacity'] as int?,
      );
}

class Country {
  Country({required this.id, required this.name, this.code});
  final String id;
  final String name;
  final String? code;

  factory Country.fromJson(Map<String, dynamic> j) => Country(
        id: j['id'] as String,
        name: j['name'] as String,
        code: j['code'] as String?,
      );
}

class TeamSeasonStatistics {
  TeamSeasonStatistics({
    required this.id,
    required this.teamId,
    required this.seasonId,
    this.form,
    this.fixturesPlayed,
    this.wins,
    this.draws,
    this.losses,
    this.goalsFor,
    this.goalsAgainst,
    required this.metrics,
  });

  final String id;
  final String teamId;
  final String seasonId;
  final String? form;
  final int? fixturesPlayed;
  final int? wins;
  final int? draws;
  final int? losses;
  final int? goalsFor;
  final int? goalsAgainst;
  final Map<String, dynamic> metrics;

  factory TeamSeasonStatistics.fromJson(Map<String, dynamic> j) =>
      TeamSeasonStatistics(
        id: j['id'] as String,
        teamId: j['teamId'] as String,
        seasonId: j['seasonId'] as String,
        form: j['form'] as String?,
        fixturesPlayed: j['fixturesPlayed'] as int?,
        wins: j['wins'] as int?,
        draws: j['draws'] as int?,
        losses: j['losses'] as int?,
        goalsFor: j['goalsFor'] as int?,
        goalsAgainst: j['goalsAgainst'] as int?,
        metrics: Map<String, dynamic>.from(j['metrics'] as Map? ?? {}),
      );
}

class SeasonLeaderRow {
  SeasonLeaderRow({
    required this.rank,
    required this.playerId,
    required this.teamId,
    required this.value,
    this.playerName,
    this.playerPhotoUrl,
    this.teamName,
  });

  final int rank;
  final String playerId;
  final String teamId;
  final num value;
  final String? playerName;
  final String? playerPhotoUrl;
  final String? teamName;

  factory SeasonLeaderRow.fromJson(Map<String, dynamic> j) => SeasonLeaderRow(
        rank: j['rank'] as int,
        playerId: j['playerId'] as String,
        teamId: j['teamId'] as String,
        value: j['value'] as num,
        playerName: j['playerName'] as String?,
        playerPhotoUrl: j['playerPhotoUrl'] as String?,
        teamName: j['teamName'] as String?,
      );
}

class SeasonLeaders {
  SeasonLeaders({
    required this.id,
    required this.seasonId,
    required this.kind,
    required this.rows,
  });

  final String id;
  final String seasonId;
  final String kind;
  final List<SeasonLeaderRow> rows;

  factory SeasonLeaders.fromJson(Map<String, dynamic> j) => SeasonLeaders(
        id: j['id'] as String,
        seasonId: j['seasonId'] as String,
        kind: j['kind'] as String,
        rows: (j['rows'] as List<dynamic>)
            .map((e) => SeasonLeaderRow.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class InjuryEntry {
  InjuryEntry({
    required this.playerId,
    required this.teamId,
    this.type,
    this.reason,
    this.startDate,
    this.playerName,
  });

  final String playerId;
  final String teamId;
  final String? type;
  final String? reason;
  final String? startDate;
  final String? playerName;

  factory InjuryEntry.fromJson(Map<String, dynamic> j) => InjuryEntry(
        playerId: j['playerId'] as String,
        teamId: j['teamId'] as String,
        type: j['type'] as String?,
        reason: j['reason'] as String?,
        startDate: j['startDate'] as String?,
        playerName: j['playerName'] as String?,
      );
}

class InjuryReport {
  InjuryReport({
    required this.id,
    required this.injuries,
    this.matchId,
    this.teamId,
  });

  final String id;
  final String? matchId;
  final String? teamId;
  final List<InjuryEntry> injuries;

  factory InjuryReport.fromJson(Map<String, dynamic> j) => InjuryReport(
        id: j['id'] as String,
        matchId: j['matchId'] as String?,
        teamId: j['teamId'] as String?,
        injuries: (j['injuries'] as List<dynamic>?)
                ?.map((e) => InjuryEntry.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class TransferEntry {
  TransferEntry({
    required this.playerId,
    this.date,
    this.type,
    this.fromTeamId,
    this.toTeamId,
    this.playerName,
  });

  final String playerId;
  final String? date;
  final String? type;
  final String? fromTeamId;
  final String? toTeamId;
  final String? playerName;

  factory TransferEntry.fromJson(Map<String, dynamic> j) => TransferEntry(
        playerId: j['playerId'] as String,
        date: j['date'] as String?,
        type: j['type'] as String?,
        fromTeamId: j['fromTeamId'] as String?,
        toTeamId: j['toTeamId'] as String?,
        playerName: j['playerName'] as String?,
      );
}

class TransferReport {
  TransferReport({
    required this.id,
    required this.transfers,
    this.teamId,
  });

  final String id;
  final String? teamId;
  final List<TransferEntry> transfers;

  factory TransferReport.fromJson(Map<String, dynamic> j) => TransferReport(
        id: j['id'] as String,
        teamId: j['teamId'] as String?,
        transfers: (j['transfers'] as List<dynamic>?)
                ?.map((e) => TransferEntry.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}
