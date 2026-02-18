import React from "react";

type Props = {
  enabled: boolean;
  lines: string[];
  onClear: () => void;
  onToggleHidden: () => void;
  hidden: boolean;
};

export default function MobileLogOverlay({
  enabled,
  lines,
  onClear,
  onToggleHidden,
  hidden,
}: Props) {
  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          background: "rgba(0,0,0,0.85)",
          color: "#ddd",
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <strong style={{ color: "#fff" }}>Mobile Log</strong>

        <button
          onClick={onClear}
          style={{
            pointerEvents: "auto",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          Clear
        </button>

        <button
          onClick={onToggleHidden}
          style={{
            pointerEvents: "auto",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {hidden ? "Show" : "Hide"}
        </button>

        <span style={{ marginLeft: "auto", opacity: 0.75 }}>
          lines: {lines.length}
        </span>
      </div>

      {!hidden && (
        <div
          style={{
            pointerEvents: "auto",
            maxHeight: "38vh",
            overflowY: "auto",
            background: "rgba(0,0,0,0.85)",
            color: "#8cf58c",
            padding: "8px 10px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {lines.slice(-400).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
