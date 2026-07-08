/** Blue-and-white official partner logos for WattWise */

export function EskomLogo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      {/* Eskom mark: circle + stylised E blades */}
      <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
        <circle cx="19" cy="19" r="17.5" stroke="#005EB8" strokeWidth="2.4" />
        {/* Top blade */}
        <path d="M10 11.5 H24 L24 15 H14 L17.5 18.5 H10 Z" fill="#005EB8" />
        {/* Middle blade */}
        <path d="M10 18.5 H26.5 L26.5 22 H17.5 L21 25.5 H10 Z" fill="#005EB8" />
        {/* Bottom bar */}
        <path d="M10 25.5 H24 L24 29 H10 Z" fill="#005EB8" />
      </svg>
      <span
        style={{
          fontSize: 22,
          fontWeight: 400,
          color: "#005EB8",
          letterSpacing: "-0.015em",
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          lineHeight: 1,
        }}
      >
        Eskom
      </span>
    </div>
  );
}

export function GautengLogo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`} aria-label="Gauteng Provincial Government, Republic of South Africa">
      {/* Simplified shield badge */}
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" aria-hidden="true">
        {/* Shield body */}
        <path d="M2 2 H32 V28 L17 42 L2 28 Z" fill="#005EB8" />
        {/* White horizontal bars */}
        <rect x="8" y="10" width="18" height="3.5" fill="white" rx="0.5" />
        <rect x="8" y="16" width="18" height="3.5" fill="white" rx="0.5" />
        <rect x="8" y="22" width="18" height="3.5" fill="white" rx="0.5" />
        {/* Vertical spear element */}
        <rect x="15.2" y="5" width="3.6" height="25" fill="white" rx="1" />
      </svg>
      <div style={{ lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 900,
            color: "#005EB8",
            letterSpacing: "0.12em",
            fontFamily: "Arial, sans-serif",
          }}
        >
          GAUTENG
        </div>
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 600,
            color: "#005EB8",
            letterSpacing: "0.06em",
            fontFamily: "Arial, sans-serif",
          }}
        >
          PROVINCIAL GOVERNMENT
        </div>
        <div
          style={{
            fontSize: 6.5,
            color: "#005EB8",
            letterSpacing: "0.04em",
            fontFamily: "Arial, sans-serif",
          }}
        >
          REPUBLIC OF SOUTH AFRICA
        </div>
      </div>
    </div>
  );
}
