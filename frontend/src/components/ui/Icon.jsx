const iconPaths = {
  dashboard: [
    "M4 5.5h6.5v6H4z",
    "M13.5 5.5H20v3.75h-6.5z",
    "M13.5 12.25H20v6.25h-6.5z",
    "M4 14.5h6.5v4H4z",
  ],
  import: ["M12 4v10", "M8 10l4 4 4-4", "M5 19h14"],
  products: ["M4.5 8.5 12 4l7.5 4.5v7L12 20l-7.5-4.5z", "M4.5 8.5 12 13l7.5-4.5", "M12 13v7"],
  opportunities: ["M12 3.75l2.1 5.1 5.5.45-4.2 3.55 1.3 5.4L12 15.35 7.3 18.25l1.3-5.4-4.2-3.55 5.5-.45z"],
  marketplaces: ["M4 7.5h16", "M6 7.5l1.2-3h9.6l1.2 3", "M6 10v9h12v-9", "M9 19v-5h6v5"],
  mercadolivre: ["M5 9.5c2.6-3 4.7-3 7 0 2.3-3 4.4-3 7 0", "M5.5 13.5c2.3 3.5 10.7 3.5 13 0", "M8 11.25h8"],
  ads: ["M5 5h14v14H5z", "M8 9h8", "M8 12h6", "M8 15h4"],
  settings: ["M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z", "M19 12h2", "M3 12h2", "M12 3v2", "M12 19v2", "M17.35 6.65l1.4-1.4", "M5.25 18.75l1.4-1.4", "M17.35 17.35l1.4 1.4", "M5.25 5.25l1.4 1.4"],
  search: ["M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z", "M16 16l5 5"],
  upload: ["M12 19V5", "M7 10l5-5 5 5", "M5 19h14"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M4.9 4.9 7 7", "M17 17l2.1 2.1", "M19.1 4.9 17 7", "M7 17l-2.1 2.1"],
  moon: ["M20 15.5A8.5 8.5 0 0 1 8.5 4 7.25 7.25 0 1 0 20 15.5z"],
  connect: ["M8.5 12h7", "M6.5 8.5 3 12l3.5 3.5", "M17.5 8.5 21 12l-3.5 3.5"],
  sync: ["M19 7v5h-5", "M5 17v-5h5", "M18 12a6 6 0 0 0-10.4-4.1", "M6 12a6 6 0 0 0 10.4 4.1"],
  bolt: ["M13 3 5.5 13h5L9 21l8-11h-5z"],
  wand: ["M15 4l5 5", "M14 10l-8 8-2-2 8-8z", "M4 5h3", "M5.5 3.5v3", "M18 16h3", "M19.5 14.5v3"],
  file: ["M6 3.5h8l4 4V20H6z", "M14 3.5v4h4", "M8.5 12h7", "M8.5 15h5"],
  attributes: ["M5 7h14", "M5 12h14", "M5 17h14", "M8 5v4", "M16 10v4", "M11 15v4"],
  publish: ["M12 17V5", "M8 9l4-4 4 4", "M5 19h14"],
  price: ["M12 4v16", "M17 7.5c-.9-1.2-2.4-2-4.4-2-2.5 0-4.1 1.1-4.1 2.9 0 4.3 9 2 9 6.3 0 2-1.7 3.3-4.8 3.3-2.3 0-4.1-.7-5.2-2.1"],
  inventory: ["M5 7h14v12H5z", "M5 7l2-3h10l2 3", "M9 11h6"],
  chat: ["M5 5h14v10H8l-3 3z", "M8 9h8", "M8 12h5"],
  audit: ["M6 4h12v16H6z", "M9 8h6", "M9 12h6", "M9 16h3"],
  arrowUp: ["M12 19V5", "M7 10l5-5 5 5"],
  paperclip: ["M8 12.5l5.8-5.8a3 3 0 1 1 4.2 4.2l-7.1 7.1a5 5 0 1 1-7.1-7.1l7.4-7.4"],
  plus: ["M12 5v14", "M5 12h14"],
  grip: ["M9 6h.01", "M15 6h.01", "M9 12h.01", "M15 12h.01", "M9 18h.01", "M15 18h.01"],
  check: ["M5 12.5l4 4L19 6.5"],
  alert: ["M12 4l8 15H4z", "M12 9v4", "M12 16h.01"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  close: ["M6 6l12 12", "M18 6 6 18"],
};

export function Icon({ name, size = 18, className = "", title = null, strokeWidth = 1.75 }) {
  const paths = iconPaths[name] || iconPaths.spark;
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : "true"}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((path, index) => (
        <path key={`${name}-${index}`} d={path} />
      ))}
    </svg>
  );
}

export default Icon;
