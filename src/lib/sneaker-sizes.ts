export type SneakerSizeRow = {
  printifyId: number;
  size: string;
  sizeUid: string;
};

/** Printify blueprint 1072 · Smart Printee 90 · White sole US sizes. */
export const SNEAKER_WHITE_SOLE: readonly SneakerSizeRow[] = [
  { printifyId: 80915, size: "US 5", sizeUid: "5" },
  { printifyId: 80917, size: "US 6", sizeUid: "6" },
  { printifyId: 80919, size: "US 7", sizeUid: "7" },
  { printifyId: 80921, size: "US 7.5", sizeUid: "7-5" },
  { printifyId: 80923, size: "US 8.5", sizeUid: "8-5" },
  { printifyId: 80925, size: "US 9.5", sizeUid: "9-5" },
  { printifyId: 80927, size: "US 10", sizeUid: "10" },
  { printifyId: 80929, size: "US 11", sizeUid: "11" },
  { printifyId: 80931, size: "US 12", sizeUid: "12" },
];

/** Printify blueprint 1219 · Smart Printee 90 · Women’s white sole US sizes. */
export const SNEAKER_WOMENS_WHITE_SOLE: readonly SneakerSizeRow[] = [
  { printifyId: 92343, size: "US 5.5", sizeUid: "5-5" },
  { printifyId: 92344, size: "US 6", sizeUid: "6" },
  { printifyId: 92345, size: "US 7", sizeUid: "7" },
  { printifyId: 92346, size: "US 8", sizeUid: "8" },
  { printifyId: 92347, size: "US 9", sizeUid: "9" },
  { printifyId: 92348, size: "US 10", sizeUid: "10" },
  { printifyId: 92349, size: "US 11", sizeUid: "11" },
  { printifyId: 92350, size: "US 11.5", sizeUid: "11-5" },
  { printifyId: 92351, size: "US 12", sizeUid: "12" },
];

export const SNEAKER_WHITE_SOLE_IDS = SNEAKER_WHITE_SOLE.map((row) => row.printifyId);
export const SNEAKER_WHITE_SOLE_DEFAULT = 80925;
export const SNEAKER_DEFAULT_SIZE_UID = "9-5";
export const SNEAKER_WOMENS_WHITE_SOLE_DEFAULT = 92346;
export const SNEAKER_WOMENS_DEFAULT_SIZE_UID = "8";
