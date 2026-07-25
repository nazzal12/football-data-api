# Pelota Libre (Flutter)

Football scores app bound to the Football API.

## Design source

UI Templates under `../UI Templates/` — dark (`pelota_libre`) and light (`velocity_light`). Sharp edges, electric green `#00FF66`, no soft AI styling.

## Run

```bash
cd pelota_libre/app
flutter pub get
flutter run
```

API base URL: `https://football-api.nazzalkausar12.workers.dev` (`lib/core/config.dart`).

## Caching

1. **API** — Worker Cache API / R2 / KV (request-driven refresh).
2. **App** — Hive disk cache keyed by path, honors `Cache-Control: max-age`, stale-while-revalidate (serve stale + refresh background), in-flight request dedupe, entity memory maps for teams/competitions.

Clear from **Profile → Clear local cache**.

## Screens

| Tab | Data |
|-----|------|
| Home | `/v1/projections/matches/by-date/...` + `/live`, hydrate matches/teams/competitions |
| Live | Live projection |
| Leagues | Featured leagues → standings, matches, leaders |
| Teams | Featured teams → matches, squad, stats, coach |
| Match detail | Events, statistics, predictions |
| Profile | Dark/light toggle, season year |

Team/competition logos are not in the public API — initials marks match the template placeholders.
