import { redirect } from "next/navigation";

/** The food diary now lives in tracking ("יום האוכל שלי"); old links land there. */
export default function FoodPage() {
  redirect("/progress?r=day");
}
