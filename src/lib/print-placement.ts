/** Gildan 5000 front print box, the size Printify lists as 3951×4919 px at 300 DPI. */
export const TEE_PRINT_AREA = {
  widthPx: 3951,
  heightPx: 4919,
  dpi: 300,
} as const;

export function pixelsForInches(inches: number, dpi: number) {
  if (!Number.isFinite(inches) || !Number.isFinite(dpi) || inches <= 0 || dpi <= 0) return 0;
  return Math.round(inches * dpi);
}

export function effectiveDpi(pixels: number, inches: number) {
  if (!Number.isFinite(pixels) || !Number.isFinite(inches) || inches <= 0) return 0;
  return Math.round(pixels / inches);
}

export function teePrintInches() {
  return {
    width: TEE_PRINT_AREA.widthPx / TEE_PRINT_AREA.dpi,
    height: TEE_PRINT_AREA.heightPx / TEE_PRINT_AREA.dpi,
  };
}
