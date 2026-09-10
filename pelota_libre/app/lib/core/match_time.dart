import 'package:intl/intl.dart';

/// Kickoff / match clock helpers.
///
/// API stores kickoffs as UTC ISO; we always display in the device local zone.
abstract final class MatchTimeFormat {
  /// Local 12-hour time, e.g. `3:45 PM` (never 24h `Hm`).
  static String localKickoff(DateTime utcOrLocal) {
    final local = utcOrLocal.toLocal();
    return DateFormat.jm().format(local);
  }

  /// Short weekday + local 12h time for list contexts.
  static String localWeekdayKickoff(DateTime utcOrLocal) {
    final local = utcOrLocal.toLocal();
    return DateFormat('EEE ').format(local) + DateFormat.jm().format(local);
  }

  /// Calendar day label in local zone.
  static String localDayLabel(DateTime utcOrLocal) {
    return DateFormat('d MMM yyyy').format(utcOrLocal.toLocal());
  }
}
