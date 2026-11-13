// Make the promo narration with ElevenLabs:
//   public/voiceover/<lang>/<scene>.mp3 + <scene>.json (cue and subtitle times found in the speech)
//
// Key: ELEVENLABS_API_KEY, or ELEVENLABS_KEY_FILE (path to a text file holding the key). The key is never printed.
// Usage (from promo/):
//   node scripts/audio.mjs voice ko|en|all [--force]
// Files whose input (text, voice) did not change are skipped, so reruns cost no credits.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.elevenlabs.io/v1";
const RETRIES = 4;
const TIMEOUT_MS = 120_000;

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const file = process.env.ELEVENLABS_KEY_FILE;
  if (!file) throw new Error("Set ELEVENLABS_API_KEY or ELEVENLABS_KEY_FILE.");
  const text = readFileSync(file, "utf8");
  const match = text.match(/sk_[A-Za-z0-9]+/);
  if (match) return match[0];
  const line = text.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith("#"));
  if (!line) throw new Error("Key file is empty.");
  return line.includes("=") ? line.slice(line.indexOf("=") + 1).trim() : line;
}

async function post(path, body) {
  const key = readKey();
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + path, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      const text = (await res.text()).slice(0, 300);
      const temporary = res.status === 429 || res.status >= 500;
      if (!temporary || attempt >= RETRIES) throw new Error(`ElevenLabs ${res.status}: ${text}`);
    } catch (err) {
      if (err.name !== "AbortError" || attempt >= RETRIES) throw err;
    } finally {
      clearTimeout(timer);
    }
    const wait = 1000 * 2 ** attempt;
    console.log(`  temporary error, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

const unchanged = (file, sig) => existsSync(file) && JSON.parse(readFileSync(file, "utf8")).sig === sig;

// Start time (s) of the first character of `phrase` in the spoken text, searching from `from`.
function findTime(align, phrase, from = 0) {
  const text = align.characters.join("");
  const i = text.indexOf(phrase, from);
  return i < 0 ? null : { time: align.character_start_times_seconds[i], index: i };
}

async function makeVoice(lang, force) {
  const script = JSON.parse(readFileSync(join(ROOT, "src", "scripts", `${lang}.json`), "utf8"));
  const outDir = join(ROOT, "public", "voiceover", lang);
  mkdirSync(outDir, { recursive: true });
  const chars = script.scenes.reduce((n, s) => n + s.narration.length, 0);
  console.log(`[${lang}] ${script.scenes.length} scenes, ${chars} characters, model ${script.voice.model}`);
  const problems = [];
  for (const scene of script.scenes) {
    const mp3 = join(outDir, `${scene.id}.mp3`);
    const meta = join(outDir, `${scene.id}.json`);
    const sig = JSON.stringify({ text: scene.narration, voice: script.voice });
    let align;
    if (!force && existsSync(mp3) && unchanged(meta, sig)) {
      align = JSON.parse(readFileSync(meta, "utf8")).alignment;
      console.log(`  ${scene.id}: unchanged, skipped`);
    } else {
      const res = await post(`/text-to-speech/${script.voice.id}/with-timestamps?output_format=mp3_44100_128`, {
        text: scene.narration,
        model_id: script.voice.model,
        language_code: script.voice.language,
        voice_settings: script.voice.settings,
      });
      const data = await res.json();
      writeFileSync(mp3, Buffer.from(data.audio_base64, "base64"));
      align = data.alignment;
      console.log(`  ${scene.id}: saved (${scene.narration.length} chars)`);
    }
    // Cue and subtitle times are recomputed every run, so script edits to cues need no new audio.
    const cues = {};
    for (const [name, phrase] of Object.entries(scene.cues)) {
      const hit = findTime(align, phrase);
      if (hit) cues[name] = hit.time;
      else problems.push(`${lang}/${scene.id}: cue "${name}" phrase "${phrase}" not found in speech`);
    }
    let from = 0;
    const lines = scene.lines.map((line) => {
      const hit = findTime(align, line.at, from);
      if (!hit) problems.push(`${lang}/${scene.id}: subtitle start "${line.at}" not found`);
      else from = hit.index + 1;
      return { text: line.text, start: hit ? hit.time : 0 };
    });
    const end = Math.max(...align.character_end_times_seconds);
    // v3 sometimes stops early (often at "…"): the rest of the text then gets zero-length timings.
    const silent = align.characters.filter((c, i) => c.trim() && align.character_end_times_seconds[i] - align.character_start_times_seconds[i] <= 0.001).length;
    if (silent > 5) problems.push(`${lang}/${scene.id}: speech looks cut off (${silent} characters not spoken); rerun with --force or reword`);
    writeFileSync(meta, JSON.stringify({ sig, end, cues, lines, alignment: align }));
  }
  if (problems.length) {
    console.log("\nPROBLEMS (fix the phrase in the script; spoken text was:)");
    problems.forEach((p) => console.log("  " + p));
    process.exitCode = 2;
  }
}

const [cmd, arg, flag] = process.argv.slice(2);
const force = [arg, flag].includes("--force");
const jobs = {
  voice: async () => {
    const langs = arg === "all" || !arg || arg === "--force" ? ["ko", "en"] : [arg];
    for (const lang of langs) await makeVoice(lang, force);
  },
};
if (!jobs[cmd]) {
  console.log("usage: node scripts/audio.mjs voice ko|en|all [--force]");
  process.exit(1);
}
jobs[cmd]().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
