import trainHero from "../assets/train-hero.svg";

// Fixed, low-opacity futuristic background: a HUD-style grid layer plus a
// glowing bullet-train illustration anchored bottom-right. Sits behind all
// page content (z-index 0) — pages wrap their content in a `relative z-10`
// container so it always reads clearly on top.
export default function TrainBackground() {
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
      <div className="hud-grid" style={{ position: "absolute", inset: 0, opacity: 0.6 }} />
      <img
        src={trainHero}
        alt=""
        style={{
          position: "absolute",
          right: "-4%",
          bottom: "-6%",
          width: "min(70vw, 900px)",
          opacity: 0.16,
          filter: "drop-shadow(0 0 40px rgba(34,229,234,0.25))",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
