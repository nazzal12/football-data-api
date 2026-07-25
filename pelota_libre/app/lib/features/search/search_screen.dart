import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../data/repository.dart';
import '../../widgets/chrome.dart';
import '../../widgets/match_widgets.dart';

final searchQueryProvider =
    NotifierProvider<SearchQueryNotifier, String>(SearchQueryNotifier.new);

class SearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';
  void set(String q) => state = q;
}

final searchResultsProvider = FutureProvider.autoDispose<
    ({
      List<Competition> competitions,
      List<Team> teams,
      List<MatchCardVm> matches,
    })>((ref) async {
  final q = ref.watch(searchQueryProvider);
  if (q.trim().length < 2) {
    return (
      competitions: <Competition>[],
      teams: <Team>[],
      matches: <MatchCardVm>[],
    );
  }
  await Future<void>.delayed(const Duration(milliseconds: 220));
  if (ref.read(searchQueryProvider) != q) {
    return (
      competitions: <Competition>[],
      teams: <Team>[],
      matches: <MatchCardVm>[],
    );
  }
  return ref.read(footballRepositoryProvider).search(q);
});

class SearchScreen extends ConsumerWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final q = ref.watch(searchQueryProvider);
    final async = ref.watch(searchResultsProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PlAppBar(
              leading: IconButton(
                icon: Icon(
                  Icons.arrow_back,
                  color: dark ? PlColors.electricGreen : PlColors.lightPrimary,
                ),
                onPressed: () => context.pop(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: TextField(
                autofocus: true,
                onChanged: (v) => ref.read(searchQueryProvider.notifier).set(v),
                style: GoogleFonts.inter(),
                decoration: InputDecoration(
                  hintText: 'Search teams, leagues, matches…',
                  prefixIcon: const Icon(Icons.search),
                  filled: true,
                  fillColor: dark
                      ? PlColors.darkSurfaceLow
                      : PlColors.lightSurfaceLow,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide(
                      color: dark ? PlColors.darkBorder : PlColors.lightBorder,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.zero,
                    borderSide: BorderSide(
                      color: dark ? PlColors.darkBorder : PlColors.lightBorder,
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: q.trim().length < 2
                  ? Center(
                      child: Text(
                        'TYPE AT LEAST 2 CHARACTERS',
                        style: GoogleFonts.jetBrainsMono(letterSpacing: 1),
                      ),
                    )
                  : async.when(
                      skipLoadingOnReload: true,
                      loading: () => const Center(
                        child: CircularProgressIndicator(
                          color: PlColors.electricGreen,
                        ),
                      ),
                      error: (e, _) => Center(child: Text('$e')),
                      data: (res) {
                        final empty = res.competitions.isEmpty &&
                            res.teams.isEmpty &&
                            res.matches.isEmpty;
                        if (empty) {
                          return Center(
                            child: Text(
                              'NO RESULTS',
                              style:
                                  GoogleFonts.jetBrainsMono(letterSpacing: 2),
                            ),
                          );
                        }
                        return ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            if (res.competitions.isNotEmpty) ...[
                              _section('LEAGUES'),
                              for (final c in res.competitions)
                                ListTile(
                                  leading: EntityMark(
                                    label: c.name,
                                    logoUrl: c.logoUrl,
                                    size: 36,
                                  ),
                                  title: Text(c.name.toUpperCase()),
                                  onTap: () =>
                                      context.push('/league/${c.id}'),
                                ),
                              const SizedBox(height: 12),
                            ],
                            if (res.teams.isNotEmpty) ...[
                              _section('TEAMS'),
                              for (final t in res.teams)
                                ListTile(
                                  leading: EntityMark(
                                    label: t.name,
                                    logoUrl: t.logoUrl,
                                    size: 36,
                                  ),
                                  title: Text(t.name.toUpperCase()),
                                  onTap: () => context.push('/team/${t.id}'),
                                ),
                              const SizedBox(height: 12),
                            ],
                            if (res.matches.isNotEmpty) ...[
                              _section('MATCHES'),
                              for (final m in res.matches)
                                MatchListCard(
                                  card: m,
                                  onTap: () =>
                                      context.push('/match/${m.match.id}'),
                                ),
                            ],
                          ],
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        title,
        style: GoogleFonts.jetBrainsMono(letterSpacing: 2),
      ),
    );
  }
}
