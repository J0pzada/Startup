export function ThemeToggle({ theme, onToggle, label }) {
  const isDark = theme === "dark";

  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Alternar tema" title={`Tema ${label}`}>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className={`theme-toggle-thumb ${isDark ? "is-dark" : "is-light"}`}>{isDark ? "D" : "L"}</span>
      </span>
      <span className="theme-toggle-label">Tema {label}</span>
    </button>
  );
}
