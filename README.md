# NoteWise AI

NoteWise is a local-first study companion for handwritten school notes. A student photographs a page, NoteWise reads the handwriting, and the student corrects it before it goes into a personal library. There are no accounts. Notes stay in the browser.

## Features

- Scan a page with Take photo or Choose from gallery. Those file inputs work on a phone over plain HTTP. Live camera is an extra on HTTPS or localhost.
- Crop, rotate, and keep up to 20 pages in one batch. Choose a subject and a topic, including the common Nigerian school subjects.
- Read handwriting in the cloud with Gemini, or on the phone with Tesseract.js. Cloud is used only after a consent dialog. If the cloud call fails or the phone is offline, reading continues on the device and the screen says the accuracy is lower.
- Review flagged words in the sentence, or edit the full text. Marking a page done saves it to the library.
- Browse subjects, topics, and pages. Search reviewed notes by meaning. If the model is still downloading, search matches words instead. Rename or delete with a confirmation.
- Export a reviewed page, topic, or subject as a PDF or a Word file. The file is made in the browser. Pages that still need review stay out of the file.
- Settings shows pages digitized, flagged words fixed, and average accuracy before correction, split into cloud and on-device, with Copy stats for a proposal.

- Listen reads reviewed pages aloud in the browser, one sentence at a time, with speed and voice remembered in Settings.
- Tutor chat answers from the reviewed notes that match the question. The student can filter by subject, copy an answer, or listen to it. Live Tutor is a full-screen voice room: speak a question, hear a short answer from your notes, or type if speech recognition is unavailable.
- Practice writes a 5, 10, or 20 question quiz from reviewed notes. A question is kept only when its quote is found in those notes. Exam mode reads a past paper the student uploads, describes its pattern, and writes practice in that style from the student's notes. The score updates Home, including weak topics.
- Export all data (a JSON file) and Delete all data are on the home profile bar and in Settings.

## Stack

Free and open-source only:

- [Next.js](https://nextjs.org/) App Router and TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Dexie](https://dexie.org/) (IndexedDB)
- [Tesseract.js](https://github.com/naptha/tesseract.js) for on-device reading
- [react-easy-crop](https://github.com/ValentinH/react-easy-crop)
- [lucide-react](https://lucide.dev/)
- [pdf-lib](https://pdf-lib.js.org/) and [docx](https://docx.js.org/) for files made on the phone
- [@huggingface/transformers](https://huggingface.co/docs/transformers.js) runs a small embedding model in the browser. It downloads once, then search works offline.
- [Zod](https://zod.dev/) checks quiz and exam-pattern JSON before it is shown.
- [PDF.js](https://mozilla.github.io/pdf.js/) reads a past-paper PDF in the browser.

Cloud reading calls the free tier of Google AI Studio (Gemini). That service is not open source. The model name is an environment variable, so it can be changed without editing the app. The photo is sent only from the server route, and the API key never ships to the browser.

## Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

On macOS or Linux, use `cp .env.example .env.local` instead of `copy`.

Open http://localhost:3000. The first screen asks what to call you.

For a production build:

```bash
npm run lint
npm run build
npm start
```

On Vercel, import the GitHub repo and add the same two environment variables in the project settings. Do not commit `.env` or `.env.local`.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Both values start empty.

| Name | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Server only. |
| `GEMINI_MODEL` | Vision-capable Flash or Flash-Lite model id from the [model list](https://ai.google.dev/gemini-api/docs/models). A current fast name to paste is `gemini-3.5-flash-lite`. |

If either value is missing, cloud reading stays off and the app falls back to on-device reading. On-device reading does not need a key. The English language file is served from this app and cached after the first read.

A development build has a Load demo notes button in Settings. Those sample rows are marked DEMO, they are left out of Home counts and Stats, and a production build does not show them.

## Privacy

- The student name, subjects, topics, photos, and corrected text stay in IndexedDB on that device.
- Cloud reading sends the page photo to Google AI Studio after the student chooses “I understand, continue”. Free AI services may use submitted content to improve their products.
- Tutor chat and Live Tutor send the question, the last few messages, and up to four matching note excerpts to the same service. The server does not write those texts to its log. The saved chat stays in IndexedDB. Live Tutor also uses the browser microphone and speech recognition when available.
- Practice sends reviewed note excerpts so the quiz can be written. Exam mode also sends the reviewed text of a past paper when it describes the pattern. The server does not write those texts to its log. The quiz, the score, and the paper stay in IndexedDB. A past paper is left out of the JSON export unless the student ticks Include this past paper in a backup. Past papers belong to the exam bodies. This is for the student's own revision.
- Do not scan pages with phone numbers, addresses, or other private details.
- On-device reading keeps the photo on the phone. It is less accurate on handwriting.
- Delete all data removes the local notebook and the cloud-reading choice. It does not delete anything that was already sent to Google, and it does not touch a future Drive backup.
- The server route accepts JPEG, PNG, and WebP up to 4 MB, limits how often one address can call it, and does not write the photo or the transcription to the server log.
