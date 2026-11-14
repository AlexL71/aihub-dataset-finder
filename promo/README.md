# Promo video (Remotion)

The intro video shown on the home page, in Korean (~53 s) and English (~48 s), each as a landscape (1920 x 1080) and a
phone version (1080 x 1920): `app/static/promo-{ko,en}.mp4` and `promo-{ko,en}-v.mp4`. `app/static/intro.js` plays it
full screen on the first home-page visit (and from the "소개 영상 보기" button), in the site's language with a
한국어 / English switch; an upright phone gets the vertical version, and turning the phone switches at the same moment.
The phone layout comes from the same scenes (`usePortrait()` in `parts.tsx`; a taller browser window in `screen.tsx`
where every camera zoom is capped so its target fits). Built with [Remotion](https://www.remotion.dev)
(React → MP4, runs on the CPU). Needs Node.js 20+.

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
| `public/screens/<lang>/` | Real app screenshots (`home`, `major-empty`, `major`, `plan` 1440 x 900; `results` 1440 x 1440 so both card rows are complete; all at 2x) and element positions (`rects.json`) |
| `src/screen.tsx` | Browser window, camera, spotlight, cursor, callout |
| `src/parts.tsx` | Background, word-by-word headline, timed subtitles, logo, sound roles and volumes (`SOUNDS`) |
| `src/scenes/*.tsx` | Problem, Search, Major, Results, Score, Plan, Outro |
| `src/theme.ts` | Colors, easing, pauses, transitions, voice level |
| `scripts/capture.mjs` | Runs the real search (interest + university + major, set in `QUERY`, `UNIV`, `MAJOR`) in Korean and English and saves the screenshots and positions |
| `scripts/audio.mjs` | Makes the narration (with word timings) with ElevenLabs |
| `public/sfx/ui/` | Interface sounds: Kenney "Interface Sounds" (CC0, kenney.nl) and Remotion's whoosh / mouse-click |

## How the sync works

Narration: ElevenLabs `eleven_v4` (the docs call it their most emotive, highest-quality model), voice "Sarah" for both
languages (the free plan cannot use Voice Library voices through the API). The `with-timestamps` endpoint returns when
each character is spoken. Each scene lists **cue words** (`"cues": {"press": "음식"}`); `audio.mjs` finds when each one is
spoken, and the scene starts that camera move, click or highlight on that frame. If a cue word is not found, or the
voice stops early, `audio.mjs` lists it and exits with code 2. No emotion tags: tags like `[sighs]` produced a breathy
sound at the very start. In the Korean script, English words are written in Hangul (에이아이, 쓰리디, 데이터파인더,
챗지피티) so the voice keeps a Korean accent; the subtitles keep the normal spelling. The plan scene says "the latest
AI models" instead of naming each one.

Sound: voice plus an interface sound on every movement, no background music. The shared components play their own
sounds in sync: camera zoom in / zoom out / glide, cursor travel and every click, spotlight landing, labels popping up,
one light tick per headline word, keystrokes while typing, and fast ticks while the 867 counter runs. About 40-45 sound
moments per video; most sit 15+ dB under the voice and the loudest about 6 dB under it (measured). Voice at 0.85, mix
peak about -2 dBFS. Roles and volumes: `SOUNDS` in `src/parts.tsx`.

## Commands (PowerShell, from `promo/`)

```powershell
npm install
# 1. screens (the app must be running: python -m app.server, with GEMINI_API_KEY)
node scripts/capture.mjs all
# 2. narration (only changed scenes cost credits; --force remakes all)
$env:ELEVENLABS_KEY_FILE = "path\to\key.txt"      # or set ELEVENLABS_API_KEY
node scripts/audio.mjs voice all
# 3. render, then a lighter web copy and a cover image for the site (repeat with en, and with ko-v / en-v for the
#    phone versions: Promo-ko-v, poster scale 720:-1)
npx remotion render Promo-ko out/promo-ko.mp4 --codec=h264 --crf=20
npx remotion ffmpeg -y -i out/promo-ko.mp4 -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart ../app/static/promo-ko.mp4
npx remotion ffmpeg -y -ss 51 -i out/promo-ko.mp4 -frames:v 1 -vf scale=1280:-1 -q:v 4 ../app/static/promo-poster-ko.jpg
```

A render takes about 2-3 minutes per video on a laptop CPU. Remotion Studio (`npx remotion studio`) previews live but
can stutter on a laptop without a graphics card; the rendered MP4 plays smoothly. Remotion is free for individuals and
teams of up to 3. Sound credit: Kenney (www.kenney.nl), CC0.
