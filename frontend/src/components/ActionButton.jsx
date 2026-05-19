const variantMap = {
  primary: "action-button-primary",
  outline: "action-button-outline",
  glass: "action-button-glass",
  danger: "action-button-danger",
  success: "action-button-success",
  ghost: "action-button-ghost",
};

const sizeMap = {
  sm: "action-button-sm",
  md: "action-button-md",
  lg: "action-button-lg",
};

export function ActionButton({
  children,
  variant = "primary",
  size = "md",
  icon = null,
  className = "",
  as: Component = "button",
  type = "button",
  ...props
}) {
  const classes = [
    "action-button",
    variantMap[variant] || variantMap.primary,
    sizeMap[size] || sizeMap.md,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const componentProps = Component === "button" ? { type, ...props } : props;

  return (
    <Component className={classes} {...componentProps}>
      <span className="action-button-scan" aria-hidden="true" />
      {icon ? (
        <span className="action-button-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="action-button-label">{children}</span>
    </Component>
  );
}
