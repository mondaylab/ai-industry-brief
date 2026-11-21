export const BRIEF_ITEM_ANCHOR_PREFIX = "brief-item-";

export function briefItemAnchor(sectionIndex, itemIndex) {
  return `${BRIEF_ITEM_ANCHOR_PREFIX}${sectionIndex + 1}-${itemIndex + 1}`;
}
