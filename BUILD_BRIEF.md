# NoteWise AI: Build Brief for Cursor

Put this file in the project root as `BUILD_BRIEF.md`. Copy the "Cursor rules" section into `.cursor/rules/notewise.mdc` so Cursor reads it every time.

---

## 1. What we are building

NoteWise AI turns photos of handwritten notebooks into a personal study companion for Nigerian students (JSS, WAEC, NECO, JAMB).

Core flow: **Scan → Review/Correct → Save by subject → Export / Listen / Ask / Practice**.

Hard constraints:
- **Free and open source only.** No paid APIs. Any hosted AI service must be a free tier, behind an adapter so it can be swapped for a local or open model.
- **Local-first.** Student data lives in the browser (IndexedDB). No accounts needed except optional Google sign-in for Drive backup.
- **Mobile-first, low-data, works offline** after first load (PWA).
- Must run on a cheap Android phone in Chrome.

---

## 2. Tech stack (all free)

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | One codebase, free hosting on Vercel or Cloudflare Pages |
| Styling | Tailwind CSS + Framer Motion | Neo-brutalist components we own. No component library. |
| PWA / offline | Serwist (successor to next-pwa) | Installable app, cached shell |
| Local database | Dexie.js (IndexedDB) | Notes, quizzes, settings stay on device |
| Handwriting OCR (default) | Vision-capable LLM via free tier (Google AI Studio Gemini Flash family) | Handwriting is hard; this is the most accurate free option |
| OCR fallback (offline, printed text) | Tesseract.js | Fully open source, runs in browser; weak on handwriting, so label it as fallback |
| Text LLM (tutor, MCQs, exam pattern) | Free tier of Gemini Flash **or** Groq (open Llama models), through one adapter. Local dev option: Ollama | Swappable, no lock-in |
| Embeddings (note search) | transformers.js with `all-MiniLM-L6-v2` | Runs in the browser, free, offline |
| Speech output | Web Speech API `speechSynthesis` | Free, no download. Stretch: Meta MMS-TTS (Hausa/Yoruba/Igbo) via transformers.js |
| Speech input (Live mode) | Web Speech API `SpeechRecognition`. Stretch: Whisper-tiny via transformers.js | Free |
| PDF export | `pdf-lib` or `jspdf` | Open source |
| DOCX export | `docx` npm package | Open source |
| Google Drive backup | Google Identity Services + Drive API, scope `drive.file` only | Free; app only sees files it created |
| Optional cloud DB | None for MVP. Supabase free tier only if needed later | Keeps privacy story simple |

**Be honest in the pitch:** the free vision/LLM tiers are not open source and have rate limits and their own data terms. The adapter design means the app can run fully open-source with Ollama or Tesseract.js, just with lower handwriting accuracy. Check current free-tier limits and model names in the provider docs before building.

---

## 3. Design system

Prompt 01 replaces the earlier rounded cream theme. The style is neo-brutalist and pixel-block: flat colour, 2px ink borders, hard offset shadows with no blur, mono labels, and heavy condensed headlines. It is inspired by an open-source community design language. Do not copy that project's logo, wordmark, pixel artwork, or text. NoteWise has its own wordmark, stair pattern, and wording.

Colours were corrected from the published swatches on the reference brand page (1 Nov 2026). `--page` is not a published swatch; it is a step darker than paper so cards sit on a ground.

```css
:root {
  --green-600: #3d5f58;   /* header, hero, loader */
  --green-800: #2e4742;   /* live tutor start */
  --ink:       #231f20;   /* text and borders */
  --paper:     #f2f2eb;   /* cards */
  --page:      #e4e3d8;   /* body below the hero */
  --red:       #e53927;   /* highlighted word and full stop */
  --blue:      #8bb2de;   /* large second headline line only */
  --yellow:    #f5b726;   /* badges and focus */
  --salmon:    #e97b77;   /* primary button */
  --shadow:    #671912;   /* hard offset shadow */
  --success:   #3d5f58;
  --muted:     #3e4744;   /* secondary text, AA on paper and page */
  --chip-idle: #d9d6cc;
}
```

Rules:
- Sky blue (`--blue`) is only for large headline lines. It is about 3.2:1 on forest, which passes for that size and fails for small text.
- Primary button text is ink on salmon.
- Live Tutor is full screen and dark (`--green-800` to `--ink`). No tab bar.
- Every async wait uses `PixelLoader` with a Space Mono caption.
- All motion respects `prefers-reduced-motion`. Content must stay visible when motion is reduced.

### Fonts (Google Fonts via `next/font/google`)
- **Headlines:** Archivo variable, width axis 62, weight 800–900. Barlow Condensed ExtraBold is the fallback only.
- **Body:** Inter 400/500/600.
- **Labels, buttons, chips:** Space Mono 400/700, uppercase, `0.08em` tracking.

Hero headline `clamp(48px, 9vw, 120px)`. Section headline `clamp(36px, 5vw, 64px)`. Body 16–18px.

### Shape
- Card: paper, 2px ink border, shadow `6px 6px 0 var(--shadow)`, 2px radius, 24px padding.
- Button: 2px ink border, shadow `4px 4px 0 var(--shadow)`. Hover shifts up-left. Press moves `4px 4px` and drops the shadow.
- Icons: Lucide.

---

## 4. Layout and screens

**Mobile (primary):** header collapses to the wordmark plus a menu, and a bottom tab bar with **Home · Scan · Library · Practice · Tutor** (Scan is the larger centre tab).
**Desktop:** the same links in the header, plus a salmon "My NoteWise" button. Content max-width 1200px. No left rail.

### 4.1 Home: "My NoteWise"
No accounts. The first launch asks "What should we call you?" and stores the name in Dexie.

- Green hero: "Hi {name}," in paper and "welcome to your NoteWise." in sky, with original pixel stairs and a static four-square mark.
- Profile bar: initials, name, "Stored on this device", Settings, Connect Google Drive (disabled until the Drive step), Export all data (JSON file), Clear my data.
- Hero subtext counts real pages: "You have digitized {n} pages across {m} subjects." The exam countdown appears only when Settings has an exam date.
- "Your Notes." subject cards come from Dexie. Each card shows the real page count and a status chip: Not started (0 pages), Needs review (any page needs review), Digitized, Backed up (only when every page has a Drive file id).
- "Your Activities." progress is computed from records: scan 5 pages, fix 3 OCR mistakes, finish a 10-question quiz, ask the Tutor 3 questions, back up to Drive. Quiz and Tutor stay at 0 until those screens exist. A yellow badge when complete.
- Empty notebook ("Your notebook starts here." and "Scan your first page") when no pages are stored.
- Cleared-data page after a wipe: notes on this device are gone, Drive backups are not touched, then "Start fresh."

### 4.2 Scan
- Primary capture is a file input, so it works on plain HTTP: "Take photo" (`capture="environment"`) and "Choose from gallery" (multiple).
- Live camera is an extra on HTTPS or localhost: rear camera, page-edge guide, shutter. If permission is denied, the file buttons remain and a short message explains that.
- Up to 20 pages in a batch. Reorder, delete, retake, and crop each one. The crop tool is a rectangle with 90-degree rotate. The saved JPEG is at most 1600px on the long side, about 0.8 quality, with a mild contrast boost, and under 1.5 MB. The unprocessed crop is kept as a Blob until save.
- Subject and topic, then "Read my handwriting" stores each photo first, then reads it. Cloud reading uses Google AI Studio after a consent dialog. If that call fails, or the phone is offline, on-device reading runs and the screen says accuracy is lower. A failed page keeps its photo, stays needs-review, and can be retried.

### 4.3 Review and Correct
- `/review/[pageId]`. Phone: photo on top, text below. Wider screens: photo left, text right. Tap the photo to enlarge it.
- "Fix flagged words" walks gold chips in the sentence, with Previous and Next. "Edit full text" is a textarea. Changes save to Dexie after a short pause.
- "Done, save to library" sets the page to digitized and records correctedAt. The PixelLoader pop plays as the confirmation.
- Word accuracy is 1 minus the word edit distance between rawOcrText and the final text, divided by the final word count. Settings shows the average for cloud and on-device, plus a Copy stats button.

### 4.4 Library
- Subjects, then topics, then page thumbnails with Needs review or Digitized. A page opens a read view with Edit, which goes to Review.
- Search is a case-insensitive match on the page text. Semantic search comes later.
- Delete page, delete topic, and rename subject or topic each ask first.
- Export, Listen, and Tutor are disabled and labelled coming next.

### 4.5 Listen
- Sticky mini-player: play/pause, speed (0.75x–1.5x), sentence highlighting while reading, voice picker.

### 4.6 Practice
- Pick subject/topic → generate 5/10/20 MCQs from notes.
- **Exam Mode:** upload past questions (images or PDF) → app builds an **Exam Profile** → generates new questions in that style (JAMB, WAEC, NECO, Junior WAEC presets).
- One question per screen, instant feedback with explanation, final score with weak topics.

### 4.7 Tutor and Live Tutor (the Gemini Live-style experience)
Two modes on the Tutor tab:
1. **Chat:** text Q&A grounded in the student's notes, with citations like "From your Biology notes, page 4" (tap to open).
2. **Live:** full-screen voice conversation (details below).

### 4.8 Settings
- Exam date (the home countdown uses it only after it is saved), Cloud or On-device handwriting, Google Drive backup/restore, and Delete all data. Delete all data also clears the cloud-reading choice.
- Language, voice, and text size come later.
- Development builds only: a yellow DEMO block with "Load demo notes". It is absent from production builds.

---

## 5. The Live Tutor screen (Gemini Live-style)

**Look:**
- Full-screen dark background (`--green-800` to `--ink`) with a subtle slow-moving gradient.
- Centre: a large **animated orb** (canvas or WebGL via a small shader, or layered blurred radial gradients animated with Framer Motion) blended from red, blue, yellow, and salmon.
- Live caption text under the orb (current sentence, fades out).
- Bottom: three round buttons: **Mic (mute)**, **Subject chip** (pick which notes it uses), **End** (coral).
- Small "Sources" pill that slides up showing which notes the answer came from.

**Orb states:**

| State | Visual |
| --- | --- |
| Idle | Slow breathing, soft glow |
| Listening | Orb gently grows and pulses with the microphone volume |
| Thinking | Orb swirls slowly, colour shifts toward gold |
| Speaking | Orb ripples to the amplitude of the spoken audio |

**How it works technically:**
1. Capture the mic with `getUserMedia`; read volume with a Web Audio `AnalyserNode` to drive the orb.
2. Speech to text with `SpeechRecognition` (continuous mode, interim results shown as captions).
3. When the student pauses, embed the question and retrieve the top 4 note chunks (cosine similarity from IndexedDB vectors).
4. Send question + chunks + short conversation history to the LLM adapter, **streaming** the response.
5. Split the stream at sentence boundaries and speak each sentence with `speechSynthesis` as soon as it is ready, so the voice starts fast.
6. **Barge-in:** if the student starts talking while the tutor speaks, call `speechSynthesis.cancel()` and go back to Listening.
7. Offer "explain simpler", "give an example", and "quiz me on this" quick chips.

Tutor system prompt rules: answer only from supplied notes plus general syllabus knowledge, say which note was used, say "I am not sure; check with your teacher" if the notes do not cover it, keep answers short and spoken-friendly, no markdown in voice mode, use simple English suitable for a secondary-school student.

Fallback: if speech recognition is unavailable on the device, show a keyboard input and keep the orb and voice output.

---

## 6. Core features: implementation notes

### 6.1 Handwriting OCR
- `ocrPage(blob, mode)` picks Cloud or On-device from Settings. If Cloud fails or the phone is offline, On-device runs and the screen says handwriting accuracy is lower.
- Cloud calls `POST /api/ocr`. The model name comes from `GEMINI_MODEL`. The key stays in `.env.local`.
- `[?guess]` and `[?]` become flagged words. `rawOcrText` is stored exactly as returned. The page text shown later has the markers removed.
- On-device reading uses Tesseract.js in a worker. The English language file is in `public/tessdata`.
- Always show the Review/Correct step. Store the original image and the corrected text.
- Keep a local "corrections" log; this gives you a real accuracy number for the pitch (e.g. 5 classmates, 20 pages, word accuracy before correction).

### 6.2 Note search and the Tutor (RAG)
- Split each page into ~200-word chunks with subject/topic metadata.
- Embed chunks with transformers.js in a Web Worker (so the UI never freezes); store vectors in Dexie.
- Cosine similarity search in JS (fine for thousands of chunks).
- Never answer without retrieved context; show the source chunks.

### 6.3 MCQ generation
- LLM returns strict JSON: `{question, options[4], answerIndex, explanation, topic, difficulty}`. Validate with Zod and retry once on bad JSON.
- Check that the answer is supported by a retrieved chunk before showing it.

### 6.4 Exam Pattern Learning
This is **not model training.** It is prompt-based pattern extraction:
1. Student uploads past-question images/PDF; OCR extracts text; the LLM splits it into individual questions.
2. The LLM produces an **Exam Profile** (JSON): exam body, subject, number of options, average question length, question types (recall, calculation, comprehension), topic frequency, difficulty mix, typical wording patterns.
3. Store the profile and 5–10 representative questions.
4. To generate: include the profile and sample questions as few-shot examples, plus retrieved notes for the chosen topic. The output must follow the same format and difficulty.
5. Label generated questions "Practice question, not an official past question."

### 6.5 Export
- PDF: simple page layout with title, subject, date, and text (optionally the original image at the end).
- DOCX: headings and paragraphs via the `docx` package.
- Both generated entirely in the browser; no upload needed.

### 6.6 Google Drive backup
- Use Google Identity Services token flow, scope `https://www.googleapis.com/auth/drive.file`.
- Create a folder "NoteWise" and upload per-subject JSON + PDF.
- "Restore from Drive" re-imports the JSON.
- OAuth apps in testing mode allow only listed test users, so **add the competition judges' Gmail addresses as test users** or prepare a demo account.

### 6.7 Languages
- MVP: English (Nigerian English voice if the device has `en-NG`).
- Stretch: Hausa, Yoruba, Igbo, Pidgin explanations in text via the LLM, and speech via Meta MMS-TTS models (`facebook/mms-tts-hau`, `-yor`, `-ibo`) in transformers.js. Keep it a clearly labelled "beta."

---

## 7. Data model (Dexie)

Prompt 02 is the live schema. Home reads it with `useLiveQuery`. Activity bars are computed from these records and are not stored.

```ts
Subject   { id, name, color, createdAt }
Topic     { id, subjectId, name, createdAt }
NotePage  { id, topicId, subjectId, imageBlob, rawOcrText, text, flaggedWords,
            ocrProvider, status: 'needs-review' | 'digitized', createdAt,
            correctedAt?, driveFileId? }
Settings  { name, aiConsent: boolean, ocrMode: 'cloud' | 'on-device', examDate? }
```

The name is title-cased when it is saved. Chunks, quizzes, attempts, and exam profiles are added when those features are built.

---

## 8. Folder structure

```
/app
  /(tabs)/page.tsx              # Home
  /(tabs)/scan/page.tsx
  /(tabs)/library/page.tsx
  /(tabs)/practice/page.tsx
  /(tabs)/tutor/page.tsx
  /tutor/live/page.tsx          # full screen, no tab bar
  /api/ocr/route.ts
  /api/llm/route.ts
/components  (ui/, orb/, camera/, player/, quiz/)
/lib
  /ai/ (adapter.ts, gemini.ts, groq.ts, ollama.ts, prompts.ts)
  /ocr/ (vision.ts, tesseract.ts)
  /rag/ (chunk.ts, embed.worker.ts, search.ts)
  /export/ (pdf.ts, docx.ts)
  /drive/ (auth.ts, sync.ts)
  /db.ts
/public (manifest.webmanifest, icons)
```

---

## 9. Cursor rules (copy into `.cursor/rules/notewise.mdc`)

```
You are helping a secondary-school student build NoteWise AI for HIASFEST 2027.
- Stack: Next.js App Router, TypeScript (strict), Tailwind, Framer Motion, Dexie, lucide-react.
- No authentication, no accounts. Student profile is a local name stored in Dexie.
- Only free and open-source dependencies. No paid services.
- All AI calls go through /lib/ai/adapter.ts so providers can be swapped.
- API keys only in server routes via env vars. Never in client code. Never commit .env.
- Local-first: student data stays in IndexedDB. Ask before adding any server storage.
- Mobile-first (360px width), accessible (labels, contrast, focus states), respect reduced motion.
- Visual language: neo-brutalist pixel-block. Flat colours, 2px ink borders, hard offset shadows (no blur), Space Mono for labels and buttons, Archivo (narrow, heavy) for headlines, Inter for body. Tokens are in section 3.
- Every async wait uses PixelLoader with a mono caption.
- All motion must respect prefers-reduced-motion. Never leave content at opacity 0 when motion is reduced.
- Keep components small, add short comments explaining non-obvious logic, and explain what you changed after each task so I can learn from it.
- Validate every LLM JSON output with Zod. Handle errors with friendly messages.
- Do not copy another project's logo, wordmark, pixel artwork, or text.
```

---

## 10. Build order with prompts

Work in this order. Test each stage on your phone before moving on. Paste the prompt, then read and understand what Cursor produced.

1. **Setup:** Done in Prompt 01. Next.js, Tailwind, Dexie, Framer Motion, the section 3 tokens, header plus mobile tab bar, splash, and My NoteWise home. No accounts.
2. **Database:** Done in Prompt 02. Dexie version 2 stores subjects, topics, note pages, and settings. Home cards and activity bars read those records. A dev-only DEMO loader fills sample notes.
3. **Scan and OCR:** "Build the Scan screen with camera capture, multi-page batch, canvas pre-processing, and the OCR adapter with the vision provider and Tesseract fallback."
4. **Review and Library:** "Build the Review/Correct screen and the Library with subjects, topics, pages."
5. **Export:** "Add PDF and DOCX export in the browser for a page and for a whole subject."
6. **Listen:** "Add the audio player using speechSynthesis with sentence highlighting and speed control."
7. **Search and Tutor chat:** "Chunk and embed notes in a Web Worker with transformers.js, build semantic search, and a chat tutor with citations."
8. **Practice:** "Generate MCQs from notes as validated JSON, build the one-question-per-screen quiz, scoring and weak topics."
9. **Exam Pattern Learning:** "Add past-question upload, extraction, Exam Profile generation, and few-shot generation per section 6.4."
10. **Live Tutor:** "Build the full-screen Live Tutor from section 5 with the animated orb, four states, mic volume reactivity, streaming answers, sentence-by-sentence speech, and barge-in."
11. **Home dashboard:** "Build My NoteWise with progress ring, activities checklist, streak, subject cards, weak topics."
12. **Drive backup:** "Add Google Drive backup and restore with the drive.file scope."
13. **PWA and polish:** "Add offline support, install prompt, loading and empty states, error handling, and reduced-motion support."

---

## 11. Timeline (Oct 31 to Dec 31, 2026)

| Dates | Goal |
| --- | --- |
| Week 1 | Steps 1–4: scan, OCR, review, library working on your phone |
| Week 2 | Steps 5–6: export and listen |
| Week 3 | Steps 7–8: tutor chat and MCQs |
| Week 4 | Step 9: exam pattern learning |
| Week 5 | Step 10: Live Tutor (give this a full week; it is your showpiece) |
| Week 6 | Steps 11–12: dashboard and Drive |
| Week 7 | Step 13: polish, testing with real students |
| Week 8 | Proposal final edit, demo video, deploy, rehearse, **submit before Dec 31** |

If time runs short, cut in this order: Hausa/Yoruba/Igbo speech, Drive restore, DOCX export. **Never cut:** Scan→Review, Listen, Tutor chat, MCQs, Live Tutor.

---

## 12. How to win

1. **Test with real students.** Ask 5–10 classmates to scan their real notes. Record OCR accuracy before and after correction, quiz scores before and after a week of use, and quotes. Real numbers beat big claims.
2. **Make the demo flawless.** Prepare a clean demo notebook with neat handwriting, test it on the exact phone you will present with, and record a 2–3 minute backup video in case the internet fails at the venue.
3. **Open with the Live Tutor.** Judges remember the moment a student talks to their own notes. Show the orb, interrupt the tutor mid-sentence, and ask a question from your own notebook.
4. **Show it works offline.** Switch to airplane mode and open saved notes, listen and take a quiz. This answers "Nigeria's data and network reality."
5. **Own the safety and security criteria.** Show the privacy notice, "delete all data" button, local-first storage, and the "I am not sure" behaviour.
6. **Publish it.** Deploy free (Vercel or Cloudflare Pages), put the code on GitHub with an MIT licence, and give judges a link and a QR code.
7. **Be able to explain everything.** The rules say you must conceive, create and present the entry yourself. If you use Cursor, treat it like a tutor: read the code, be able to explain the OCR step, the RAG search and the orb, and say openly in the proposal and presentation which AI tools you used. Judges will ask how it works.
8. **Prepare for hard questions.** "What if the handwriting is bad?" (Review step plus accuracy numbers.) "What if the AI is wrong?" (Citations, 'not sure' rule, teacher check.) "How does it make money or sustain itself?" (Free for students; school and teacher plans later.) "How is this different from ChatGPT?" (Built on the student's own notes, exam-pattern practice, offline, Nigerian curriculum.)
9. **Keep the scope small and polished.** One excellent flow beats ten half-working features.

---

## 13. Safety checklist before demo
- [ ] API keys only in server env vars; `.env` in `.gitignore`
- [ ] Image size limits and basic rate limiting on API routes
- [ ] Privacy notice shown on first launch
- [ ] "Delete all my data" works
- [ ] No tracking or ads
- [ ] Generated questions labelled as practice questions
- [ ] Tested on a low-end Android phone in Chrome
