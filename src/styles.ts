// src/styles.ts
import type React from "react";

export const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    paddingBottom: 48,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    color: "#eaeaea",
    background: "radial-gradient(1200px 800px at 20% 0%, #141414 0%, #0a0a0a 55%, #000 100%)",
    alignItems: "stretch",
    boxSizing: "border-box",
  },

  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(260px, 1fr))",
    gap: 12,
    alignItems: "stretch",
    justifyItems: "stretch",
    width: "100%",
  },

  timersSection: {
    marginTop: 36,
  },

  card: {
    border: "1px solid #333",
    borderRadius: 12,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  cardStretch: {
    border: "1px solid #333",
    borderRadius: 12,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },

  cardBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  cardFooter: {
    marginTop: "auto",
    paddingTop: 12,
  },

  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
    margin: "12px 0",
  },

  subCard: {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(255,255,255,0.015)",
  },

  titleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    minWidth: 0,
  },

  h2: { margin: 0, fontSize: 22, letterSpacing: 0.2 },
  h3: { margin: 0, fontSize: 18, letterSpacing: 0.2 },
  sub: { opacity: 0.75, fontSize: 12 },
  muted: { opacity: 0.75 },

  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: { fontSize: 13, opacity: 0.9 },

  input: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #444",
    background: "linear-gradient(180deg, #101010 0%, #0c0c0c 100%)",
    color: "#eaeaea",
    padding: "0 10px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },

  select: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #444",
    background: "linear-gradient(180deg, #101010 0%, #0c0c0c 100%)",
    color: "#eaeaea",
    padding: "0 10px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",

    // ✅ Key: makes the dropdown list render dark in Chromium/Electron
    colorScheme: "dark",
  },

  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },

  button: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #555",
    background: "linear-gradient(180deg, #1a1a1a 0%, #111 100%)",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    whiteSpace: "nowrap",
  },

  buttonPrimary: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #6b6b6b",
    background: "linear-gradient(180deg, #2b2b2b 0%, #1c1c1c 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
    whiteSpace: "nowrap",
  },

  compactRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
  },

  timerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 10,
    paddingBottom: 12,
    alignContent: "start",
    alignItems: "start",
    justifyItems: "stretch",
    width: "100%",
  },

  timerItem: {
    border: "1px solid #444",
    borderRadius: 10,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.25)",
    minWidth: 0,
    boxSizing: "border-box",
  },

  timerTop: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  timerLabel: { fontWeight: 800 },
};
