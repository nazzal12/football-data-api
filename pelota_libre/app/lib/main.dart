import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/cache/response_cache.dart';
import 'data/feed_providers.dart';
import 'data/providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  final prefs = await SharedPreferences.getInstance();
  final cache = await ResponseCache.open();

  runApp(
    ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        responseCacheProvider.overrideWithValue(cache),
      ],
      child: const PelotaLibreRoot(),
    ),
  );
}

/// Owns app-lifecycle so cold start / resume refresh feeds like Futbol Libre+.
class PelotaLibreRoot extends ConsumerStatefulWidget {
  const PelotaLibreRoot({super.key});

  @override
  ConsumerState<PelotaLibreRoot> createState() => _PelotaLibreRootState();
}

class _PelotaLibreRootState extends ConsumerState<PelotaLibreRoot>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(refreshFeedsOnAppOpen(ref));
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshFeedsOnAppOpen(ref));
    }
  }

  @override
  Widget build(BuildContext context) => const PelotaLibreApp();
}
