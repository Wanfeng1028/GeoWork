import type { CSSProperties } from "react";

type Variant = "on-light" | "on-dark" | "gradient";
type Layout = "horizontal" | "stacked" | "symbol" | "wordmark";

export interface GeoWorkLogoProps {
  variant?: Variant;
  layout?: Layout;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}

export function GeoWorkLogo({
  variant = "on-light",
  layout = "horizontal",
  height = 32,
  className,
  style,
  alt = "GeoWork",
}: GeoWorkLogoProps) {
  const file = layout === "symbol"
    ? `geowork-symbol-${variant}.svg`
    : layout === "wordmark"
      ? `geowork-wordmark-${variant}.svg`
      : `geowork-logo-${layout}-${variant}.svg`;

  return (
    <img
      src={`/brand/${file}`}
      alt={alt}
      className={className}
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );
}
