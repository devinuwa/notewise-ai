import { ImageResponse } from "next/og";

export const alt = "NoteWise AI — Your notebook, made smarter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#3d5f58",
          color: "#f2f2eb",
          padding: "64px",
          border: "12px solid #231f20",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontFamily: "monospace" }}>
          <div style={{ display: "flex", width: 40, height: 40, flexWrap: "wrap" }}>
            <div style={{ width: 18, height: 18, background: "#f2f2eb" }} />
            <div style={{ width: 18, height: 18, background: "#e53927" }} />
            <div style={{ width: 18, height: 18, background: "#f5b726" }} />
            <div style={{ width: 18, height: 18, background: "#8bb2de" }} />
          </div>
          NOTEWISE AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.02, maxWidth: 900 }}>
            Your notebook, made smarter.
          </div>
          <div style={{ fontSize: 28, maxWidth: 820, color: "#f2f2eb" }}>
            Photograph handwritten notes. Search, listen, ask, and practise — free, with no account.
          </div>
        </div>
        <div style={{ fontSize: 22, fontFamily: "monospace", color: "#8bb2de" }}>HIASFEST 2027 · Category L</div>
      </div>
    ),
    { ...size },
  );
}
