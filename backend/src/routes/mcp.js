import { Router } from "express";
import crypto from "crypto";
import { generateReport } from "../services/reportService.js";
import { draftLetter } from "../services/letterService.js";
import { generatePrepSheet } from "../services/prepService.js";
import { generateActionItems } from "../services/actionItemsService.js";
import { generateQuestionBank } from "../services/questionBankService.js";
import { generateDebrief } from "../services/debriefService.js";
import { generateMedicationSummary } from "../services/medicationService.js";
import { generateSymptomTimeline } from "../services/symptomTimelineService.js";
import { generateInsuranceClaimSummary } from "../services/insuranceClaimService.js";
import { generatePostpartumChecklist } from "../services/postpartumChecklistService.js";
import { translateMedicalText } from "../services/translationService.js";
import { generateCostBreakdown } from "../services/costBreakdownService.js";
import { generateInsuranceEligibilityGuide } from "../services/insuranceEligibilityService.js";
import { checkMedicationLog } from "../services/medicationCheckerService.js";
import { organizeLabResults } from "../services/labResultService.js";
import { generateTravelHealthGuide } from "../services/travelHealthService.js";
import { generateTrimesterPlan } from "../services/trimesterPlanService.js";
import { generateBirthPlan } from "../services/birthPlanService.js";
import { generateHospitalBagChecklist } from "../services/hospitalBagChecklistService.js";
import { generatePelvicFloorRecoveryGuide } from "../services/pelvicFloorRecoveryService.js";
import { generateInfantGrowthTracker } from "../services/infantGrowthTrackerService.js";
import { generateVaccinationSchedule } from "../services/vaccinationSchedulerService.js";
import { generateNutritionGuide } from "../services/nutritionMealPlannerService.js";
import { generateFeedingSupportSummary } from "../services/feedingSupportService.js";
import { generateNewbornCareGuide } from "../services/newbornCareGuideService.js";
import {
  reportToPdf,
  letterToPdf,
  prepSheetToPdf,
  actionItemsToPdf,
  questionBankToPdf,
  debriefToPdf,
  medicationToPdf,
  symptomTimelineToPdf,
  insuranceClaimToPdf,
  postpartumChecklistToPdf,
  translationToPdf,
  costBreakdownToPdf,
  insuranceEligibilityToPdf,
  medicationCheckToPdf,
  labResultsToPdf,
  travelHealthToPdf,
  trimesterPlanToPdf,
  birthPlanToPdf,
  hospitalBagChecklistToPdf,
  pelvicFloorRecoveryToPdf,
  infantGrowthTrackerToPdf,
  vaccinationScheduleToPdf,
  nutritionGuideToPdf,
  feedingSupportToPdf,
  newbornCareGuideToPdf,
  fullPackageToPdf,
} from "../services/pdfService.js";
import { uploadAndGetLink, isStorageConfigured } from "../storageClient.js";
import { isPaymentConfigured, PRICES } from "../x402.js";

const router = Router();

// This is the A2MCP surface for OKX AI Marketplace. Each skill is its own
// priced HTTP route (POST /mcp/<skill>) rather than a single dispatch
// endpoint, because OKX's x402 middleware prices routes by exact
// method+path — see src/x402.js, which is mounted in front of this router
// in server.js and gates every route below except GET /tools.
//
// Every route here just calls the same src/services/* functions the web
// dashboard's /generate/* routes use. One implementation, two callers.

const TOOLS = [
  {
    name: "generate_report",
    description: "Turn a list of health notes/entries into a structured plain-language report with insights and a provider-flag.",
    invoke: { method: "POST", path: "/mcp/report", price: PRICES.report },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_prep_sheet",
    description: "Build an appointment prep sheet (key points, suggested questions, red flags) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/prep", price: PRICES.prep },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "draft_letter",
    description: "Draft an advocacy letter (leave request, accommodation, insurance appeal) from a purpose, tone, and list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/letter", price: PRICES.letter },
    inputSchema: {
      type: "object",
      properties: {
        purpose: { type: "string", description: "e.g. 'employer accommodation request'" },
        tone: { type: "string", description: "e.g. 'firm', 'warm', 'formal'" },
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["purpose", "tone", "entries"],
    },
  },
  {
    name: "generate_action_items",
    description: "Extract prioritized action items (immediate, this week, discuss at next appointment, long-term) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/action-items", price: PRICES["action-items"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_question_bank",
    description: "Generate a categorized bank of 8-12 appointment questions (symptoms, tests, recovery, work/logistics, mental health) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/questions", price: PRICES.questions },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_debrief",
    description: "Turn fresh notes from an appointment the user just left into a structured recap. Prior entries are used only as background context, not as the visit content itself.",
    invoke: { method: "POST", path: "/mcp/debrief", price: PRICES.debrief },
    inputSchema: {
      type: "object",
      properties: {
        visitNotes: { type: "string", description: "Fresh notes/transcript from the visit just had" },
        entries: { type: "array", items: { type: "object" }, description: "Optional, background context only" },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["visitNotes"],
    },
  },
  {
    name: "generate_medication_summary",
    description: "Summarize medications/supplements, doses, frequency, and tolerance notes mentioned in a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/medication", price: PRICES.medication },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_symptom_timeline",
    description: "Build a chronological, per-symptom timeline with a trend read (improving/worsening/steady) from a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/symptom-timeline", price: PRICES["symptom-timeline"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_insurance_claim_summary",
    description: "Summarize care-related events (dates, providers, costs mentioned) from a list of health notes/entries into a claim-support summary.",
    invoke: { method: "POST", path: "/mcp/insurance-claim", price: PRICES["insurance-claim"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_postpartum_checklist",
    description: "Build a postpartum recovery checklist (physical, emotional, feeding, appointments, logistics) grounded in a list of health notes/entries.",
    invoke: { method: "POST", path: "/mcp/postpartum-checklist", price: PRICES["postpartum-checklist"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "translate_medical_text",
    description: "Translate a health note or provider instructions between English and a target language (Chinese, Japanese, Korean, Spanish, Portuguese, Hindi, Thai, Vietnamese, Bahasa Indonesia).",
    invoke: { method: "POST", path: "/mcp/translate", price: PRICES.translate },
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        target_language: { type: "string", description: "e.g. 'Spanish'" },
        direction: { type: "string", enum: ["to_target", "to_english"], default: "to_target" },
      },
      required: ["text", "target_language"],
    },
  },
  {
    name: "generate_cost_breakdown",
    description: "Organize cost/billing figures already mentioned in a list of health notes/entries into a line-item breakdown. Does not estimate unstated costs.",
    invoke: { method: "POST", path: "/mcp/cost-estimate", price: PRICES["cost-estimate"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_travel_health_guide",
    description: "Build a vaccination/travel-health prep checklist from a list of health notes/entries. Does not state actual country requirements.",
    invoke: { method: "POST", path: "/mcp/travel-health", price: PRICES["travel-health"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_insurance_eligibility_guide",
    description: "Organize care events and generate questions to ask an insurer for eligibility/claims, from a list of health notes/entries. Does not determine coverage.",
    invoke: { method: "POST", path: "/mcp/insurance", price: PRICES.insurance },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "check_medication_log",
    description: "Flag possible duplicate or unclear medication log entries worth raising with a pharmacist, from a list of health notes/entries. Does not check drug interactions.",
    invoke: { method: "POST", path: "/mcp/medication-check", price: PRICES["medication-check"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "organize_lab_results",
    description: "Organize logged lab result values exactly as reported in a list of health notes/entries, with no independent normal/abnormal classification.",
    invoke: { method: "POST", path: "/mcp/lab-results", price: PRICES["lab-results"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_trimester_plan",
    description: "Group prenatal notes into first/second/third trimester buckets based on the timing the user themselves mentioned. Does not calculate due dates or gestational age.",
    invoke: { method: "POST", path: "/mcp/trimester-plan", price: PRICES["trimester-plan"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_birth_plan",
    description: "Draft a printable birth plan from preferences the user has already stated. Never fills in a default preference or recommends for/against a medical intervention.",
    invoke: { method: "POST", path: "/mcp/birth-plan", price: PRICES["birth-plan"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_hospital_bag_checklist",
    description: "Build a hospital bag packing checklist from common packing categories plus what the user has logged (e.g. a scheduled C-section).",
    invoke: { method: "POST", path: "/mcp/hospital-bag", price: PRICES["hospital-bag"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_pelvic_floor_recovery_guide",
    description: "Organize postpartum pelvic floor symptoms and any guidance already received, flagging concerns for a specialist. Never prescribes exercises itself.",
    invoke: { method: "POST", path: "/mcp/pelvic-floor", price: PRICES["pelvic-floor"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_infant_growth_tracker",
    description: "Organize logged infant growth measurements chronologically with direction-of-change only. Never classifies against WHO/CDC percentiles.",
    invoke: { method: "POST", path: "/mcp/growth-tracker", price: PRICES["growth-tracker"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_vaccination_schedule",
    description: "Checklist of logged vaccines for mother and baby plus things to confirm with a provider. Not a live or authoritative immunization schedule.",
    invoke: { method: "POST", path: "/mcp/vaccinations", price: PRICES.vaccinations },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_nutrition_guide",
    description: "Pregnancy/postpartum nutrition guide combining logged foods with well-established public nutrition info. Not a meal plan or medical nutrition therapy.",
    invoke: { method: "POST", path: "/mcp/nutrition", price: PRICES.nutrition },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_feeding_support_summary",
    description: "Organize breastfeeding/pumping/bottle-feeding logs and flag concerns for a lactation consultant. Never gives technique guidance itself.",
    invoke: { method: "POST", path: "/mcp/feeding-support", price: PRICES["feeding-support"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "generate_newborn_care_guide",
    description: "Newborn care checklist grounded in logged notes (feeding, sleep, diapering). Defers specific clinical thresholds to the pediatrician rather than stating them.",
    invoke: { method: "POST", path: "/mcp/newborn-care", price: PRICES["newborn-care"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "student_health_bundle",
    description: "Report + Prep Sheet + Cost Breakdown + Insurance Eligibility Guide, bundled at a discount for student health plan use cases.",
    invoke: { method: "POST", path: "/mcp/bundle/student", price: PRICES["bundle-student"] },
    inputSchema: {
      type: "object",
      properties: { entries: { type: "array", items: { type: "object" } }, include_pdf: { type: "boolean", default: true } },
      required: ["entries"],
    },
  },
  {
    name: "senior_care_bundle",
    description: "Medication Summary + Medication Check + Lab Results + Insurance Eligibility Guide, bundled for Medicare-era/senior care use cases.",
    invoke: { method: "POST", path: "/mcp/bundle/senior", price: PRICES["bundle-senior"] },
    inputSchema: {
      type: "object",
      properties: { entries: { type: "array", items: { type: "object" } }, include_pdf: { type: "boolean", default: true } },
      required: ["entries"],
    },
  },
  {
    name: "travel_health_bundle",
    description: "Travel Health Guide + Cost Breakdown, plus a translation if translate_target_language is supplied.",
    invoke: { method: "POST", path: "/mcp/bundle/travel", price: PRICES["bundle-travel"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        translate_target_language: { type: "string" },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
  {
    name: "chronic_care_bundle",
    description: "Report + Action Items + Medication Summary + Medication Check + Lab Results, bundled for ongoing chronic-condition management.",
    invoke: { method: "POST", path: "/mcp/bundle/chronic", price: PRICES["bundle-chronic"] },
    inputSchema: {
      type: "object",
      properties: { entries: { type: "array", items: { type: "object" } }, include_pdf: { type: "boolean", default: true } },
      required: ["entries"],
    },
  },
  {
    name: "family_bundle",
    description: "Report + Prep Sheet + Action Items for up to 5 family members in one call, each returned separately under members[].",
    invoke: { method: "POST", path: "/mcp/bundle/family", price: PRICES["bundle-family"] },
    inputSchema: {
      type: "object",
      properties: {
        members: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            properties: { name: { type: "string" }, entries: { type: "array", items: { type: "object" } } },
            required: ["entries"],
          },
        },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["members"],
    },
  },
  {
    name: "generate_full_package",
    description: "Runs all 25 skills at once against the same input and returns one combined document. $3.25 flat — cheaper than buying all 25 individually ($4.60 total).",
    invoke: { method: "POST", path: "/mcp/full-package", price: PRICES["full-package"] },
    inputSchema: {
      type: "object",
      properties: {
        entries: { type: "array", items: { type: "object" } },
        purpose: { type: "string", description: "for the letter section" },
        tone: { type: "string", description: "for the letter section" },
        visitNotes: { type: "string", description: "for the debrief section; omit to skip it" },
        translate_target_language: {
          type: "string",
          description: "for the translation section; omit to skip it — no default target language is assumed",
        },
        include_pdf: { type: "boolean", default: true },
      },
      required: ["entries"],
    },
  },
];

router.get("/tools", (req, res) => {
  // Free catalog. (The authoritative GET /mcp/tools catalog is also served
  // at the app level in server.js so it stays outside the x402 gate; this
  // route is kept for direct REST callers hitting the router.)
  res.json({
    tools: TOOLS,
    payment: isPaymentConfigured()
      ? { scheme: "x402", network: "eip155:196" }
      : { scheme: "none", note: "Payment not configured on this deployment — routes are currently unmetered." },
  });
});

function normalizeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("entries must be a non-empty array");
  }
  return entries.map((e) => ({
    content: String(e.content ?? ""),
    type: e.type ?? "text",
    created_at: e.created_at ?? new Date().toISOString(),
  }));
}

// A URL is far more useful to a calling agent than raw JSON it has to
// render itself. `include_pdf: false` skips this entirely — some callers
// only want structured JSON and shouldn't pay the latency/storage cost of
// a PDF they'll never open.
async function tryBuildDownload(includePdf, pdfBuilder, content, key) {
  if (includePdf === false) {
    return { url: null, expires_at: null, note: "PDF not requested (include_pdf: false)." };
  }
  if (!isStorageConfigured()) {
    return { url: null, expires_at: null, note: "Downloadable link not configured on this deployment." };
  }
  try {
    const buffer = await pdfBuilder(content);
    const { url, expiresAt } = await uploadAndGetLink(buffer, key);
    return { url, expires_at: expiresAt, note: null };
  } catch (err) {
    console.error("MCP PDF upload failed:", err.message);
    return { url: null, expires_at: null, note: "Could not generate a download link right now." };
  }
}

function errorStatus(err) {
  return err.message?.startsWith("entries") || err.message?.includes("required") ? 400 : 502;
}

router.post("/report", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateReport(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, reportToPdf, content, `mcp/reports/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/prep", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generatePrepSheet(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, prepSheetToPdf, content, `mcp/prep/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/letter", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    if (!req.body?.purpose || !req.body?.tone) throw new Error("purpose and tone are required");
    const content = await draftLetter(req.body.purpose, req.body.tone, entries);
    const download = await tryBuildDownload(req.body?.include_pdf, letterToPdf, content, `mcp/letters/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/action-items", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateActionItems(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, actionItemsToPdf, content, `mcp/action-items/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/questions", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateQuestionBank(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, questionBankToPdf, content, `mcp/questions/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/debrief", async (req, res) => {
  try {
    if (!req.body?.visitNotes || !String(req.body.visitNotes).trim()) {
      throw new Error("visitNotes is required");
    }
    const priorEntries = Array.isArray(req.body?.entries) && req.body.entries.length ? normalizeEntries(req.body.entries) : [];
    const content = await generateDebrief(String(req.body.visitNotes), priorEntries);
    const download = await tryBuildDownload(req.body?.include_pdf, debriefToPdf, content, `mcp/debriefs/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/medication", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateMedicationSummary(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, medicationToPdf, content, `mcp/medication/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/symptom-timeline", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateSymptomTimeline(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, symptomTimelineToPdf, content, `mcp/symptom-timeline/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/insurance-claim", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateInsuranceClaimSummary(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, insuranceClaimToPdf, content, `mcp/insurance-claim/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/postpartum-checklist", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generatePostpartumChecklist(entries);
    const download = await tryBuildDownload(
      req.body?.include_pdf,
      postpartumChecklistToPdf,
      content,
      `mcp/postpartum-checklist/${crypto.randomUUID()}.pdf`
    );
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/translate", async (req, res) => {
  try {
    const { text, target_language, direction } = req.body || {};
    const content = await translateMedicalText(text, target_language, direction);
    const download = await tryBuildDownload(req.body?.include_pdf, translationToPdf, content, `mcp/translate/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/cost-estimate", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateCostBreakdown(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, costBreakdownToPdf, content, `mcp/cost-estimate/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/travel-health", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateTravelHealthGuide(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, travelHealthToPdf, content, `mcp/travel-health/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/insurance", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateInsuranceEligibilityGuide(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, insuranceEligibilityToPdf, content, `mcp/insurance/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/medication-check", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await checkMedicationLog(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, medicationCheckToPdf, content, `mcp/medication-check/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/lab-results", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await organizeLabResults(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, labResultsToPdf, content, `mcp/lab-results/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/trimester-plan", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateTrimesterPlan(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, trimesterPlanToPdf, content, `mcp/trimester-plan/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/birth-plan", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateBirthPlan(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, birthPlanToPdf, content, `mcp/birth-plan/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/hospital-bag", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateHospitalBagChecklist(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, hospitalBagChecklistToPdf, content, `mcp/hospital-bag/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/pelvic-floor", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generatePelvicFloorRecoveryGuide(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, pelvicFloorRecoveryToPdf, content, `mcp/pelvic-floor/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/growth-tracker", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateInfantGrowthTracker(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, infantGrowthTrackerToPdf, content, `mcp/growth-tracker/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/vaccinations", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateVaccinationSchedule(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, vaccinationScheduleToPdf, content, `mcp/vaccinations/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/nutrition", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateNutritionGuide(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, nutritionGuideToPdf, content, `mcp/nutrition/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/feeding-support", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateFeedingSupportSummary(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, feedingSupportToPdf, content, `mcp/feeding-support/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post("/newborn-care", async (req, res) => {
  try {
    const entries = normalizeEntries(req.body?.entries);
    const content = await generateNewbornCareGuide(entries);
    const download = await tryBuildDownload(req.body?.include_pdf, newbornCareGuideToPdf, content, `mcp/newborn-care/${crypto.randomUUID()}.pdf`);
    res.json({ content, download });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

// The $3.25 bundle. Runs all 25 skills against the same input; a single
// sub-generation failing degrades the response instead of failing the
// whole paid call — the caller already paid, a partial deliverable beats
// nothing. `succeeded` / `failed` make that explicit rather than silent.
router.post("/full-package", async (req, res) => {
  const entries = (() => {
    try {
      return normalizeEntries(req.body?.entries);
    } catch (err) {
      return null;
    }
  })();
  if (!entries) {
    return res.status(400).json({ error: "entries must be a non-empty array" });
  }

  const purpose = req.body?.purpose || "general advocacy letter";
  const tone = req.body?.tone || "warm but firm";
  const visitNotes = req.body?.visitNotes ? String(req.body.visitNotes) : null;
  // Translation needs free-text + a target language, not `entries` — it
  // only runs if the caller opts in by supplying both, since there's no
  // sensible default target language to assume.
  const translateTargetLanguage = req.body?.translate_target_language ? String(req.body.translate_target_language) : null;

  const jobs = {
    report: () => generateReport(entries),
    prep: () => generatePrepSheet(entries),
    letter: () => draftLetter(purpose, tone, entries),
    actionItems: () => generateActionItems(entries),
    questionBank: () => generateQuestionBank(entries),
    medication: () => generateMedicationSummary(entries),
    symptomTimeline: () => generateSymptomTimeline(entries),
    insuranceClaim: () => generateInsuranceClaimSummary(entries),
    postpartumChecklist: () => generatePostpartumChecklist(entries),
    costBreakdown: () => generateCostBreakdown(entries),
    travelHealth: () => generateTravelHealthGuide(entries),
    insuranceEligibility: () => generateInsuranceEligibilityGuide(entries),
    medicationCheck: () => checkMedicationLog(entries),
    labResults: () => organizeLabResults(entries),
    trimesterPlan: () => generateTrimesterPlan(entries),
    birthPlan: () => generateBirthPlan(entries),
    hospitalBagChecklist: () => generateHospitalBagChecklist(entries),
    pelvicFloorRecovery: () => generatePelvicFloorRecoveryGuide(entries),
    infantGrowthTracker: () => generateInfantGrowthTracker(entries),
    vaccinationSchedule: () => generateVaccinationSchedule(entries),
    nutritionGuide: () => generateNutritionGuide(entries),
    feedingSupport: () => generateFeedingSupportSummary(entries),
    newbornCareGuide: () => generateNewbornCareGuide(entries),
    ...(visitNotes ? { debrief: () => generateDebrief(visitNotes, entries) } : {}),
    ...(translateTargetLanguage
      ? { translation: () => translateMedicalText(entries.map((e) => e.content).join("\n\n"), translateTargetLanguage) }
      : {}),
  };

  const results = {};
  const succeeded = [];
  const failed = [];

  for (const [key, run] of Object.entries(jobs)) {
    try {
      results[key] = await run();
      succeeded.push(key);
    } catch (err) {
      failed.push({ section: key, error: err.message });
    }
  }

  const download = await tryBuildDownload(
    req.body?.include_pdf,
    fullPackageToPdf,
    results,
    `mcp/full-package/${crypto.randomUUID()}.pdf`
  );

  res.json({ content: results, succeeded, failed, download });
});

// --- Premium bundles ---------------------------------------------------
// Fixed-price groupings of the existing single-tool functions, priced as
// their own x402 routes (see x402.js PRICES/routeConfig). These reuse
// each skill's own PDF renderer per-section rather than building 5 new
// composite documents — a bundle's `downloads` field is a map of
// { jobKey: { url, expires_at } } instead of one combined PDF, since the
// individual renderers already exist and stay in sync automatically as
// those tools evolve.
const PDF_MAP = {
  report: [reportToPdf, "mcp/reports"],
  prep: [prepSheetToPdf, "mcp/prep"],
  actionItems: [actionItemsToPdf, "mcp/action-items"],
  costBreakdown: [costBreakdownToPdf, "mcp/cost-estimate"],
  insuranceEligibility: [insuranceEligibilityToPdf, "mcp/insurance"],
  medication: [medicationToPdf, "mcp/medication"],
  medicationCheck: [medicationCheckToPdf, "mcp/medication-check"],
  labResults: [labResultsToPdf, "mcp/lab-results"],
  travelHealth: [travelHealthToPdf, "mcp/travel-health"],
  translation: [translationToPdf, "mcp/translate"],
};

async function runJobs(jobs, includePdf) {
  const results = {};
  const succeeded = [];
  const failed = [];
  const downloads = {};

  for (const [key, run] of Object.entries(jobs)) {
    try {
      results[key] = await run();
      succeeded.push(key);
      if (PDF_MAP[key]) {
        const [toPdf, prefix] = PDF_MAP[key];
        downloads[key] = await tryBuildDownload(includePdf, toPdf, results[key], `${prefix}/${crypto.randomUUID()}.pdf`);
      }
    } catch (err) {
      failed.push({ section: key, error: err.message });
    }
  }

  return { results, succeeded, failed, downloads };
}

function bundleHandler(buildJobs) {
  return async (req, res) => {
    const entries = (() => {
      try {
        return normalizeEntries(req.body?.entries);
      } catch (err) {
        return null;
      }
    })();
    if (!entries) return res.status(400).json({ error: "entries must be a non-empty array" });

    const { results, succeeded, failed, downloads } = await runJobs(buildJobs(entries, req.body), req.body?.include_pdf);
    res.json({ content: results, succeeded, failed, downloads });
  };
}

// Student Health Bundle — $2.99: core report/prep plus the two things a
// student is most likely to actually need (a cost breakdown for a
// student health plan, and insurer questions).
router.post(
  "/bundle/student",
  bundleHandler((entries) => ({
    report: () => generateReport(entries),
    prep: () => generatePrepSheet(entries),
    costBreakdown: () => generateCostBreakdown(entries),
    insuranceEligibility: () => generateInsuranceEligibilityGuide(entries),
  }))
);

// Senior Care Bundle — $4.99: medication-heavy, since that's where
// seniors' notes concentrate, plus lab results and Medicare-style
// insurance questions.
router.post(
  "/bundle/senior",
  bundleHandler((entries) => ({
    medication: () => generateMedicationSummary(entries),
    medicationCheck: () => checkMedicationLog(entries),
    labResults: () => organizeLabResults(entries),
    insuranceEligibility: () => generateInsuranceEligibilityGuide(entries),
  }))
);

// Travel Health Bundle — $3.99: the travel checklist plus translation
// (only runs if a target language is supplied) and cost breakdown for
// travel-related care.
router.post(
  "/bundle/travel",
  bundleHandler((entries, body) => ({
    travelHealth: () => generateTravelHealthGuide(entries),
    costBreakdown: () => generateCostBreakdown(entries),
    ...(body?.translate_target_language
      ? { translation: () => translateMedicalText(entries.map((e) => e.content).join("\n\n"), String(body.translate_target_language)) }
      : {}),
  }))
);

// Chronic Care Bundle — $5.99: the ongoing-management set — report,
// action items, medication tracking/check, and lab results.
router.post(
  "/bundle/chronic",
  bundleHandler((entries) => ({
    report: () => generateReport(entries),
    actionItems: () => generateActionItems(entries),
    medication: () => generateMedicationSummary(entries),
    medicationCheck: () => checkMedicationLog(entries),
    labResults: () => organizeLabResults(entries),
  }))
);

// Family Bundle (up to 5 people) — $9.99: runs the core set (report,
// prep, action items) per member. Body shape:
// { members: [{ name?: string, entries: [...] }, ...] } — up to 5.
// Each member's results are namespaced under `content.members[i]`
// rather than flattened, so downstream callers can tell whose is whose.
router.post("/bundle/family", async (req, res) => {
  const members = Array.isArray(req.body?.members) ? req.body.members.slice(0, 5) : null;
  if (!members || members.length === 0) {
    return res.status(400).json({ error: "members must be a non-empty array (max 5), each with an entries array" });
  }

  const memberResults = [];
  for (const member of members) {
    let entries;
    try {
      entries = normalizeEntries(member?.entries);
    } catch (err) {
      memberResults.push({ name: member?.name ?? null, error: err.message });
      continue;
    }
    const { results, succeeded, failed, downloads } = await runJobs(
      {
        report: () => generateReport(entries),
        prep: () => generatePrepSheet(entries),
        actionItems: () => generateActionItems(entries),
      },
      req.body?.include_pdf
    );
    memberResults.push({ name: member?.name ?? null, content: results, succeeded, failed, downloads });
  }

  res.json({ members: memberResults });
});

export { TOOLS };
export default router;
