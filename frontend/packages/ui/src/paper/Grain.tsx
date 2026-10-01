/**
 * The one static grain layer over everything but the cursor (brief 4.4).
 * Multiply on Paper, screen on Night; follows the page world via CSS.
 */
export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="kitty-grain"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-grain)" as unknown as number,
        pointerEvents: "none",
        backgroundImage: "url(/grain.webp)",
        backgroundSize: "256px 256px",
      }}
    />
  );
}
