import type { SVGProps } from "react";

/** Stroke icons (stroke 2, 20–22 px) taken from the reference screens. Decorative by default. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Icon>
);
export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="8" cy="16" r="2" />
  </Icon>
);
export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} size={14} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Icon strokeWidth={2.4} size={16} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} size={22} {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const TrendUpIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Icon>
);
export const WrenchIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z" />
  </Icon>
);
export const ShieldIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
  </Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Icon>
);
export const FuelIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M3 20h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h4" />
  </Icon>
);
export const GearIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const ChevronDownIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const CloudOffIcon = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M3 3l18 18M8.5 8.6A5 5 0 0 0 6 18h11M20.6 16.4A4 4 0 0 0 17 11h-1a6 6 0 0 0-5.3-3.9" />
  </Icon>
);

/** Filled triangle used by the variation badge. */
export const TriangleIcon = ({
  down = false,
  ...p
}: IconProps & { down?: boolean }) => (
  <svg
    width={10}
    height={10}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...p}
  >
    <path d={down ? "M12 21L2 3h20z" : "M12 3l10 18H2z"} />
  </svg>
);
