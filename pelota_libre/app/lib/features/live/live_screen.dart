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

final liveFeedProvider =
    FutureProvider.autoDispose<List<MatchCardVm>>((ref) async {
  // Live list: always hit network; refresh every 5s while the tab is open.
  final timer = Timer(const Duration(seconds: 5), () {
    ref.invalidateSelf();
  });
  ref.onDispose(timer.cancel);
  return ref.read(footballRepositoryProvider).liveFeed(forceRefresh: true);
});

class LiveScreen extends ConsumerWidget {
  const LiveScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(liveFeedProvider);
    return Column(
      children: [
        PlAppBar(onSearch: () => context.push('/search')),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: PlColors.liveRed,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'LIVE MATCHES',
                style: GoogleFonts.jetBrainsMono(
                  letterSpacing: 2,
                  fontWeight: FontWeight.w600,
                  color: PlColors.electricGreen,
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
              onRetry: () => ref.invalidate(liveFeedProvider),
            ),
            data: (cards) {
              if (cards.isEmpty) {
                return Center(
                  child: Text(
                    'NO LIVE MATCHES',
                    style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
                  ),
                );
              }
              return RefreshIndicator(
                color: PlColors.electricGreen,
                onRefresh: () async => ref.invalidate(liveFeedProvider),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: cards.length,
                  itemBuilder: (context, i) => MatchListCard(
                    card: cards[i],
                    onTap: () =>
                        context.push('/match/${cards[i].match.id}'),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
