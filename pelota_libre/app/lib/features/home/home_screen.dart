import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';
import '../../widgets/offline_retry.dart';

enum HomeDateTab { yesterday, today, tomorrow }
enum HomeFilter { all, live }

final homeDateTabProvider =
    NotifierProvider<HomeDateTabNotifier, HomeDateTab>(HomeDateTabNotifier.new);

class HomeDateTabNotifier extends Notifier<HomeDateTab> {
  @override
  HomeDateTab build() => HomeDateTab.today;
  void set(HomeDateTab t) => state = t;
}

final homeFilterProvider =
    NotifierProvider<HomeFilterNotifier, HomeFilter>(HomeFilterNotifier.new);

class HomeFilterNotifier extends Notifier<HomeFilter> {
  @override
  HomeFilter build() => HomeFilter.all;
  void set(HomeFilter f) => state = f;
}

final homeFeedProvider = FutureProvider.autoDispose
    .family<List<LeagueGroupVm>, (HomeDateTab, HomeFilter)>((ref, args) async {
  final tab = args.$1;
  final filter = args.$2;
  final now = DateTime.now();
  final day = switch (tab) {
    HomeDateTab.yesterday => now.subtract(const Duration(days: 1)),
    HomeDateTab.today => now,
    HomeDateTab.tomorrow => now.add(const Duration(days: 1)),
  };
  final liveOnly = filter == HomeFilter.live;
  // Today / live filter: bypass local cache and poll while visible.
  if (liveOnly) {
    final timer = Timer(const Duration(seconds: 5), () {
      ref.invalidateSelf();
    });
    ref.onDispose(timer.cancel);
  } else if (tab == HomeDateTab.today) {
    final timer = Timer(const Duration(minutes: 5), () {
      ref.invalidateSelf();
    });
    ref.onDispose(timer.cancel);
  }
  return ref.read(footballRepositoryProvider).homeFeed(
        day: day,
        liveOnly: liveOnly,
        forceRefresh: liveOnly || tab == HomeDateTab.today,
      );
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final dateTab = ref.watch(homeDateTabProvider);
    final filter = ref.watch(homeFilterProvider);
    final async = ref.watch(homeFeedProvider((dateTab, filter)));

    return Column(
      children: [
        PlAppBar(
          onSearch: () => context.push('/search'),
        ),
        Container(
          color: dark ? PlColors.darkBackground.withValues(alpha: 0.95) : null,
          padding: const EdgeInsets.only(bottom: 8),
          child: Column(
            children: [
              Row(
                children: [
                  for (final t in HomeDateTab.values)
                    Expanded(
                      child: InkWell(
                        onTap: () =>
                            ref.read(homeDateTabProvider.notifier).set(t),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: !dark && dateTab == t
                                ? PlColors.lightOnSurface
                                : null,
                            border: Border(
                              bottom: BorderSide(
                                color: dark && dateTab == t
                                    ? PlColors.electricGreen
                                    : (!dark && dateTab == t
                                        ? PlColors.lightOnSurface
                                        : Colors.transparent),
                                width: 2,
                              ),
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            t.name.toUpperCase(),
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 12,
                              letterSpacing: 1,
                              fontWeight: FontWeight.w500,
                              color: dateTab == t
                                  ? (dark
                                      ? PlColors.electricGreen
                                      : Colors.white)
                                  : (dark
                                      ? PlColors.darkOnSurfaceVariant
                                      : PlColors.lightOnSurfaceVariant),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: _FilterBtn(
                        label: 'UPCOMING / FINISHED',
                        active: filter == HomeFilter.all,
                        onTap: () => ref
                            .read(homeFilterProvider.notifier)
                            .set(HomeFilter.all),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: _FilterBtn(
                        label: 'LIVE',
                        active: filter == HomeFilter.live,
                        live: true,
                        onTap: () => ref
                            .read(homeFilterProvider.notifier)
                            .set(HomeFilter.live),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
            skipLoadingOnReload: true,
            skipLoadingOnRefresh: true,
            loading: () => const Center(
              child: CircularProgressIndicator(color: PlColors.electricGreen),
            ),
            error: (e, _) => OfflineRetryPane(
              error: e,
              onRetry: () =>
                  ref.invalidate(homeFeedProvider((dateTab, filter))),
            ),
            data: (groups) {
              if (groups.isEmpty) {
                return Center(
                  child: Text(
                    'NO MATCHES',
                    style: GoogleFonts.jetBrainsMono(
                      letterSpacing: 2,
                      color: PlColors.darkOnSurfaceVariant,
                    ),
                  ),
                );
              }
              return RefreshIndicator(
                color: PlColors.electricGreen,
                onRefresh: () async =>
                    ref.invalidate(homeFeedProvider((dateTab, filter))),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  itemCount: groups.length,
                  itemBuilder: (context, i) {
                    final g = groups[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LeagueSectionHeader(
                            title: g.competition.name,
                            onTap: () {},
                          ),
                          const SizedBox(height: 8),
                          for (final m in g.matches)
                            MatchListCard(
                              card: m,
                              onTap: () =>
                                  context.push('/match/${m.match.id}'),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FilterBtn extends StatelessWidget {
  const _FilterBtn({
    required this.label,
    required this.active,
    required this.onTap,
    this.live = false,
  });

  final String label;
  final bool active;
  final bool live;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bg = active
        ? PlColors.electricGreen
        : (dark ? PlColors.darkSurfaceContainer : PlColors.lightSurfaceHigh);
    final fg = active
        ? PlColors.darkOnPrimaryContainer
        : (dark ? PlColors.darkOnSurface : PlColors.lightOnSurface);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(
            color: active
                ? PlColors.electricGreen
                : (dark ? PlColors.darkBorder : PlColors.lightBorder),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (live && active) ...[
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.black,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

