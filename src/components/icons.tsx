"use client";

import {
  AirplaneIcon,
  ArrowsLeftRightIcon,
  BabyIcon,
  BankIcon,
  BasketIcon,
  BeerSteinIcon,
  BooksIcon,
  BowlFoodIcon,
  BriefcaseIcon,
  CarIcon,
  ChartLineUpIcon,
  CoffeeIcon,
  CoinsIcon,
  CreditCardIcon,
  DogIcon,
  EnvelopeSimpleIcon,
  FilmSlateIcon,
  GiftIcon,
  HandCoinsIcon,
  HouseIcon,
  MoneyIcon,
  MopedIcon,
  PackageIcon,
  PiggyBankIcon,
  PillIcon,
  PlantIcon,
  QuestionIcon,
  RepeatIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  TrainIcon,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Categories store an emoji (so users can type any). Known emojis render as a vector icon.
const ICON_BY_EMOJI: Record<string, Icon> = {
  "🍚": BowlFoodIcon,
  "☕": CoffeeIcon,
  "🛵": MopedIcon,
  "🚇": TrainIcon,
  "🧺": BasketIcon,
  "🛍": ShoppingBagIcon,
  "🏠": HouseIcon,
  "🔁": RepeatIcon,
  "🎬": FilmSlateIcon,
  "💊": PillIcon,
  "📚": BooksIcon,
  "🎁": GiftIcon,
  "📦": PackageIcon,
  "💼": BriefcaseIcon,
  "💰": HandCoinsIcon,
  "🧧": EnvelopeSimpleIcon,
  "📈": ChartLineUpIcon,
  "🐶": DogIcon,
  "👶": BabyIcon,
  "💇": ScissorsIcon,
  "🍺": BeerSteinIcon,
  "✈": AirplaneIcon,
  "🚗": CarIcon,
  "💳": CreditCardIcon,
  "🪙": CoinsIcon,
  "❔": QuestionIcon,
};

/** Emojis that have an icon, in picker order. */
export const ICON_EMOJIS = Object.keys(ICON_BY_EMOJI)
  .filter((e) => e !== "❔")
  .map((e) => (e === "🛍" || e === "✈" ? `${e}️` : e));

function iconFor(emoji: string | null | undefined): Icon | null {
  if (!emoji) return null;
  return ICON_BY_EMOJI[emoji.replace(/️/g, "")] ?? null;
}

const WALLET_ICONS = { cash: MoneyIcon, bank: BankIcon, card: CreditCardIcon, invest: PlantIcon, other: PiggyBankIcon } as const;

/**
 * A small tile tinted with the category colour (12% over the surface) carrying the duotone glyph in
 * that colour. The glyph leans 15% toward --foreground so light colours (yellow, slate) stay legible
 * in light mode and deep ones lift in dark mode. Size it with a size-* class; the radius scales with it
 * (about 8–10px at 30–36px).
 */
function Tile({
  icon: Glyph,
  fallback,
  color,
  className,
}: {
  icon: Icon | null;
  fallback?: string;
  color?: string | null;
  className?: string;
}) {
  const base = color ?? "var(--ink-3)";
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[27%]", className)}
      style={{
        backgroundColor: `color-mix(in oklch, ${base} 12%, var(--card))`,
        color: `color-mix(in oklch, ${base} 85%, var(--foreground))`,
      }}
    >
      {Glyph ? <Glyph weight="duotone" className="size-[54%]" /> : <span className="text-[1.05em] leading-none">{fallback}</span>}
    </span>
  );
}

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string | null;
  color?: string | null;
  className?: string;
}) {
  return <Tile icon={iconFor(icon)} fallback={icon ?? "·"} color={color} className={className} />;
}

export function TransferIcon({ className }: { className?: string }) {
  return <Tile icon={ArrowsLeftRightIcon} className={className} />;
}

export function WalletIcon({
  kind,
  color,
  className,
}: {
  kind: keyof typeof WALLET_ICONS;
  color?: string;
  className?: string;
}) {
  return <Tile icon={WALLET_ICONS[kind]} color={color} className={className} />;
}
