import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiscountBadgeProps {
  discountPercentage?: number;
  discountAmount?: number;
  originalPrice?: number;
  finalPrice?: number;
  promoName?: string;
  size?: "sm" | "md" | "lg";
  variant?: "floating" | "inline" | "corner";
  showPromoName?: boolean;
  animated?: boolean;
}

export function DiscountBadge({
  discountPercentage = 0,
  discountAmount = 0,
  originalPrice,
  finalPrice,
  promoName,
  size = "md",
  variant = "inline",
  showPromoName = false,
  animated = true,
}: DiscountBadgeProps) {
  // Ensure values are valid numbers
  const validDiscountPercentage = typeof discountPercentage === 'number' && !isNaN(discountPercentage) 
    ? discountPercentage 
    : 0;
  const validDiscountAmount = typeof discountAmount === 'number' && !isNaN(discountAmount) 
    ? discountAmount 
    : 0;

  const hasDiscount = validDiscountPercentage > 0 || validDiscountAmount > 0;

  if (!hasDiscount) return null;

  const sizeClasses = {
    sm: "text-[9px] px-1.5 py-0.5 gap-0.5",
    md: "text-xs px-2 py-1 gap-1",
    lg: "text-sm px-3 py-1.5 gap-1.5",
  };

  const variantClasses = {
    floating: "absolute top-2 left-2 z-10 shadow-lg",
    inline: "inline-flex",
    corner: "absolute top-0 right-0 rounded-tl-none rounded-br-none",
  };

  const iconSize = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div className={cn("relative", variant === "floating" || variant === "corner" ? "absolute" : "")}>
      <Badge
        className={cn(
          "font-bold",
          "bg-red-600 text-white border border-red-400/40",
          "flex items-center",
          "shadow-md",
          sizeClasses[size],
          variantClasses[variant],
          animated && "animate-pulse hover:animate-none",
          "transition-all duration-300 ease-out",
          "hover:scale-105 hover:shadow-lg hover:shadow-red-500/30",
          "hover:border-red-300 hover:bg-red-500",
          "cursor-default",
          "relative overflow-hidden",
          "before:absolute before:inset-0",
          "before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent",
          "before:animate-[shimmer_3s_ease-in-out_infinite]"
        )}
      >
        <span className="font-extrabold uppercase tracking-wide relative z-10">
          {validDiscountPercentage > 0 
            ? `-${validDiscountPercentage}%` 
            : `-₱${validDiscountAmount.toFixed(0)}`}
        </span>
      </Badge>

      {showPromoName && promoName && (
        <Badge
          variant="secondary"
          className={cn(
            "mt-1 block",
            sizeClasses[size],
            "bg-red-50 text-red-700 border-red-200",
            "hover:bg-red-100"
          )}
        >
          <Tag size={iconSize[size]} />
          <span className="truncate max-w-[120px]">{promoName}</span>
        </Badge>
      )}
    </div>
  );
}

interface PriceDisplayProps {
  originalPrice: number;
  finalPrice?: number;
  discountAmount?: number;
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "vertical";
  showSavings?: boolean;
}

export function PriceDisplay({
  originalPrice,
  finalPrice,
  discountAmount = 0,
  size = "md",
  layout = "horizontal",
  showSavings = true,
}: PriceDisplayProps) {
  const hasDiscount = finalPrice && finalPrice < originalPrice;
  
  // Ensure discount amount is a valid number
  const validDiscountAmount = typeof discountAmount === 'number' && !isNaN(discountAmount) 
    ? discountAmount 
    : 0;

  const textSizes = {
    sm: {
      original: "text-xs",
      final: "text-sm",
      savings: "text-[10px]",
    },
    md: {
      original: "text-sm",
      final: "text-lg",
      savings: "text-xs",
    },
    lg: {
      original: "text-base",
      final: "text-2xl",
      savings: "text-sm",
    },
  };

  if (!hasDiscount) {
    return (
      <div className={cn("font-bold text-slate-900", textSizes[size].final)}>
        ₱{originalPrice.toFixed(2)}
      </div>
    );
  }

  return (
    <div className={cn("flex", layout === "vertical" ? "flex-col gap-1" : "items-center gap-2")}>
      {/* Original Price (Strikethrough) */}
      <div
        className={cn(
          "text-muted-foreground line-through",
          textSizes[size].original
        )}
      >
        ₱{originalPrice.toFixed(2)}
      </div>

      {/* Final Price */}
      <div className={cn("font-bold text-accent", textSizes[size].final)}>
        ₱{finalPrice?.toFixed(2)}
      </div>

      {/* Savings Display */}
      {showSavings && validDiscountAmount > 0 && (
        <div
          className={cn(
            "text-accent/70 font-medium",
            textSizes[size].savings,
            layout === "vertical" && "justify-start"
          )}
        >
          <span>Save ₱{validDiscountAmount.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

interface SaleBannerProps {
  promoName?: string;
  discountPercentage?: number;
  discountAmount?: number;
  size?: "sm" | "md" | "lg";
  position?: "top" | "bottom" | "overlay";
  className?: string;
}

export function SaleBanner({ 
  promoName, 
  discountPercentage, 
  discountAmount,
  size = "md",
  position = "top",
  className 
}: SaleBannerProps) {
  if (!promoName && !discountPercentage && !discountAmount) return null;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1.5",
    md: "px-3 py-1 text-xs gap-2",
    lg: "px-4 py-1.5 text-sm gap-2.5"
  };

  const positionClasses = {
    top: "rounded-b",
    bottom: "rounded-t",
    overlay: "rounded"
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-gradient-to-r from-red-600 via-red-500 to-red-600",
        "text-white",
        "flex items-center justify-between",
        "shadow-md font-semibold",
        "border-b border-red-400/50",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:shadow-red-500/30",
        "hover:border-red-300",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "before:animate-[shimmer_3s_ease-in-out_infinite]",
        sizeClasses[size],
        positionClasses[position],
        className
      )}
    >
      <span className="uppercase tracking-wider font-bold relative z-10">
        {promoName || "SALE"}
      </span>
      <span className="font-extrabold relative z-10">
        {discountPercentage && discountPercentage > 0 
          ? `-${discountPercentage}%`
          : discountAmount && discountAmount > 0
          ? `-₱${discountAmount}`
          : ""}
      </span>
    </div>
  );
}
