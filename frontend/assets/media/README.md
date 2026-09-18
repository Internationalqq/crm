# Presentation media

## Construction film and posters

Sources: [Buildings under construction, aerial view — Mixkit 4010](https://mixkit.co/free-stock-video/buildings-under-construction-aerial-view-4010/) and [Construction zone in a city in an aerial shot — Mixkit 42333](https://mixkit.co/free-stock-video/construction-zone-in-a-city-in-an-aerial-shot-42333/).

Downloaded 17 September 2026 through each item's Full HD download control: `https://assets.mixkit.co/videos/4010/4010-1080.mp4` (34,017,798 bytes) and `https://assets.mixkit.co/videos/42333/42333-1080.mp4` (42,848,334 bytes). Both items explicitly offer the **Mixkit Stock Video Free License** for commercial and personal projects: [license](https://mixkit.co/license/#videoFree), [terms](https://mixkit.co/terms/). Attribution is optional. This is illustrative footage, not a PM.bi customer project; no affiliation with the depicted builders is claimed.

Edits: clip 4010 seconds 0.3–5.3 followed by clip 42333 seconds 1–6.5 with a 0.4-second crossfade. 24 fps, no audio, H.264/yuv420p, fast-start MP4. Desktop 1440×810 (CRF 28); mobile crops 960×1080 at source x=560/y=0 and x=480/y=0 respectively, scaled to 640×720 (CRF 29). The ~10.1-second montage combines the skyline/cranes with an aerial camera moving over an active site. Posters show second 1 of the first shot, WebP quality 84/82. The website serves local assets, without third-party players or tracking.

- `construction-1440.mp4`: desktop loop.
- `construction-mobile.mp4`: smaller portrait loop.
- `construction-poster.webp`, `construction-poster-mobile.webp`: static fallback for no JavaScript, Save-Data, unavailable video or denied autoplay.

The 17 September follow-up requests a continuous film: it does not pause on scroll or automatically opt out under reduced motion. The clarified brief removes manual pause/play controls; a hidden browser tab still suspends playback. The separate four-scene CRM demonstration begins with the photo report and loops continuously; selecting a tab restarts its interval without pausing. It respects reduced motion and suspends while outside the viewport. This supersedes the previous shared motion policy.

## Actual product walkthroughs — 18 September 2026

`product/` contains 20 local H.264/fast-start MP4 recordings: 10 scenarios, each at 1280×900 and at 390×700. Total video payload is about 7.8 MB, loaded one selected scene at a time as its theatre enters the viewport. Every clip has a WebP still and a provenance sidecar. `recordings.json` records dimensions, durations and byte sizes.

Source applications: PM.bi commit `89d7bf2` and AutoBot commit `4d794fc`. Playwright operated the actual browser UI: clicks, typing, uploads, saves and real local responses. The cursor annotation tracks those actual pointer events. No invented HTML interface, generated UI or production customer information appears in these recordings. Both applications ran in isolated copies with synthetic data. The illustrative object is «Деловой центр “Горизонт”»; the local Excel estimate contains four demonstration positions.

- `crm-report`: open the journal day, open its photograph, return to the report.
- `crm-estimate`: open work quantities, enter actual volume and save.
- `crm-task`: create an assigned task with a due date.
- `crm-result`: add a planned invoice and open the payment list; this is not a completed payment.
- `bot-estimate`: upload an Excel file and show the parsed positions.
- `bot-review`: open the original row, amend a position and save the correction reason.
- `bot-market`: configure city and item types for market comparison. No live search results are claimed.
- `bot-export`: open AutoBot inside the actual CRM bridge, select the existing project and show the import confirmation control. The demonstration does not submit the import.
- `bot-tenders`: configure tender search criteria. No tender results are fabricated.
- `bot-research`: configure a named work/material search. No market result is fabricated.

Suffix `-mobile` identifies a separately recorded portrait walkthrough, not a crop of the desktop recording. The page labels all recordings as demonstration data. Tabs advance when the selected recording ends and can be selected manually or from the keyboard. No pause controls, as requested. Product recordings stay as readable stills for reduced motion, Save Data, unavailable video or denied autoplay. Offscreen and hidden-page players are suspended. The enlarged view uses the same local media. The construction hero retains the separately documented continuous-film policy above.

`autobot-walkthrough.gif` combines the actual Excel upload/parse and row-review recordings: 25 seconds, 8 fps, 960 px wide, 128 colours, infinite loop, about 3.95 MB. It is offered only as a download and is not requested on initial page load. Its JSON sidecar records the origin.

### Action-focused opening scenes

The Attio-direction review added four authentic recordings: `crm-report-focus[−mobile].mp4` and `bot-estimate-focus[−mobile].mp4` (the filenames use an ordinary hyphen). These replay the isolated applications at 900×632 desktop and 390×700 phone. CRM starts inside the report and opens its photograph. AutoBot parses the actual local Excel upload and scrolls to all four resulting positions; on the narrow screen it brings the name column into view. Nothing is mocked or written to production. The original 20 complete recordings remain unchanged, and enlargement retains the original full-context video/poster sources.

The corresponding four `-focus` WebP posters are extracted from the recordings after the photograph opens or the rows become visible. Exact extraction times, dimensions and payload sizes are in `product/recordings.json`; origin text is in their JSON sidecars. The landing loads these focused sources only in the first CRM/AutoBot chapter. Other chapters, the download-only GIF and the continuous construction film keep their original sources.

## Retained illustration and brand

`demo-interior.webp` reuses the project's existing ImageGen illustration `frontend/assets/images/project-cover-interior.webp`. Its generation origin is recorded in that directory's README and the local JSON sidecar. It is used for the synthetic report photograph and the explicitly future Telegram concept, not as evidence of a customer project. Original CRM assets are untouched.

`pmbi-icon.png` is a copy of the existing `frontend/assets/logo.png`, with origin in PNG metadata. Abandoned presentation-only stock photographs, role photographs and the unused exterior copy were removed when actual product recordings replaced them; their original CRM source assets were not changed.
## AutoBot illustration

The presentation also reuses `../images/autobot-construction-ai.webp` unchanged beside the AutoBot introduction. It is the existing generated product illustration, not a screenshot or evidence of an implemented capability. Its original prompt is recorded in `../images/README.md`; provenance is also stored in `../images/autobot-construction-ai.webp.json`. Authentic product recordings remain separate.
