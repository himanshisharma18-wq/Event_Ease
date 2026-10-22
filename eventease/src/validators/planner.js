import { z } from "zod";

const validCalendarDay = (value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const isCurrentOrFutureDay = (value) => {
  if (!value) return true;
  const selected = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return selected >= today;
};

export const plannerInputSchema = z.object({
  eventType: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).default(""),
  country: z.string().trim().max(80).default(""),
  format: z.enum(["in-person", "online"]).default("in-person"),
  date: z
    .string()
    .optional()
    .default("")
    .refine(validCalendarDay, "Enter a real event date in YYYY-MM-DD format.")
    .refine(
      isCurrentOrFutureDay,
      "Choose today or a future date, or leave it blank.",
    ),
  durationHours: z.coerce.number().int().min(1).max(36).default(4),
  guests: z.coerce.number().int().min(1).max(50000),
  budget: z.coerce.number().min(0).max(100000000).default(0),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("INR"),
  style: z.string().trim().max(100).default(""),
  atmosphere: z.string().trim().max(160).default(""),
  setting: z.enum(["indoor", "outdoor", "either"]).default("either"),
  food: z.string().trim().max(300).default(""),
  dietary: z.string().trim().max(500).default(""),
  decor: z.string().trim().max(300).default(""),
  entertainment: z.string().trim().max(300).default(""),
  accessibility: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(1000).default(""),
});

export const planSchema = z.object({
  concept: z.object({
    title: z.string(),
    summary: z.string(),
    palette: z.array(z.string()).max(8),
    mood: z.string(),
  }),
  venue: z.object({
    requirements: z.array(z.string()),
    selectionTips: z.array(z.string()),
  }),
  food: z.object({
    approach: z.string(),
    ideas: z.array(z.string()),
    dietaryNotes: z.array(z.string()),
  }),
  entertainment: z.array(z.string()),
  schedule: z.array(z.object({ time: z.string(), activity: z.string() })),
  budget: z.array(
    z.object({
      category: z.string(),
      estimated: z.number().min(0),
      note: z.string(),
    }),
  ),
  guestChecklist: z.array(z.string()),
  shoppingList: z.array(z.string()),
  preparationTimeline: z.array(
    z.object({ when: z.string(), task: z.string() }),
  ),
  contingencies: z.array(z.string()),
  sustainableAlternatives: z.array(z.string()),
});
