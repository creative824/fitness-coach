/** What the menu card needs, computed on the server from the stored choices. Pure. */
import { choicesFor, mealBySlug, optionPosition, renderSlot, slotKcal, slotLabels, type DayMenu, type DietProfile, type MealChoice, type RenderedMeal, type SlotType } from "./engine";

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
  /** The calories planned for the slot, and whether the user set them by hand. */
  planned: number;
  custom: boolean;
  light: boolean;
  /** Every meal that can go here, scaled to the slot (empty once eaten). */
  choices: MealChoice[];
}

export interface MenuView {
  target: number;
  /** Sum of the slots as planned now (what the menu adds up to). */
  planned: number;
  slots: SlotView[];
}

export function toView(menu: DayMenu, profile: DietProfile): MenuView {
  const labels = slotLabels(menu.slots.map((s) => s.type));
  const slots = menu.slots.map((s, index) => ({
    index,
    type: s.type,
    label: labels[index],
    kcal: slotKcal(s),
    meal: renderSlot(s),
    eaten: Boolean(s.eaten),
    instead: s.eaten?.custom ?? null,
    option: optionPosition(menu, index, profile),
    planned: s.kcal,
    custom: menu.custom?.[index] != null && menu.slots.length === menu.custom.length,
    light: Boolean(mealBySlug(s.meal)?.light),
    choices: s.eaten ? [] : choicesFor(menu, index, profile),
  }));
  return { target: menu.target, planned: slots.reduce((a, s) => a + s.kcal, 0), slots };
}
