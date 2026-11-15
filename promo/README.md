# Promo video (Remotion)

The intro video shown on the home page, in Korean (**71.9 s**) and English (**66.8 s**), each as a landscape
(1920 x 1080) and a phone version (1080 x 1920): `app/static/promo-{ko,en}.mp4` and `promo-{ko,en}-v.mp4`.
`app/static/intro.js` plays it full screen on the first home-page visit (and from the "소개 영상 보기" button), in the
site's language with a 한국어 / English switch; an upright phone gets the vertical version, and turning the phone
switches at the same moment. Both versions of a language use the same voice files and timing, so their lengths are
equal (checked after every render). Built with [Remotion](https://www.remotion.dev) (React → MP4, runs on the CPU).
Needs Node.js 20+.

Scenes (one per paragraph of the script; the plan paragraph is split in two):

| Scene | Shows |
|---|---|
| Problem | real AI Hub titles drifting, a counter to 867 |
| Search | the home page; the interest is typed into the search box |
| Major | the "tell us a little more" panel; the major is chosen; "uses your department's curriculum" |
| Results | the camera visits the three results the voice names |
| Score | the real relevance score, then the real "why it fits" reasons, then the card as a whole |
| Compare | the top three are added to the compare list (buttons turn into "added"), then the real compare page |
| Plan | the "plan a project with AI" button; the real plan window; the prompt preview (dataset details, major, interests) |
| Open | one click copies the prompt (the real "copied" message names no AI); a generic, unbranded AI chat marked "example": the real prompt is pasted and an example plan appears |
| Outro | logo, one line, call to action |

Phone version: real phone layouts, not a zoomed desktop. `capture.mjs` also captures every step at a 390 x 844 phone
viewport (3x, mobile, touch) into `public/screens/<lang>/phone/` with its own `rects.json`; in a vertical composition the
scenes use those screenshots inside a phone frame (700 px screen, 1.8x the phone page, status bar so the notch never
covers app text), a finger tap instead of a mouse pointer, and camera zooms capped at 1.5x so nearby text is not cut.

Style: a product demo. The real DataFinder screens appear in a browser window; a camera glides and zooms to the part
being talked about, a cursor types and clicks, and a spotlight dims everything else. Example: a Sport Science student
(국제스포츠학부(스포츠과학전공)) types the interest "음식 이미지와 영양 정보" / "food images and nutrition data" and picks the
major; the top three results score 9.6 / 9.3 / 9.2 in Korean and 8.7 / 8.6 / 8.4 in English, all "good match", each
with a "close to your major" reason. Screens, titles and scores are real output of the app.

The major: 29 of the 31 Korea University Sejong major profiles were built from the department's own pages, including
its curriculum pages (교육과정, 교과과정표, 전공체계도); the relevance score uses that profile (summary, key topics, data
interests, research areas, project themes). The video says exactly this ("information taken from the department's
curriculum"), not that every course name is used. The Sport Science profile is one of the 29.

| File | What it holds |
|---|---|
| `src/scripts/ko.json`, `en.json` | Voice, on-screen words (`ui`), and per scene: narration, headline, subtitle lines, cue words, which result card the camera visits (`focus`) |
| `public/screens/<lang>/` and `<lang>/phone/` | Real app screenshots for desktop (1440 px wide, 2x) and phone (390 px wide, 3x): `home`, `major-empty`, `major`, `results`, `results-added`, `compare`, `plan`, `plan-preview`, `plan-copied`; element positions and each screenshot's size in `rects.json` (also the prompt text) |
| `src/screen.tsx` | Browser window / phone frame, camera, spotlight, cursor or tap, callout, reveal (a box of a later screenshot) |
| `src/parts.tsx` | Background, word-by-word headline, timed subtitles, logo, sound roles and volumes (`SOUNDS`) |
| `src/scenes/*.tsx` | Problem, Search, Major, Results, Score, Compare, Plan, Open, Outro |
| `src/theme.ts` | Colors, easing, pauses, transitions, voice level |
| `scripts/capture.mjs` | Runs the real app (search with interest + university + major, set in `QUERY`, `UNIV`, `MAJOR`; compare list; plan window and copy) in Korean and English at desktop and phone sizes, and saves the screenshots and positions |
| `scripts/audio.mjs` | Makes the narration (with word timings) with ElevenLabs |
| `public/sfx/ui/` | Interface sounds: Kenney "Interface Sounds" (CC0, kenney.nl) and Remotion's whoosh / mouse-click |

## How the sync works

Narration: ElevenLabs `eleven_v4` (the docs call it their most emotive, highest-quality model), voice "Sarah" for both
languages (the free plan cannot use Voice Library voices through the API). The `with-timestamps` endpoint returns when
each character is spoken. Each scene lists **cue words** (`"cues": {"press": "음식"}`); `audio.mjs` finds when each one is
spoken, and the scene starts that camera move, click or highlight on that frame. If a cue word is not found, or the
voice stops early, `audio.mjs` lists it and exits with code 2. No emotion tags: tags like `[sighs]` produced a breathy
sound at the very start. In the Korean script, English words are written in Hangul (에이아이, 에이아이 허브
데이터파인더, 팔백육십칠) so the voice keeps a Korean accent; the subtitles keep the normal spelling. No AI model is named
in the voice or the subtitles.

Sound: voice plus an interface sound on every movement, no background music. The shared components play their own
sounds in sync: camera zoom in / zoom out / glide, cursor travel and every click, spotlight landing, labels popping up,
one light tick per headline word, keystrokes while typing, and fast ticks while the 867 counter runs. About 40-45 sound
moments per video; most sit 15+ dB under the voice and the loudest about 6 dB under it (measured). Voice at 0.85, mix
peak about -2 dBFS. Roles and volumes: `SOUNDS` in `src/parts.tsx`.

## Commands (PowerShell, from `promo/`)

```powershell
npm install
# 1. screens (the app must be running: python -m app.server, with GEMINI_API_KEY)
node scripts/capture.mjs all both     # languages: ko|en|all, devices: desktop|phone|both
# 2. narration (only changed scenes cost credits; --force remakes all)
$env:ELEVENLABS_KEY_FILE = "path\to\key.txt"      # or set ELEVENLABS_API_KEY
node scripts/audio.mjs voice all
# 3. render, then a lighter web copy and a cover image for the site (repeat with en, and with ko-v / en-v for the
#    phone versions: Promo-ko-v, poster scale 720:-1)
npx remotion render Promo-ko out/promo-ko.mp4 --codec=h264 --crf=20
npx remotion ffmpeg -y -i out/promo-ko.mp4 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ../app/static/promo-ko.mp4
npx remotion ffmpeg -y -ss 70 -i out/promo-ko.mp4 -frames:v 1 -vf scale=1280:-1 -q:v 4 ../app/static/promo-poster-ko.jpg
```

A render takes about 5-10 minutes per video on a laptop CPU. Remotion Studio (`npx remotion studio`) previews live but
can stutter on a laptop without a graphics card; the rendered MP4 plays smoothly. Remotion is free for individuals and
teams of up to 3. Sound credit: Kenney (www.kenney.nl), CC0.
