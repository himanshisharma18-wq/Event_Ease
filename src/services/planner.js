import { GoogleGenAI } from "@google/genai";
import { planSchema } from "../validators/planner.js";
import { geminiModel } from "../config/env.js";

const responseSchema = {
  type: "object",
  properties: {
    concept: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        palette: { type: "array", items: { type: "string" } },
        mood: { type: "string" },
      },
      required: ["title", "summary", "palette", "mood"],
    },
    venue: {
      type: "object",
      properties: {
        requirements: { type: "array", items: { type: "string" } },
        selectionTips: { type: "array", items: { type: "string" } },
      },
      required: ["requirements", "selectionTips"],
    },
    food: {
      type: "object",
      properties: {
        approach: { type: "string" },
        ideas: { type: "array", items: { type: "string" } },
        dietaryNotes: { type: "array", items: { type: "string" } },
      },
      required: ["approach", "ideas", "dietaryNotes"],
    },
    entertainment: { type: "array", items: { type: "string" } },
    schedule: {
      type: "array",
      items: {
        type: "object",
        properties: { time: { type: "string" }, activity: { type: "string" } },
        required: ["time", "activity"],
      },
    },
    budget: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          estimated: { type: "number" },
          note: { type: "string" },
        },
        required: ["category", "estimated", "note"],
      },
    },
    guestChecklist: { type: "array", items: { type: "string" } },
    shoppingList: { type: "array", items: { type: "string" } },
    preparationTimeline: {
      type: "array",
      items: {
        type: "object",
        properties: { when: { type: "string" }, task: { type: "string" } },
        required: ["when", "task"],
      },
    },
    contingencies: { type: "array", items: { type: "string" } },
    sustainableAlternatives: { type: "array", items: { type: "string" } },
  },
  required: [
    "concept",
    "venue",
    "food",
    "entertainment",
    "schedule",
    "budget",
    "guestChecklist",
    "shoppingList",
    "preparationTimeline",
    "contingencies",
    "sustainableAlternatives",
  ],
};

export function buildFallbackPlan(input) {
  const total = Number(input.budget) || 0;
  const shares = [
    ["Venue", 0.28],
    ["Food & drinks", 0.3],
    ["Decor", 0.12],
    ["Entertainment", 0.12],
    ["Travel", 0.08],
    ["Gifts & extras", 0.1],
  ];
  const budget = shares.map(([category, share]) => ({
    category,
    estimated: Math.round(total * share),
    note: "Planning estimate only; local quotes may differ.",
  }));
  const start = input.date ? new Date(`${input.date}T00:00:00`) : null;
  const days =
    start && !Number.isNaN(start.valueOf())
      ? Math.ceil((start - new Date()) / 86400000)
      : null;
  const timeline = [
    {
      when: "4–6 weeks before",
      task: "Confirm the guest list, venue needs and a comfortable budget ceiling.",
    },
    {
      when: "2–3 weeks before",
      task: "Check dietary and access needs; confirm the food plan and any hired help.",
    },
    {
      when: "1 week before",
      task: "Reconfirm timings, weather backup and the shared arrival details.",
    },
    {
      when: "The day before",
      task: "Pack a small essentials kit and keep the setup list somewhere visible.",
    },
  ];
  if (days !== null && days < 28)
    timeline.unshift({
      when: `${Math.max(1, days)} days out`,
      task: "Your date is getting close. Confirm the most important details first, then simplify anything still uncertain.",
    });
  const palette = input.eventType.toLowerCase().includes("holi")
    ? ["Marigold", "Leaf green", "Warm white"]
    : ["Ink blue", "Soft coral", "Warm ivory"];
  return {
    concept: {
      title: `${input.style || "A considered"} ${input.eventType.toLowerCase()}`,
      summary: `A welcoming ${input.atmosphere || "relaxed"} gathering for ${input.guests} guests${input.city ? ` in ${input.city}` : ""}. Keep the plan light enough to leave time for people to enjoy it.`,
      palette,
      mood: input.atmosphere || "Warm, personal and unhurried",
    },
    venue: {
      requirements: [
        `${input.setting === "either" ? "Indoor or outdoor" : input.setting} option for around ${input.guests} guests`,
        input.accessibility
          ? `Check accessibility: ${input.accessibility}`
          : "Step-free route and a comfortable place to sit",
        "Clear arrival instructions and a weather back-up if outdoors",
      ],
      selectionTips: [
        "Ask what is included in the venue fee before comparing prices.",
        "Visit at roughly the same time of day as your event.",
      ],
    },
    food: {
      approach:
        input.food ||
        "A generous shared table with a mix of lighter and hearty options.",
      ideas: [
        "One filling main dish",
        "A fresh side and seasonal fruit",
        "Water and a non-alcoholic drink station",
      ],
      dietaryNotes: input.dietary
        ? [input.dietary, "Label each dish and keep serving utensils separate."]
        : [
            "Ask guests about restrictions before finalizing the menu.",
            "Label common allergens clearly.",
          ],
    },
    entertainment: [
      input.entertainment ||
        "A playlist with a quieter corner for conversation.",
      "One simple group moment—short toast, photo or activity.",
      "Keep the schedule optional so guests can settle in at their own pace.",
    ],
    schedule: [
      {
        time: "0:00",
        activity: "Arrivals, welcome drink and room to settle in",
      },
      { time: "0:30", activity: "A short welcome and any practical notes" },
      {
        time: "1:00",
        activity: input.food || "Food, conversation and a few informal photos",
      },
      {
        time: `${Math.max(2, input.durationHours - 1)}:00`,
        activity: "Cake, shared activity or a closing toast",
      },
      {
        time: `${input.durationHours}:00`,
        activity: "A gentle close and help with the last details",
      },
    ],
    budget,
    guestChecklist: [
      "Draft the invite list and note how people prefer to be contacted.",
      "Collect RSVPs and dietary requirements in one place.",
      "Share arrival, transit and accessibility details.",
      "Set one point person for questions on the day.",
    ],
    shoppingList: [
      "Reusable tableware or a borrow-first plan",
      "Name cards and menu labels",
      "Water station supplies",
      "Small first-aid and tidy-up kit",
    ],
    preparationTimeline: timeline,
    contingencies: [
      "Keep a rain or heat alternative for any outdoor portion.",
      "Choose one person to make day-of decisions if timings slip.",
      "Have a low-tech copy of the schedule and contact details.",
    ],
    sustainableAlternatives: [
      "Borrow décor or use flowers and fabric that can be reused.",
      "Order for confirmed attendance with a modest shared buffer.",
      "Use local, seasonal food and refillable water containers.",
    ],
  };
}

export function explainGeminiFailure(error, model) {
  const status = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status,
  );
  const message = String(error?.message || "");
  if ([401, 403].includes(status))
    return "Google did not accept the configured Gemini API key. This is a local planning-guide draft, not an AI result. Check GEMINI_API_KEY in the server environment, then retry.";
  if (status === 429)
    return "Gemini is configured but its request quota or rate limit was reached. This is a local planning-guide draft, not an AI result. Check your Google AI Studio limits and retry.";
  if (
    status === 404 ||
    /model.*(?:not found|not available|unknown)/i.test(message)
  )
    return `The configured Gemini model (${model}) is unavailable to this project. This is a local planning-guide draft, not an AI result. Check GEMINI_MODEL and model access, then retry.`;
  if (
    error instanceof SyntaxError ||
    /schema|json|budget.*exceed|exceed.*budget|response_format/i.test(message)
  )
    return "Gemini responded, but its draft did not meet EventEase's structured-plan checks. This is a local planning-guide draft, not an AI result. Your answers are still here; retry after reviewing your request.";
  if (status === 408 || status === 504 || status >= 500)
    return "The Gemini service is temporarily unavailable. This is a local planning-guide draft, not an AI result. Your answers are still here; retry in a moment.";
  return "The Gemini request could not be completed. This is a local planning-guide draft, not an AI result. Check model access, key configuration and network, then retry.";
}

export async function generatePlan(input) {
  if (!process.env.GEMINI_API_KEY)
    return {
      plan: buildFallbackPlan(input),
      source: "fallback",
      note: "Gemini is not configured, so this draft came from the local planning guide—not an AI model.",
    };
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Create a practical, culturally considerate plan for the occasion described below. Use only the supplied details; respect local/cultural context, dietary requirements and accessibility needs. Return every section required by the JSON schema: a personal concept and palette; venue criteria, never invented venue listings; meal and dietary ideas; activities; a usable event-day running order; estimated amounts by budget category within the total where possible; guest and shopping/preparation checklists; preparation milestones relative to the stated event date (if no date was supplied, say so rather than inventing calendar dates); contingencies; and lower-waste alternatives. Do not invent providers, booking availability or price quotes. All amounts are estimates in ${input.currency}. User details: ${JSON.stringify(input)}`;
  try {
    const result = await client.interactions.create({
      model: geminiModel(),
      input: prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: responseSchema,
      },
    });
    const plan = planSchema.parse(JSON.parse(result.output_text || "null"));
    if (
      input.budget > 0 &&
      plan.budget.reduce((sum, row) => sum + row.estimated, 0) >
        input.budget * 1.05
    )
      throw new Error(
        "The generated cost estimate exceeds the supplied budget.",
      );
    return {
      plan,
      source: "gemini",
      note: "AI-assisted suggestions; all costs are estimates, not quotations.",
    };
  } catch (error) {
    const fallback = buildFallbackPlan(input);
    const model = geminiModel();
    console.warn("Gemini generation failed; using the local planning guide.");
    return {
      plan: fallback,
      source: "fallback",
      note: explainGeminiFailure(error, model),
    };
  }
}
