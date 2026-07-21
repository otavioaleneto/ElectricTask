import { brandDisplay } from "@/lib/subscription-brands";
import { cn } from "@/lib/utils";

interface SubscriptionLogoProps {
  sub: {
    companySlug?: string | null;
    customName?: string | null;
    customColor?: string | null;
  };
  size?: number;
  className?: string;
}

export function SubscriptionLogo({ sub, size = 40, className }: SubscriptionLogoProps) {
  const { name, color, icon: Icon } = brandDisplay(sub);

  if (Icon) {
    return (
      <div
        className={cn(
          "rounded-lg bg-white flex items-center justify-center shrink-0 ring-1 ring-black/5",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Icon color={color} size={Math.round(size * 0.55)} />
      </div>
    );
  }

  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center shrink-0 font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
    </div>
  );
}
