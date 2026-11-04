# NoteWise Cursor Prompt 02

Fixes: open the gaps in display headlines (word-spacing about 0.12em, slightly looser letter-spacing) on the hero, section headings, and inner-page headings. Title-case the student's name on save, including a name already stored. Add top padding on every inner page so headings clear the header. Check the layout at 360px (bottom tab bar, headline sizes, cards, profile buttons) and fix overflow.

Data: Dexie with `useLiveQuery`. Subject `{ id, name, color, createdAt }`. Topic `{ id, subjectId, name, createdAt }`. NotePage `{ id, topicId, subjectId, imageBlob, rawOcrText, text, flaggedWords, ocrProvider, status: 'needs-review' | 'digitized', createdAt, correctedAt?, driveFileId? }`. Settings `{ name, aiConsent, ocrMode: 'cloud' | 'on-device', examDate? }`. Activity progress is computed from records.

Home: no mock data. Cards come from Dexie and show the real page count plus NOT STARTED, NEEDS REVIEW, DIGITIZED, or BACKED UP (later). Hero subtext is "You have digitized {n} pages across {m} subjects." If n is 0, show "Your notebook starts here." and the salmon "Scan your first page" button. Exam countdown only when Settings has an exam date. Activities: scan 5 pages, fix 3 OCR mistakes, finish a 10-question quiz, ask the Tutor 3 questions, back up to Drive. Quiz and Tutor stay at 0.

Settings: a dev-only "Load demo notes" button, hidden in production, labelled DEMO.
