"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ListenButton } from "@/components/listen/ListenButton";
import { SpokenText } from "@/components/listen/SpokenText";
import { ExportBar } from "@/components/library/ExportBar";
import { NoteSearch, ReviewedIndex } from "@/components/library/NoteSearch";
import { PageImage } from "@/components/review/PageImage";
import type { NotePage, Subject, Topic } from "@/lib/db";
import { shownPages, shownSubjects, shownTopics } from "@/lib/demo";
import {
  deletePage,
  deleteTopic,
  renameSubject,
  renameTopic,
  subjectById,
  subjectTopics,
  topicPages,
} from "@/lib/library";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";

export function LibraryScreen() {
  const notebook = useNotebook();
  const params = useParams<{ slug?: string[] }>();
  const raw = params.slug;
  const slug = Array.isArray(raw) ? raw : raw ? [raw] : [];

  if (!notebook) {
    return (
      <main className="nw-page mx-auto grid w-full max-w-[1100px] place-items-center">
        <PixelLoader caption="Opening your library…" tone="on-paper" />
      </main>
    );
  }

  if (isNotebookError(notebook)) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink" role="alert">
          {notebook.error}
        </p>
      </main>
    );
  }

  const subjects = shownSubjects(notebook.subjects);
  const topics = shownTopics(notebook.topics);
  const pages = shownPages(notebook.pages);

  return (
    <main className="nw-page mx-auto w-full max-w-[1100px]">
      <p className="nw-mono text-[12px] text-muted">Library</p>
      <div className="mt-3">
        <SectionHeading before="Your" highlight="library" />
      </div>
      <ReviewedIndex pages={pages} />
      <LibraryBody slug={slug} subjects={subjects} topics={topics} pages={pages} />
    </main>
  );
}

function LibraryBody({
  slug,
  subjects,
  topics,
  pages,
}: {
  slug: string[];
  subjects: Subject[];
  topics: Topic[];
  pages: NotePage[];
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <NoteSearch
        subjects={subjects}
        topics={topics}
        hasUnreviewed={pages.some((page) => page.status !== "digitized")}
        query={query}
        onQuery={setQuery}
      />
      {query.trim() ? null : <LibraryPath slug={slug} subjects={subjects} topics={topics} pages={pages} />}
    </>
  );
}

function LibraryPath({
  slug,
  subjects,
  topics,
  pages,
}: {
  slug: string[];
  subjects: Subject[];
  topics: Topic[];
  pages: NotePage[];
}) {
  if (slug.length === 0) return <SubjectGrid subjects={subjects} pages={pages} />;
  const subject = subjectById(subjects, slug[0]);
  if (!subject) return <Missing label="That subject is not on this device." />;
  if (slug.length === 1) {
    return <TopicList subject={subject} topics={subjectTopics(topics, subject.id)} pages={pages} />;
  }
  const topic = topics.find((item) => item.id === slug[1] && item.subjectId === subject.id);
  if (!topic) return <Missing label="That topic is not on this device." />;
  if (slug.length === 2) {
    return <PageGrid subject={subject} topic={topic} pages={topicPages(pages, topic.id)} />;
  }
  const page = pages.find((item) => item.id === slug[2] && item.topicId === topic.id);
  if (!page) return <Missing label="That page is not on this device." />;
  return <PageRead subject={subject} topic={topic} page={page} />;
}

function Missing({ label }: { label: string }) {
  return (
    <div className="mt-6">
      <p className="text-lg text-ink">{label}</p>
      <div className="mt-4">
        <Button href="/library">Back to subjects</Button>
      </div>
    </div>
  );
}

function SubjectGrid({
  subjects,
  pages,
}: {
  subjects: Subject[];
  pages: NotePage[];
}) {
  const router = useRouter();
  const [rename, setRename] = useState<Subject | null>(null);
  if (subjects.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-lg text-ink">No subjects yet. Scan a page and it will show up here.</p>
        <div className="mt-4">
          <Button href="/scan">Scan a page</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {subjects.map((subject) => {
          const count = pages.filter((page) => page.subjectId === subject.id).length;
          return (
            <li key={subject.id} className="border-2 border-ink bg-paper p-3">
              <Link href={`/library/${subject.id}`} className="block focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-yellow">
                <span aria-hidden className="block h-16 w-16 border-2 border-ink" style={{ background: subject.color }} />
                <span className="mt-3 block text-lg font-semibold text-ink">{subject.name}</span>
                <span className="mt-1 block text-sm text-ink">
                  {count} {count === 1 ? "page" : "pages"}
                </span>
              </Link>
              <button type="button" className="nw-mono mt-3 text-[12px] text-ink underline" onClick={() => setRename(subject)}>
                Rename
              </button>
            </li>
          );
        })}
      </ul>
      <NameDialog
        open={Boolean(rename)}
        title="Rename subject"
        initial={rename?.name ?? ""}
        onCancel={() => setRename(null)}
        onSave={async (name) => {
          if (!rename) return;
          await renameSubject(rename.id, name);
          setRename(null);
          router.refresh();
        }}
      />
    </>
  );
}

function TopicList({ subject, topics, pages }: { subject: Subject; topics: Topic[]; pages: NotePage[] }) {
  const router = useRouter();
  const [rename, setRename] = useState<Topic | null>(null);
  const [remove, setRemove] = useState<Topic | null>(null);
  return (
    <section className="mt-6">
      <Button href="/library" variant="secondary">
        All subjects
      </Button>
      <h2 className="nw-display mt-4 text-[clamp(28px,6vw,48px)] text-ink">{subject.name}</h2>
      <ExportBar subject={subject} pages={pages.filter((page) => page.subjectId === subject.id)} topics={topics} />
      <ListenButton
        subjectName={subject.name}
        pages={pages.filter((page) => page.subjectId === subject.id)}
        topics={topics}
      />
      {topics.length === 0 ? <p className="mt-4 text-lg text-ink">This subject has no topics yet.</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {topics.map((topic) => {
          const count = pages.filter((page) => page.topicId === topic.id).length;
          return (
            <li key={topic.id} className="flex flex-col gap-3 border-2 border-ink bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/library/${subject.id}/${topic.id}`} className="text-lg font-semibold text-ink">
                {topic.name}
                <span className="mt-1 block text-sm font-normal">
                  {count} {count === 1 ? "page" : "pages"}
                </span>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setRename(topic)}>
                  Rename
                </Button>
                <Button type="button" variant="secondary" onClick={() => setRemove(topic)}>
                  Delete topic
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <NameDialog
        open={Boolean(rename)}
        title="Rename topic"
        initial={rename?.name ?? ""}
        onCancel={() => setRename(null)}
        onSave={async (name) => {
          if (!rename) return;
          await renameTopic(rename.id, name);
          setRename(null);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        title="Delete this topic?"
        body="This removes the topic and its pages from this device."
        confirm="Delete topic"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return;
          await deleteTopic(remove.id);
          setRemove(null);
        }}
      />
    </section>
  );
}

function PageGrid({ subject, topic, pages }: { subject: Subject; topic: Topic; pages: NotePage[] }) {
  const [remove, setRemove] = useState<NotePage | null>(null);
  return (
    <section className="mt-6">
      <Button href={`/library/${subject.id}`} variant="secondary">
        {subject.name}
      </Button>
      <h2 className="nw-display mt-4 text-[clamp(28px,6vw,48px)] text-ink">{topic.name}</h2>
      <ExportBar subject={subject} topic={topic} pages={pages} topics={[topic]} />
      <ListenButton subjectName={subject.name} pages={pages} topics={[topic]} />
      {pages.length === 0 ? <p className="mt-4 text-lg text-ink">This topic has no pages yet.</p> : null}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pages.map((page) => (
          <li key={page.id} className="border-2 border-ink bg-paper p-2">
            <Link href={`/library/${subject.id}/${topic.id}/${page.id}`} className="block">
              <Thumb blob={page.imageBlob} />
              <span className="mt-2 block">
                <Chip status={page.status} />
              </span>
            </Link>
            <button type="button" className="nw-mono mt-2 text-[12px] text-ink underline" onClick={() => setRemove(page)}>
              Delete page
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(remove)}
        title="Delete this page?"
        body="This removes the photo and the text from this device."
        confirm="Delete page"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return;
          await deletePage(remove.id);
          setRemove(null);
        }}
      />
    </section>
  );
}

function PageRead({ subject, topic, page }: { subject: Subject; topic: Topic; page: NotePage }) {
  const router = useRouter();
  const [remove, setRemove] = useState(false);
  return (
    <section className="mt-6">
      <Button href={`/library/${subject.id}/${topic.id}`} variant="secondary">
        {topic.name}
      </Button>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="nw-display text-[clamp(28px,6vw,48px)] text-ink">{subject.name}</h2>
        <Chip status={page.status} />
      </div>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <PageImage blob={page.imageBlob} label={`${subject.name} ${topic.name}`} />
        <SpokenText pageId={page.id} text={page.text} />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button href={`/review/${page.id}`}>Edit</Button>
        <Button type="button" variant="secondary" onClick={() => setRemove(true)}>
          Delete page
        </Button>
        <Button type="button" variant="secondary" disabled>
          Tutor, coming next
        </Button>
      </div>
      <ExportBar subject={subject} topic={topic} pages={[page]} topics={[topic]} />
      <ListenButton subjectName={subject.name} pages={[page]} topics={[topic]} />
      <ConfirmDialog
        open={remove}
        title="Delete this page?"
        body="This removes the photo and the text from this device."
        confirm="Delete page"
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          await deletePage(page.id);
          router.push(`/library/${subject.id}/${topic.id}`);
        }}
      />
    </section>
  );
}

function Thumb({ blob }: { blob: Blob }) {
  const url = useMemo(() => (blob.size ? URL.createObjectURL(blob) : ""), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  if (!url) return <span className="grid h-28 place-items-center bg-page text-sm text-ink">No photo</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-28 w-full border-2 border-ink object-cover" />
  );
}

function NameDialog({
  open,
  title,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  return (
    <Modal open={open} onCancel={onCancel} className="is-inset">
      {open ? (
        <NameFields key={initial} title={title} initial={initial} onCancel={onCancel} onSave={onSave} />
      ) : null}
    </Modal>
  );
}

function NameFields({
  title,
  initial,
  onCancel,
  onSave,
}: {
  title: string;
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  return (
    <>
      <h2 className="nw-display text-[clamp(28px,4vw,40px)] text-ink">{title}</h2>
      <label className="mt-4 block">
        <span className="nw-mono text-[12px] text-muted">Name</span>
        <input className="nw-input mt-2 w-full" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={name.trim().length === 0} onClick={() => void onSave(name)}>
          Save name
        </Button>
      </div>
    </>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirm,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Modal open={open} onCancel={onCancel}>
      <h2 className="nw-display text-[clamp(28px,4vw,40px)] text-ink">{title}</h2>
      <p className="mt-3 text-base text-ink">{body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void onConfirm()}>
          {confirm}
        </Button>
      </div>
    </Modal>
  );
}

function Modal({
  open,
  onCancel,
  className,
  children,
}: {
  open: boolean;
  onCancel: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className ? `nw-dialog ${className}` : "nw-dialog"}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {children}
    </dialog>
  );
}
