/**
 * Author: Leonardo Rodriguez
 *
 * Description:
 * Badge component for status indicators and labels.
 * Supports multiple color variants and sizes with design tokens.
 * Mobile-first responsive from 320px.
 *
 * @param variant - Color variant (primary, secondary, success, warning, neutral)
 * @param size - Badge size (small, medium, large)
 * @param rounded - Fully rounded pill shape (default: true)
 * @returns React Badge element
 */

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "neutral";
type BadgeSize = "small" | "medium" | "large";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  rounded?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: "bg-primary-50 text-primary-500 border-primary-200",
  secondary: "bg-secondary-50 text-secondary-500 border-secondary-200",
  success: "bg-green-100 text-green-800 border-green-300",
  warning: "bg-red-100 text-red-800 border-red-300",
  neutral: "bg-gray-100 text-gray-700 border-gray-300",
};

const sizeClasses: Record<BadgeSize, string> = {
  small: "px-2 py-0.5 text-xs",
  medium: "px-2.5 py-1 text-xs",
  large: "px-3 py-1 text-sm",
};

export default function Badge({
  children,
  variant = "primary",
  size = "medium",
  rounded = true,
  className = "",
}: BadgeProps) {
  const classes = [
    "inline-flex items-center font-medium border",
    variantClasses[variant],
    sizeClasses[size],
    rounded ? "rounded-full" : "rounded-md",
    className,
  ].join(" ");

  return <span className={classes}>{children}</span>;
}
