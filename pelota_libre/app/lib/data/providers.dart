import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/cache/response_cache.dart';
import '../core/config.dart';
import 'api_client.dart';
import 'repository.dart';

final sharedPrefsProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Override in main');
});

final responseCacheProvider = Provider<ResponseCache>((ref) {
  throw UnimplementedError('Override in main');
});

final footballApiProvider = Provider<FootballApi>((ref) {
  final cache = ref.watch(responseCacheProvider);
  return FootballApi(FootballApiClient(cache: cache));
});

final footballRepositoryProvider = Provider<FootballRepository>((ref) {
  return FootballRepository(ref.watch(footballApiProvider));
});

final themeModePrefProvider =
    NotifierProvider<ThemeModePref, bool>(ThemeModePref.new);

/// true = dark, false = light (default).
class ThemeModePref extends Notifier<bool> {
  static const key = 'dark_mode';

  @override
  bool build() {
    final prefs = ref.watch(sharedPrefsProvider);
    return prefs.getBool(key) ?? false;
  }

  Future<void> setDark(bool dark) async {
    state = dark;
    await ref.read(sharedPrefsProvider).setBool(key, dark);
  }

  Future<void> toggle() => setDark(!state);
}

final seasonYearProvider =
    NotifierProvider<SeasonYearPref, int>(SeasonYearPref.new);

class SeasonYearPref extends Notifier<int> {
  static const key = 'season_year';

  @override
  int build() {
    final prefs = ref.watch(sharedPrefsProvider);
    final current = AppConfig.defaultSeasonYear;
    final stored = prefs.getInt(key);
    if (stored == null || stored < current - 1) return current;
    return stored;
  }

  Future<void> setYear(int year) async {
    state = year;
    await ref.read(sharedPrefsProvider).setInt(key, year);
  }
}

Future<void> bootstrapHive() async {
  await Hive.initFlutter();
}
