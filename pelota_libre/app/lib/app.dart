import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'data/providers.dart';
import 'features/home/home_screen.dart';
import 'features/leagues/leagues_screen.dart';
import 'features/match/match_detail_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/search/search_screen.dart';
import 'features/settings/language_provider.dart';
import 'features/settings/language_selection_dialog.dart';
import 'features/splash/splash_gate.dart';
import 'features/teams/teams_screen.dart';
import 'l10n/app_localizations.dart';
import 'widgets/chrome.dart';

/// Bottom-nav shell: Matches · Leagues · Search · Settings.
class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen> {
  int _currentIndex = 0;
  final Set<int> _visitedTabs = {0};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final locale = ref.read(languageProvider);
      if (locale == null && mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => const LanguageSelectionDialog(isDismissible: false),
        );
      }
    });
  }

  Widget _screenForIndex(int index) {
    switch (index) {
      case 0:
        return const HomeScreen();
      case 1:
        return const LeaguesScreen();
      case 2:
        return const SearchScreen(embeddedInShell: true);
      case 3:
        return const ProfileScreen();
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: List.generate(4, (index) {
            if (!_visitedTabs.contains(index)) {
              return const SizedBox.shrink();
            }
            return Offstage(
              offstage: _currentIndex != index,
              child: _screenForIndex(index),
            );
          }),
        ),
      ),
      bottomNavigationBar: PlBottomNav(
        index: _currentIndex,
        labels: [
          l10n.matchesTab,
          l10n.leaguesTab,
          l10n.searchTab,
          l10n.settingsTab,
        ],
        onChanged: (i) {
          setState(() {
            _visitedTabs.add(i);
            _currentIndex = i;
          });
        },
      ),
    );
  }
}

final goRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const MainScreen()),
      GoRoute(
        path: '/match/:id',
        builder: (_, state) =>
            MatchDetailScreen(matchId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/league/:id',
        builder: (_, state) => LeagueDetailScreen(
          leagueInternalId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/team/:id',
        builder: (_, state) => TeamDetailScreen(
          teamInternalId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
      GoRoute(path: '/settings', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/teams', builder: (_, _) => const TeamsScreen()),
    ],
  );
});

class PelotaLibreApp extends ConsumerWidget {
  const PelotaLibreApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(themeModePrefProvider);
    final locale = ref.watch(languageProvider);
    final router = ref.watch(goRouterProvider);
    return MaterialApp.router(
      title: 'Pelota Libre+',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      locale: locale ?? const Locale('es'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
      builder: (context, child) => SplashGate(child: child ?? const SizedBox()),
    );
  }
}
