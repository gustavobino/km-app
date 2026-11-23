import { splitBRL, type Cents } from "@/lib/money";
import { cn } from "@/lib/cn";

type HeroMoneyProps = {
  value: Cents;
  /** "md" = 60/32 px (Painel), "lg" = 64/34 px (Lucro líquido). */
  size?: "md" | "lg";
  className?: string;
};

/**
 * The hero value: "R$" 26 px / integer 60–64 px / cents 32–34 px, one line,
 * aligned by the baseline. Screen readers get the plain value.
 */
export function HeroMoney({ value, size = "md", className }: HeroMoneyProps) {
  const { negative, integer, cents } = splitBRL(value);
  const label = `${negative ? "menos " : ""}R$ ${integer},${cents}`;
  return (
    <div
      className={cn(
        "flex items-baseline font-display leading-none font-extrabold tracking-hero",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="flex items-baseline">
        <span className="mr-1.5 text-hero-currency font-bold tracking-[-0.01em]">
          {negative ? "− " : ""}R$
        </span>
        <span className={size === "lg" ? "text-hero-int-lg" : "text-hero-int"}>
          {integer}
        </span>
        <span
          className={size === "lg" ? "text-hero-cents-lg" : "text-hero-cents"}
        >
          ,{cents}
        </span>
      </span>
    </div>
  );
}
