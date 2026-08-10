import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('es'),
  ];

  /// No description provided for @matchesTab.
  ///
  /// In en, this message translates to:
  /// **'Matches'**
  String get matchesTab;

  /// No description provided for @leaguesTab.
  ///
  /// In en, this message translates to:
  /// **'Leagues'**
  String get leaguesTab;

  /// No description provided for @searchTab.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get searchTab;

  /// No description provided for @settingsTab.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTab;

  /// No description provided for @finishedTab.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get finishedTab;

  /// No description provided for @upcomingTab.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get upcomingTab;

  /// No description provided for @live.
  ///
  /// In en, this message translates to:
  /// **'LIVE'**
  String get live;

  /// No description provided for @today.
  ///
  /// In en, this message translates to:
  /// **'TODAY'**
  String get today;

  /// No description provided for @noFinishedMatches.
  ///
  /// In en, this message translates to:
  /// **'No finished matches.'**
  String get noFinishedMatches;

  /// No description provided for @noUpcomingMatches.
  ///
  /// In en, this message translates to:
  /// **'No upcoming matches.'**
  String get noUpcomingMatches;

  /// No description provided for @noLiveMatches.
  ///
  /// In en, this message translates to:
  /// **'No live matches right now.'**
  String get noLiveMatches;

  /// No description provided for @noMatches.
  ///
  /// In en, this message translates to:
  /// **'No matches'**
  String get noMatches;

  /// No description provided for @timeline.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get timeline;

  /// No description provided for @stats.
  ///
  /// In en, this message translates to:
  /// **'Stats'**
  String get stats;

  /// No description provided for @lineups.
  ///
  /// In en, this message translates to:
  /// **'Lineups'**
  String get lineups;

  /// No description provided for @h2h.
  ///
  /// In en, this message translates to:
  /// **'H2H'**
  String get h2h;

  /// No description provided for @predictions.
  ///
  /// In en, this message translates to:
  /// **'Predictions'**
  String get predictions;

  /// No description provided for @noH2h.
  ///
  /// In en, this message translates to:
  /// **'No head-to-head matches found.'**
  String get noH2h;

  /// No description provided for @noTimelineEvents.
  ///
  /// In en, this message translates to:
  /// **'No timeline events available yet.'**
  String get noTimelineEvents;

  /// No description provided for @noStats.
  ///
  /// In en, this message translates to:
  /// **'No statistics available.'**
  String get noStats;

  /// No description provided for @noLineups.
  ///
  /// In en, this message translates to:
  /// **'No lineups available.'**
  String get noLineups;

  /// No description provided for @noPredictions.
  ///
  /// In en, this message translates to:
  /// **'No predictions available.'**
  String get noPredictions;

  /// No description provided for @fullTime.
  ///
  /// In en, this message translates to:
  /// **'Full Time'**
  String get fullTime;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search teams, leagues, matches…'**
  String get searchHint;

  /// No description provided for @typeAtLeast2.
  ///
  /// In en, this message translates to:
  /// **'Type at least 2 characters'**
  String get typeAtLeast2;

  /// No description provided for @noResults.
  ///
  /// In en, this message translates to:
  /// **'No results found.'**
  String get noResults;

  /// No description provided for @searchSectionLeagues.
  ///
  /// In en, this message translates to:
  /// **'Leagues'**
  String get searchSectionLeagues;

  /// No description provided for @searchSectionTeams.
  ///
  /// In en, this message translates to:
  /// **'Teams'**
  String get searchSectionTeams;

  /// No description provided for @searchSectionMatches.
  ///
  /// In en, this message translates to:
  /// **'Matches'**
  String get searchSectionMatches;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @english.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get english;

  /// No description provided for @spanish.
  ///
  /// In en, this message translates to:
  /// **'Español'**
  String get spanish;

  /// No description provided for @selectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select Language'**
  String get selectLanguage;

  /// No description provided for @welcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome! / ¡Bienvenido!'**
  String get welcomeTitle;

  /// No description provided for @welcomeMessage.
  ///
  /// In en, this message translates to:
  /// **'Please select your preferred language.\nPor favor seleccione su idioma preferido.'**
  String get welcomeMessage;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @darkMode.
  ///
  /// In en, this message translates to:
  /// **'Dark mode'**
  String get darkMode;

  /// No description provided for @seasonYear.
  ///
  /// In en, this message translates to:
  /// **'Season year'**
  String get seasonYear;

  /// No description provided for @clearLocalCache.
  ///
  /// In en, this message translates to:
  /// **'Clear local cache'**
  String get clearLocalCache;

  /// No description provided for @cacheCleared.
  ///
  /// In en, this message translates to:
  /// **'Local cache cleared'**
  String get cacheCleared;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @noInternet.
  ///
  /// In en, this message translates to:
  /// **'No internet connection.'**
  String get noInternet;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong.'**
  String get errorGeneric;

  /// No description provided for @leaguesAndCompetitions.
  ///
  /// In en, this message translates to:
  /// **'Leagues & Competitions'**
  String get leaguesAndCompetitions;

  /// No description provided for @noLeaguesFound.
  ///
  /// In en, this message translates to:
  /// **'No leagues found.'**
  String get noLeaguesFound;

  /// No description provided for @table.
  ///
  /// In en, this message translates to:
  /// **'Table'**
  String get table;

  /// No description provided for @matches.
  ///
  /// In en, this message translates to:
  /// **'Matches'**
  String get matches;

  /// No description provided for @squad.
  ///
  /// In en, this message translates to:
  /// **'Squad'**
  String get squad;

  /// No description provided for @transfers.
  ///
  /// In en, this message translates to:
  /// **'Transfers'**
  String get transfers;

  /// No description provided for @injuries.
  ///
  /// In en, this message translates to:
  /// **'Injuries'**
  String get injuries;

  /// No description provided for @openHomeFirst.
  ///
  /// In en, this message translates to:
  /// **'Open Matches first to discover leagues'**
  String get openHomeFirst;

  /// No description provided for @disclaimer.
  ///
  /// In en, this message translates to:
  /// **'Disclaimer'**
  String get disclaimer;

  /// No description provided for @disclaimerText.
  ///
  /// In en, this message translates to:
  /// **'Pelota Libre+ is a sports data service providing match results, statistics, schedules, and predictions for educational and entertainment purposes only.\n\nPlayer photos, team logos, tournament logos, club crests, and other brand imagery shown in the app are NOT owned by Pelota Libre+. They belong to their respective clubs, leagues, federations, rights holders, and data providers, and are used solely for identification and informational purposes. We do not claim ownership of any trademarks, logos, or likenesses.\n\nWe do not host, stream, or broadcast any live video, audio, or other media of matches. If you are a rights holder and believe content should be removed, contact us and we will address legitimate requests promptly.'**
  String get disclaimerText;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
