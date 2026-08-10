import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';

/// null = user has not chosen a language yet (first launch).
final languageProvider =
    NotifierProvider<LanguageNotifier, Locale?>(LanguageNotifier.new);

class LanguageNotifier extends Notifier<Locale?> {
  static const langKey = 'app_language_code';

  @override
  Locale? build() {
    final prefs = ref.watch(sharedPrefsProvider);
    final langCode = prefs.getString(langKey);
    if (langCode != null && langCode.isNotEmpty) {
      return Locale(langCode);
    }
    return null;
  }

  Future<void> changeLanguage(String languageCode) async {
    final prefs = ref.read(sharedPrefsProvider);
    await prefs.setString(langKey, languageCode);
    state = Locale(languageCode);
  }
}
