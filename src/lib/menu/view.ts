/** What the menu card needs, computed on the server from the stored choices. Pure. */
import { optionPosition, renderSlot, slotKcal, SLOT_LABEL, type DayMenu, type DietProfile, type RenderedMeal, type SlotType } from "./engine";

export interface SlotView {
  index: number;
  type: SlotType;
  label: string;
  kcal: number;
  meal: RenderedMeal | null;
  eaten: boolean;
  /** What was eaten instead, when the user logged something else for this slot. */
  instead: { text: string; kcal: number | null } | null;
  option: { at: number; of: number };
}

export interface MenuView {
  target: number;
  /** Sum of the slots as planned now (what the menu adds up to). */
  planned: number;
  slots: SlotView[];
}

export function toView(menu: DayMenu, profile: DietProfile): MenuView {
  const slots = menu.slots.map((s, index) => ({
    index,
    type: s.type,
    label: SLOT_LABEL[s.type],
    kcal: slotKcal(s),
    meal: renderSlot(s),
    eaten: Boolean(s.eaten),
    instead: s.eaten?.custom ?? null,
    option: optionPosition(menu, index, profile),
  }));
  return { target: menu.target, planned: slots.reduce((a, s) => a + s.kcal, 0), slots };
}
