import { noteBlocks } from "@/lib/export/blocks";
import type { ExportSection } from "@/lib/export/scope";

export async function buildDocx(input: { subject: string; sections: ExportSection[] }) {
  const { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: input.subject, heading: HeadingLevel.HEADING_1 }),
  ];
  let listCount = 0;
  let inList = false;

  for (const section of input.sections) {
    paragraphs.push(new Paragraph({ text: section.topic, heading: HeadingLevel.HEADING_2 }));
    for (const note of section.pages) {
      for (const block of noteBlocks(note.text)) {
        if (block.kind === "number") {
          if (!inList) {
            listCount += 1;
            inList = true;
          }
          paragraphs.push(
            new Paragraph({
              numbering: { reference: `notes-${listCount}`, level: 0 },
              children: [new TextRun(block.text)],
            }),
          );
          continue;
        }
        inList = false;
        if (block.kind === "bullet") {
          paragraphs.push(new Paragraph({ text: block.text, bullet: { level: 0 } }));
          continue;
        }
        paragraphs.push(new Paragraph({ children: [new TextRun(block.text)] }));
      }
      paragraphs.push(new Paragraph({ text: "" }));
    }
  }

  const numbering =
    listCount === 0
      ? undefined
      : {
          config: Array.from({ length: listCount }, (_, index) => ({
            reference: `notes-${index + 1}`,
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          })),
        };

  const document = new Document({
    numbering,
    sections: [{ children: paragraphs }],
  });
  return Packer.toBlob(document);
}
