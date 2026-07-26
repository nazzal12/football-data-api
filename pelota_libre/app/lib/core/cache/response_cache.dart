import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

class CacheEntry {
  CacheEntry({
    required this.body,
    required this.storedAtMs,
    required this.maxAgeSeconds,
    this.etag,
  });

  final String body;
  final int storedAtMs;
  final int maxAgeSeconds;
  final String? etag;

  bool get isFresh {
    final ageMs = DateTime.now().millisecondsSinceEpoch - storedAtMs;
    return ageMs < maxAgeSeconds * 1000;
  }

  /// Soft-stale window: serve while revalidating.
  /// Short-TTL paths (live ≤60s) stay tight; longer paths keep a wider SWR window.
  bool get isUsable {
    final ageMs = DateTime.now().millisecondsSinceEpoch - storedAtMs;
    if (maxAgeSeconds <= 60) {
      return ageMs < maxAgeSeconds * 2 * 1000;
    }
    final soft = (maxAgeSeconds * 3).clamp(300, 86_400);
    return ageMs < soft * 1000;
  }

  /// Last-resort: any entry newer than 24h can be served on total network failure.
  bool get isEmergencyUsable {
    final ageMs = DateTime.now().millisecondsSinceEpoch - storedAtMs;
    return ageMs < 86_400 * 1000;
  }

  Map<String, dynamic> toJson() => {
        'body': body,
        'storedAtMs': storedAtMs,
        'maxAgeSeconds': maxAgeSeconds,
        'etag': etag,
      };

  factory CacheEntry.fromJson(Map<String, dynamic> json) => CacheEntry(
        body: json['body'] as String,
        storedAtMs: json['storedAtMs'] as int,
        maxAgeSeconds: json['maxAgeSeconds'] as int,
        etag: json['etag'] as String?,
      );
}

/// Disk + memory cache keyed by request path. Honors Cache-Control max-age.
class ResponseCache {
  ResponseCache(this._box);

  final Box<String> _box;
  final Map<String, CacheEntry> _memory = {};

  static const boxName = 'http_cache_v1';

  static Future<ResponseCache> open() async {
    final box = await Hive.openBox<String>(boxName);
    return ResponseCache(box);
  }

  CacheEntry? get(String key) {
    final mem = _memory[key];
    if (mem != null) return mem;
    final raw = _box.get(key);
    if (raw == null) return null;
    try {
      final entry = CacheEntry.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      _memory[key] = entry;
      return entry;
    } catch (_) {
      return null;
    }
  }

  Future<void> put(String key, CacheEntry entry) async {
    _memory[key] = entry;
    await _box.put(key, jsonEncode(entry.toJson()));
  }

  Future<void> clear() async {
    _memory.clear();
    await _box.clear();
  }
}

/// Prefer a positive client TTL. Worker may send max-age=0 on some paths.
int parseMaxAge(String? cacheControl, {int fallback = 60}) {
  if (cacheControl == null || cacheControl.isEmpty) return fallback;
  final match = RegExp(r'max-age=(\d+)').firstMatch(cacheControl);
  if (match == null) return fallback;
  final parsed = int.tryParse(match.group(1)!);
  if (parsed == null) return fallback;
  // Honor short TTLs (incl. 0 → treat as immediately stale).
  if (parsed <= 0) return 0;
  return parsed;
}
