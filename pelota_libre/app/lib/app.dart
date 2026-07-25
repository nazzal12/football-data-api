import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme/app_theme.dart';
import 'data/providers.dart';
import 'features/home/home_screen.dart';
import 'features/leagues/leagues_screen.dart';
import 'features/live/live_screen.dart';
import 'features/match/match_detail_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/search/search_screen.dart';
import 'features/splash/splash_gate.dart';
import 'features/teams/teams_screen.dart';
import 'widgets/chrome.dart';

final goRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          GoRoute(path: '/leagues', builder: (_, _) => const LeaguesScreen()),
          GoRoute(path: '/live', builder: (_, _) => const LiveScreen()),
          GoRoute(path: '/teams', builder: (_, _) => const TeamsScreen()),
          GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
        ],
      ),
      GoRoute(path: '/search', builder: (_, _) => const SearchScreen()),
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
    ],
  );
});

class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  static const _paths = ['/', '/leagues', '/live', '/teams', '/profile'];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    var index = _paths.indexOf(location);
    if (index < 0) index = 0;

    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: PlBottomNav(
        index: index,
        onChanged: (i) => context.go(_paths[i]),
      ),
    );
  }
}

class PelotaLibreApp extends ConsumerWidget {
  const PelotaLibreApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = ref.watch(themeModePrefProvider);
    final router = ref.watch(goRouterProvider);
    return MaterialApp.router(
      title: 'Pelota Libre+',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: dark ? ThemeMode.dark : ThemeMode.light,
      routerConfig: router,
      builder: (context, child) => SplashGate(child: child ?? const SizedBox()),
    );
  }
}
