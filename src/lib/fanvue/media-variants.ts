type MediaVariant = {
  variantType?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  lengthMs?: number | null;
};

function normalizedVariantType(value?: string) {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function selectMediaVariants(variants: MediaVariant[]) {
  const available = variants.filter(
    (variant): variant is MediaVariant & { url: string } => Boolean(variant.url),
  );
  const main = available.find((variant) => {
    const type = normalizedVariantType(variant.variantType);
    return type === "main" || type === "original" || type === "source";
  }) ?? available.find((variant) => !normalizedVariantType(variant.variantType).includes("thumbnail")) ?? available[0];
  const thumbnail = available.find((variant) => {
    const type = normalizedVariantType(variant.variantType);
    return type === "thumbnail" || type === "thumbnailgallery" || type.includes("thumb");
  });

  return { main, thumbnail };
}
