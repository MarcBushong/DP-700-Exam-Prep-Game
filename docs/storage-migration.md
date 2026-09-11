# Preserving existing local study data

The dungeon platform retains the existing `fabric-challenge:v1` localStorage
key and `version: 1` envelope. Optional fields are normalized when read rather
than creating an unrelated browser profile or resetting the old bank's history.

Existing configuration, appearance, banter preferences, completed result
snapshots, and recent-question IDs remain available. Old recent-question IDs
belong to `dp-700`. New fields store the selected credential, favorite
credentials, hero class, credential-specific configurations, and bounded
credential-specific recent-question lists.

## Old and new runs

Old runs without origin metadata are assigned the known originating credential,
`dp-700`, but their missing objective version is `legacy-unknown`. The loader
does not invent the version of a guide that was not saved with the result.
Original questions, selected answers, dates, and points remain intact.

New runs snapshot the objective map and record each question's credential,
objective version, and source grounding date. Raid results retain all their
source dungeons. Historical scoring and exports use saved snapshots, not the
currently selected dungeon or a newer objective map.

The former 30-result truncation is removed: integrating another credential or
completing a run must not evict an older run. Recent-question preference remains
bounded at 200 IDs per credential and is independently resettable. It is not
the completed-result history.

## Damaged or unavailable storage

If a supported envelope contains damaged fields, readable records can be
recovered in memory. The original stored value is left unchanged and automatic
saving pauses until the user explicitly clears local data. Unsupported or
unreadable storage produces a visible warning rather than a false successful
save.

Local storage is neither encrypted nor a backup. Browser quotas, profile
clearing, private browsing, and device changes can affect persistence. Export
important results. Clear Local Data is an explicit destructive action; changing
dungeons, classes, themes, or objective versions is not.

Active quizzes remain in memory. Reloading discards an unfinished run; completed
snapshots survive when browser storage is available. A deployment to a different
origin does not automatically transfer local results.
