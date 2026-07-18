---
id: c012
title: Image thumbnails on board cards
status: done
epic: e03
depends: [c011]
tags: [ui]
created: 2026-07-16
updated: 2026-07-17
status-changed: 2026-07-17T13:34:47
---

## What

Cards whose body contains at least one image show the first image as a
thumbnail on the board front.

## Acceptance criteria

- [x] First image renders as thumbnail on the card front
- [x] Cards without images are unaffected
- [x] Broken image links degrade gracefully (no thumbnail, no error flood)

## Notes

## Log

- 2026-07-16 created from concept breakdown
- 2026-07-17 status → ready (app)
- 2026-07-17 implemented (agent): firstImageSrc helper + shared AssetImage
  (extracted from CardDetail, added onError/className graceful degradation) +
  card-front thumbnail wired through Board→Column→CardFront with the App's
  loadImage resolver. Tests: assets helper, Board thumbnail present/absent.
- 2026-07-17 status → done (app)
