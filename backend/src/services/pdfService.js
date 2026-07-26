import PDFDocument from "pdfkit";

// Shared by /generate/* and the /mcp download links. Renders the same
// content_json every route already produces into a plain, readable PDF —
// no branding assets required, so it has zero extra deploy dependencies.

function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function baseDoc(title) {
  const doc = new PDFDocument({ margin: 56 });
  doc.fontSize(18).fillColor("#2a1f2d").text(title);
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor("#8a7686")
    .text(`Generated ${new Date().toLocaleString()} · Maternal Health Companion`);
  doc.moveDown(1.2);
  doc.fillColor("#2a1f2d").fontSize(11);
  return doc;
}

function section(doc, title, items) {
  if (!items || !items.length) return;
  doc.fontSize(13).fillColor("#c13f6b").text(title);
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d");
  items.forEach((item) => doc.text(`•  ${item}`, { paragraphGap: 4 }));
  doc.moveDown(0.6);
}

function footerDisclaimer(doc, text) {
  doc.moveDown(1.5);
  doc.fontSize(9).fillColor("#8a7686").text(text);
}

export async function reportToPdf(content) {
  const doc = baseDoc("Health Report");

  doc.fontSize(13).fillColor("#c13f6b").text("Summary");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d").text(content.summary || "");
  doc.moveDown(0.6);

  section(
    doc,
    "Insights",
    (content.insights || []).map((i) => `[${i.type}] ${i.text}`)
  );

  doc.fontSize(13).fillColor("#c13f6b").text("Flagged for provider");
  doc.moveDown(0.3);
  doc
    .fontSize(11)
    .fillColor("#2a1f2d")
    .text(content.flagged_for_provider ? `Yes — ${content.flag_reason || "see summary"}` : "No");

  footerDisclaimer(
    doc,
    "This is an informational and productivity tool. It is not a medical device, does not diagnose, and does not replace your healthcare provider."
  );

  return streamToBuffer(doc);
}

export async function letterToPdf(content) {
  const doc = baseDoc(content.subject || "Draft Letter");
  doc.fontSize(11).fillColor("#2a1f2d").text(content.body || "", { lineGap: 4 });
  footerDisclaimer(doc, content.disclaimer || "Draft only. Review before sending. Not legal advice.");
  return streamToBuffer(doc);
}

export async function prepSheetToPdf(content) {
  const doc = baseDoc("Appointment Prep Sheet");
  section(doc, "Key points to mention", content.key_points_to_mention);
  section(doc, "Suggested questions", content.suggested_questions);
  section(doc, "Red flags to raise", content.red_flags_to_raise);
  footerDisclaimer(
    doc,
    "This is an informational and productivity tool. It is not a medical device and does not predict outcomes."
  );
  return streamToBuffer(doc);
}

export async function actionItemsToPdf(content) {
  const doc = baseDoc("Action Items");
  section(doc, "Immediate", content.immediate);
  section(doc, "This week", content.this_week);
  section(doc, "Discuss at next appointment", content.discuss_at_next_appointment);
  section(doc, "Long-term or optional", content.long_term_or_optional);
  footerDisclaimer(doc, content.disclaimer || "This is an extraction from your own notes. Review and adjust.");
  return streamToBuffer(doc);
}

export async function questionBankToPdf(content) {
  const doc = baseDoc("Appointment Question Bank");
  (content.categories || []).forEach((cat) => {
    doc.fontSize(13).fillColor("#c13f6b").text(cat.name);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#2a1f2d");
    if (cat.questions && cat.questions.length) {
      cat.questions.forEach((q) => doc.text(`•  ${q}`, { paragraphGap: 4 }));
    } else {
      doc.fillColor("#8a7686").text("None flagged.");
    }
    doc.moveDown(0.6);
  });
  footerDisclaimer(doc, content.disclaimer || "These are suggestions based on what you've shared. Edit or ignore freely.");
  return streamToBuffer(doc);
}

export async function debriefToPdf(content) {
  const doc = baseDoc("Post-Visit Debrief");
  section(doc, "What was discussed", content.what_was_discussed);

  if (content.action_plan && content.action_plan.length) {
    doc.fontSize(13).fillColor("#c13f6b").text("Action plan");
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#2a1f2d");
    content.action_plan.forEach((a) => doc.text(`•  ${a.item}  (${a.owner}, due: ${a.due || "n/a"})`, { paragraphGap: 4 }));
    doc.moveDown(0.6);
  }

  section(doc, "Questions for next time", content.questions_for_next_time);

  doc.fontSize(13).fillColor("#c13f6b").text("Flagged for follow-up");
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#2a1f2d").text(content.flagged_for_follow_up || "None");

  footerDisclaimer(
    doc,
    content.disclaimer || "This is your summary of the conversation you reported. Always confirm against your provider's notes."
  );
  return streamToBuffer(doc);
}

export async function medicationToPdf(content) {
  const doc = baseDoc("Medication & Supplement Summary");
  (content.medications || []).forEach((m) => {
    doc.fontSize(12).fillColor("#c13f6b").text(m.name || "Unnamed");
    doc.fontSize(11).fillColor("#2a1f2d");
    if (m.dose) doc.text(`Dose: ${m.dose}`);
    if (m.frequency) doc.text(`Frequency: ${m.frequency}`);
    if (m.notes) doc.text(`Notes: ${m.notes}`);
    doc.moveDown(0.5);
  });
  section(doc, "Questions for provider", content.questions_for_provider);
  footerDisclaimer(
    doc,
    content.disclaimer || "This is a summary of what you've reported. It is not medical advice — confirm all dosing with your provider or pharmacist."
  );
  return streamToBuffer(doc);
}

// No charting library in play — this renders the trend data as a labeled
// list per symptom (dates + a one-line trend read) rather than a plotted
// graph, to avoid pulling in a new dependency for a text-first PDF. A
// caller that wants an actual chart image can build one client-side from
// the same `occurrences` array returned by generateSymptomTimeline.
export async function symptomTimelineToPdf(content) {
  const doc = baseDoc("Symptom Timeline");
  (content.timeline || []).forEach((item) => {
    doc.fontSize(13).fillColor("#c13f6b").text(item.symptom || "Unnamed symptom");
    doc.fontSize(10).fillColor("#8a7686").text(`Trend: ${item.trend || "not enough data"}`);
    doc.moveDown(0.2);
    doc.fontSize(11).fillColor("#2a1f2d");
    (item.occurrences || []).forEach((o) => doc.text(`•  [${o.date}] ${o.note}`, { paragraphGap: 2 }));
    doc.moveDown(0.6);
  });
  footerDisclaimer(
    doc,
    content.disclaimer || "This is a pattern summary of your own notes, not a clinical trend analysis. Discuss anything concerning with your provider."
  );
  return streamToBuffer(doc);
}

export async function insuranceClaimToPdf(content) {
  const doc = baseDoc("Insurance Claim Summary");
  doc.fontSize(11).fillColor("#2a1f2d").text(content.claim_summary || "");
  doc.moveDown(0.6);

  doc.fontSize(13).fillColor("#c13f6b").text("Events");
  doc.moveDown(0.3);
  (content.events || []).forEach((e) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${e.date}] ${e.description}`, { paragraphGap: 2 });
    if (e.provider) doc.fontSize(10).fillColor("#8a7686").text(`   Provider: ${e.provider}`);
    if (e.cost_mentioned) doc.fontSize(10).fillColor("#8a7686").text(`   Cost mentioned: ${e.cost_mentioned}`);
  });
  doc.moveDown(0.6);

  section(doc, "Missing info to gather", content.missing_info);
  footerDisclaimer(
    doc,
    content.disclaimer || "This is a claim-support summary drawn from your own notes. It is not a filed claim, coverage determination, or legal/insurance advice."
  );
  return streamToBuffer(doc);
}

export async function postpartumChecklistToPdf(content) {
  const doc = baseDoc("Postpartum Recovery Checklist");
  section(doc, "Physical recovery", content.physical_recovery);
  section(doc, "Emotional wellbeing", content.emotional_wellbeing);
  section(doc, "Feeding", content.feeding);
  section(doc, "Appointments & follow-ups", content.appointments_and_followups);
  section(doc, "Logistics & support", content.logistics_and_support);
  footerDisclaimer(
    doc,
    content.disclaimer || "This checklist is based on your own notes. It is not medical advice and does not replace your postpartum care plan."
  );
  return streamToBuffer(doc);
}

export async function translationToPdf(content) {
  const doc = baseDoc(`Translation (${content.target_language || ""})`);
  doc.fontSize(11).fillColor("#2a1f2d").text(content.translated_text || "", { lineGap: 4 });
  footerDisclaimer(doc, content.disclaimer || "Machine translation of a medical note. Confirm with a qualified human interpreter for anything high-stakes.");
  return streamToBuffer(doc);
}

export async function costBreakdownToPdf(content) {
  const doc = baseDoc("Cost & Billing Breakdown");
  (content.line_items || []).forEach((li) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${li.date}] ${li.description}`, { paragraphGap: 2 });
    if (li.provider) doc.fontSize(10).fillColor("#8a7686").text(`   Provider: ${li.provider}`);
    if (li.amount_billed) doc.fontSize(10).fillColor("#8a7686").text(`   Billed: ${li.amount_billed}`);
    if (li.amount_paid) doc.fontSize(10).fillColor("#8a7686").text(`   Paid: ${li.amount_paid}`);
    if (li.status) doc.fontSize(10).fillColor("#8a7686").text(`   Status: ${li.status}`);
  });
  doc.moveDown(0.6);
  if (content.total_mentioned) {
    doc.fontSize(11).fillColor("#2a1f2d").text(`Total mentioned: ${content.total_mentioned}`);
    doc.moveDown(0.4);
  }
  section(doc, "Unclear or missing", content.unclear_or_missing);
  footerDisclaimer(
    doc,
    content.disclaimer || "This organizes cost figures you've already reported. It is not a cost estimate or billing determination."
  );
  return streamToBuffer(doc);
}

export async function insuranceEligibilityToPdf(content) {
  const doc = baseDoc("Insurance Eligibility & Claim Guide");
  doc.fontSize(13).fillColor("#c13f6b").text("Relevant events");
  doc.moveDown(0.3);
  (content.relevant_events || []).forEach((e) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${e.date}] ${e.description}`, { paragraphGap: 2 });
    if (e.provider) doc.fontSize(10).fillColor("#8a7686").text(`   Provider: ${e.provider}`);
  });
  doc.moveDown(0.6);
  section(doc, "Questions to ask your insurer", content.questions_to_ask_insurer);
  section(doc, "Documents to gather", content.documents_to_gather);
  footerDisclaimer(
    doc,
    content.disclaimer || "This is a checklist based on your own notes. It is not a coverage or eligibility determination."
  );
  return streamToBuffer(doc);
}

export async function medicationCheckToPdf(content) {
  const doc = baseDoc("Medication Log Check");
  section(doc, "Medications logged", content.medications_logged);
  section(doc, "Flags for pharmacist", content.flags_for_pharmacist);
  footerDisclaimer(
    doc,
    content.disclaimer || "This organizes what you've logged and flags things worth asking a pharmacist about. It does not check drug interactions."
  );
  return streamToBuffer(doc);
}

export async function labResultsToPdf(content) {
  const doc = baseDoc("Lab Results Organizer");
  (content.results || []).forEach((r) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${r.date}] ${r.test_name}: ${r.value}`, { paragraphGap: 2 });
    if (r.flag_as_reported_by_user) doc.fontSize(10).fillColor("#8a7686").text(`   Flagged by provider as: ${r.flag_as_reported_by_user}`);
  });
  doc.moveDown(0.6);
  section(doc, "Questions for provider", content.questions_for_provider);
  footerDisclaimer(
    doc,
    content.disclaimer || "This organizes lab values exactly as you logged them. It does not interpret whether any value is normal or abnormal."
  );
  return streamToBuffer(doc);
}

export async function travelHealthToPdf(content) {
  const doc = baseDoc("Vaccination & Travel Health Guide");
  doc.fontSize(11).fillColor("#2a1f2d");
  if (content.destination_mentioned) doc.text(`Destination: ${content.destination_mentioned}`);
  if (content.trip_dates_mentioned) doc.text(`Trip dates: ${content.trip_dates_mentioned}`);
  doc.moveDown(0.5);
  section(doc, "Vaccines already logged", content.vaccines_already_logged);
  section(doc, "Confirm with a travel clinic", content.things_to_confirm_with_a_travel_clinic);
  section(doc, "General prep checklist", content.general_prep_checklist);
  footerDisclaimer(
    doc,
    content.disclaimer || "This is a prep checklist based on what you've shared. It is not vaccine or travel-safety advice."
  );
  return streamToBuffer(doc);
}

export async function trimesterPlanToPdf(content) {
  const doc = baseDoc("Trimester Care Plan");
  const trimesterList = (label, items) => {
    if (!items || !items.length) return;
    doc.fontSize(13).fillColor("#c13f6b").text(label);
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#2a1f2d");
    items.forEach((o) => doc.text(`•  [${o.date}] ${o.note}`, { paragraphGap: 2 }));
    doc.moveDown(0.6);
  };
  trimesterList("First trimester", content.first_trimester);
  trimesterList("Second trimester", content.second_trimester);
  trimesterList("Third trimester", content.third_trimester);
  trimesterList("Unspecified timing", content.unspecified_timing);
  section(doc, "Questions for provider", content.questions_for_provider);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This organizes your own notes by the timing you mentioned. It does not calculate due dates or gestational age, and it is not a prenatal care plan — confirm timing and care schedule with your provider."
  );
  return streamToBuffer(doc);
}

export async function birthPlanToPdf(content) {
  const doc = baseDoc("Birth Plan");
  doc.fontSize(13).fillColor("#c13f6b").text("Stated preferences");
  doc.moveDown(0.3);
  (content.stated_preferences || []).forEach((p) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  ${p.topic}: ${p.preference}`, { paragraphGap: 2 });
  });
  doc.moveDown(0.6);
  section(doc, "Not yet specified — worth discussing with your provider", content.not_yet_specified);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This draft reflects only the preferences you've shared. It is not medical advice and isn't a guarantee your care team can accommodate every item — review it with your provider or midwife before your due date."
  );
  return streamToBuffer(doc);
}

export async function hospitalBagChecklistToPdf(content) {
  const doc = baseDoc("Hospital Bag Checklist");
  section(doc, "For you", content.for_you);
  section(doc, "For baby", content.for_baby);
  section(doc, "For your support person", content.for_support_person);
  section(doc, "Documents & logistics", content.documents_and_logistics);
  section(doc, "Confirm with your hospital", content.confirm_with_your_hospital);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This is a general packing checklist based on common practice and what you've shared. It is not medical guidance — confirm any hospital-specific policies with your provider or hospital in advance."
  );
  return streamToBuffer(doc);
}

export async function pelvicFloorRecoveryToPdf(content) {
  const doc = baseDoc("Pelvic Floor Recovery Guide");
  section(doc, "Symptoms logged", content.symptoms_logged);
  section(doc, "Guidance already received", content.guidance_already_received);
  section(doc, "Symptoms to discuss with a specialist", content.symptoms_to_discuss_with_a_specialist);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This organizes what you've logged and reflects guidance you said you already received. It does not provide pelvic floor exercises or treatment of its own — a pelvic floor physical therapist or your provider can build a plan for you."
  );
  return streamToBuffer(doc);
}

export async function infantGrowthTrackerToPdf(content) {
  const doc = baseDoc("Infant Growth Tracker");
  (content.measurements || []).forEach((m) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${m.date}] ${m.type}: ${m.value}`, { paragraphGap: 2 });
    if (m.percentile_as_reported_by_provider) {
      doc.fontSize(10).fillColor("#8a7686").text(`   Percentile as reported by provider: ${m.percentile_as_reported_by_provider}`);
    }
  });
  doc.moveDown(0.6);
  section(doc, "Trend notes", content.trend_notes);
  section(doc, "Questions for pediatrician", content.questions_for_pediatrician);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This organizes the measurements exactly as you logged them and shows direction of change only. It does not compare against WHO/CDC growth charts or classify any value — only your pediatrician can interpret growth data."
  );
  return streamToBuffer(doc);
}

export async function vaccinationScheduleToPdf(content) {
  const doc = baseDoc("Vaccination Checklist — Mother & Baby");
  section(doc, "Mother's vaccines logged", content.mother_vaccines_logged);
  section(doc, "Baby's vaccines logged", content.baby_vaccines_logged);
  section(doc, "Things to confirm with your provider", content.things_to_confirm_with_provider);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This is a checklist of what you've logged, not a live or authoritative immunization schedule. Confirm the current schedule with your pediatrician, provider, or official public health guidance (e.g. CDC/WHO)."
  );
  return streamToBuffer(doc);
}

export async function nutritionGuideToPdf(content) {
  const doc = baseDoc("Nutrition & Meal Guide");
  section(doc, "Foods logged", content.foods_logged);
  section(doc, "General nutrition notes", content.general_nutrition_notes);
  section(doc, "Food safety reminders", content.food_safety_reminders);
  section(doc, "Discuss with a dietitian or provider", content.discuss_with_a_dietitian_or_provider);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This offers general, non-personalized pregnancy/postpartum nutrition information alongside what you've logged. It is not medical nutrition therapy or a meal plan — for any medical condition affecting your diet, work with a dietitian or your provider."
  );
  return streamToBuffer(doc);
}

export async function feedingSupportToPdf(content) {
  const doc = baseDoc("Feeding Log Support");
  (content.feeding_log_summary || []).forEach((f) => {
    doc.fontSize(11).fillColor("#2a1f2d").text(`•  [${f.date}] ${f.type}${f.duration_or_amount ? " — " + f.duration_or_amount : ""}`, {
      paragraphGap: 2,
    });
    if (f.notes) doc.fontSize(10).fillColor("#8a7686").text(`   ${f.notes}`);
  });
  doc.moveDown(0.6);
  section(doc, "Patterns observed", content.patterns_observed);
  section(doc, "Concerns for a lactation consultant", content.concerns_for_a_lactation_consultant);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This organizes your feeding log and flags patterns worth raising with a lactation consultant or your pediatrician. It does not provide breastfeeding technique guidance of its own."
  );
  return streamToBuffer(doc);
}

export async function newbornCareGuideToPdf(content) {
  const doc = baseDoc("Newborn Care Guide");
  section(doc, "Feeding & sleep", content.feeding_and_sleep);
  section(doc, "Diapering & hygiene", content.diapering_and_hygiene);
  section(doc, "Development & temperament", content.development_and_temperament);
  section(doc, "Questions to confirm with pediatrician", content.questions_to_confirm_with_pediatrician);
  section(doc, "Flag for pediatrician now", content.flag_for_pediatrician_now);
  footerDisclaimer(
    doc,
    content.disclaimer ||
      "This checklist is based on your own notes. It is not medical advice and does not replace guidance from your pediatrician. If something feels urgent, contact your pediatrician or emergency services now rather than waiting on this checklist."
  );
  return streamToBuffer(doc);
}

// --- Full package: data-driven, not hardcoded -----------------------
// SECTION_REGISTRY is the single source of truth for what can appear in
// the combined document: the job key it's keyed by (matches the `jobs`
// object in routes/mcp.js), a display title, and a render function.
// Both the intro paragraph and the section list are generated by
// walking this array against whatever `results` actually contains, so
// adding or removing a skill from the catalog can never leave the
// intro text out of sync with the actual PDF again — that mismatch was
// a live bug in the hardcoded version this replaces.
const SECTION_REGISTRY = [
  {
    key: "report",
    title: "Health Report",
    render: (doc, c) => {
      doc.fontSize(11).text(c.summary || "");
      doc.moveDown(0.4);
      (c.insights || []).forEach((i) => doc.text(`•  [${i.type}] ${i.text}`));
      doc.moveDown(0.4);
      doc.text(c.flagged_for_provider ? `Flagged for provider: Yes — ${c.flag_reason || "see summary"}` : "Flagged for provider: No");
    },
  },
  {
    key: "prep",
    title: "Appointment Prep Sheet",
    render: (doc, c) => {
      section(doc, "Key points to mention", c.key_points_to_mention);
      section(doc, "Suggested questions", c.suggested_questions);
      section(doc, "Red flags to raise", c.red_flags_to_raise);
    },
  },
  {
    key: "letter",
    title: "Advocacy Letter",
    render: (doc, c) => {
      doc.fontSize(12).fillColor("#2a1f2d").text(c.subject || "", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).text(c.body || "", { lineGap: 4 });
    },
  },
  {
    key: "actionItems",
    title: "Action Items",
    render: (doc, c) => {
      section(doc, "Immediate", c.immediate);
      section(doc, "This week", c.this_week);
      section(doc, "Discuss at next appointment", c.discuss_at_next_appointment);
      section(doc, "Long-term or optional", c.long_term_or_optional);
    },
  },
  {
    key: "questionBank",
    title: "Appointment Question Bank",
    render: (doc, c) => {
      (c.categories || []).forEach((cat) => {
        doc.fontSize(12).fillColor("#c13f6b").text(cat.name);
        doc.moveDown(0.2);
        doc.fontSize(11).fillColor("#2a1f2d");
        if (cat.questions && cat.questions.length) {
          cat.questions.forEach((q) => doc.text(`•  ${q}`));
        } else {
          doc.fillColor("#8a7686").text("None flagged.");
        }
        doc.moveDown(0.5);
      });
    },
  },
  {
    key: "medication",
    title: "Medication & Supplement Summary",
    render: (doc, c) => {
      (c.medications || []).forEach((m) => {
        doc.fontSize(12).fillColor("#c13f6b").text(m.name || "Unnamed");
        doc.fontSize(11).fillColor("#2a1f2d");
        if (m.dose) doc.text(`Dose: ${m.dose}`);
        if (m.frequency) doc.text(`Frequency: ${m.frequency}`);
        if (m.notes) doc.text(`Notes: ${m.notes}`);
        doc.moveDown(0.4);
      });
      section(doc, "Questions for provider", c.questions_for_provider);
    },
  },
  {
    key: "symptomTimeline",
    title: "Symptom Timeline",
    render: (doc, c) => {
      (c.timeline || []).forEach((item) => {
        doc.fontSize(12).fillColor("#c13f6b").text(item.symptom || "Unnamed symptom");
        doc.fontSize(10).fillColor("#8a7686").text(`Trend: ${item.trend || "not enough data"}`);
        doc.fontSize(11).fillColor("#2a1f2d");
        (item.occurrences || []).forEach((o) => doc.text(`•  [${o.date}] ${o.note}`));
        doc.moveDown(0.4);
      });
    },
  },
  {
    key: "insuranceClaim",
    title: "Insurance Claim Summary",
    render: (doc, c) => {
      doc.fontSize(11).fillColor("#2a1f2d").text(c.claim_summary || "");
      doc.moveDown(0.4);
      (c.events || []).forEach((e) => {
        doc.text(`•  [${e.date}] ${e.description}`);
        if (e.provider) doc.fillColor("#8a7686").fontSize(10).text(`   Provider: ${e.provider}`);
        if (e.cost_mentioned) doc.fillColor("#8a7686").fontSize(10).text(`   Cost mentioned: ${e.cost_mentioned}`);
        doc.fillColor("#2a1f2d").fontSize(11);
      });
      doc.moveDown(0.4);
      section(doc, "Missing info to gather", c.missing_info);
    },
  },
  {
    key: "postpartumChecklist",
    title: "Postpartum Recovery Checklist",
    render: (doc, c) => {
      section(doc, "Physical recovery", c.physical_recovery);
      section(doc, "Emotional wellbeing", c.emotional_wellbeing);
      section(doc, "Feeding", c.feeding);
      section(doc, "Appointments & follow-ups", c.appointments_and_followups);
      section(doc, "Logistics & support", c.logistics_and_support);
    },
  },
  {
    key: "costBreakdown",
    title: "Cost & Billing Breakdown",
    render: (doc, c) => {
      (c.line_items || []).forEach((li) => {
        doc.text(`•  [${li.date}] ${li.description}`);
        if (li.amount_billed) doc.fillColor("#8a7686").fontSize(10).text(`   Billed: ${li.amount_billed}`);
        doc.fillColor("#2a1f2d").fontSize(11);
      });
      if (c.total_mentioned) {
        doc.moveDown(0.3);
        doc.text(`Total mentioned: ${c.total_mentioned}`);
      }
    },
  },
  {
    key: "travelHealth",
    title: "Vaccination & Travel Health Guide",
    render: (doc, c) => {
      if (c.destination_mentioned) doc.text(`Destination: ${c.destination_mentioned}`);
      if (c.trip_dates_mentioned) doc.text(`Trip dates: ${c.trip_dates_mentioned}`);
      doc.moveDown(0.3);
      section(doc, "Confirm with a travel clinic", c.things_to_confirm_with_a_travel_clinic);
      section(doc, "General prep checklist", c.general_prep_checklist);
    },
  },
  {
    key: "insuranceEligibility",
    title: "Insurance Eligibility & Claim Guide",
    render: (doc, c) => {
      section(doc, "Questions to ask your insurer", c.questions_to_ask_insurer);
      section(doc, "Documents to gather", c.documents_to_gather);
    },
  },
  {
    key: "medicationCheck",
    title: "Medication Log Check",
    render: (doc, c) => {
      section(doc, "Medications logged", c.medications_logged);
      section(doc, "Flags for pharmacist", c.flags_for_pharmacist);
    },
  },
  {
    key: "labResults",
    title: "Lab Results",
    render: (doc, c) => {
      (c.results || []).forEach((r) => {
        doc.text(`•  [${r.date}] ${r.test_name}: ${r.value}`);
        if (r.flag_as_reported_by_user) doc.fillColor("#8a7686").fontSize(10).text(`   Flagged by provider as: ${r.flag_as_reported_by_user}`);
        doc.fillColor("#2a1f2d").fontSize(11);
      });
      doc.moveDown(0.3);
      section(doc, "Questions for provider", c.questions_for_provider);
    },
  },
  {
    key: "translation",
    title: "Translation",
    titleFor: (c) => `Translation (${c.target_language || ""})`,
    render: (doc, c) => {
      doc.fontSize(11).text(c.translated_text || "", { lineGap: 4 });
    },
  },
  {
    key: "debrief",
    title: "Post-Visit Debrief",
    render: (doc, c) => {
      section(doc, "What was discussed", c.what_was_discussed);
      (c.action_plan || []).forEach((a) => doc.text(`•  ${a.item}  (${a.owner}, due: ${a.due || "n/a"})`));
      doc.moveDown(0.4);
      section(doc, "Questions for next time", c.questions_for_next_time);
      doc.text(`Flagged for follow-up: ${c.flagged_for_follow_up || "None"}`);
    },
  },
  {
    key: "trimesterPlan",
    title: "Trimester Care Plan",
    render: (doc, c) => {
      const list = (label, items) => section(doc, label, (items || []).map((o) => `[${o.date}] ${o.note}`));
      list("First trimester", c.first_trimester);
      list("Second trimester", c.second_trimester);
      list("Third trimester", c.third_trimester);
      list("Unspecified timing", c.unspecified_timing);
      section(doc, "Questions for provider", c.questions_for_provider);
    },
  },
  {
    key: "birthPlan",
    title: "Birth Plan",
    render: (doc, c) => {
      (c.stated_preferences || []).forEach((p) => doc.text(`•  ${p.topic}: ${p.preference}`));
      doc.moveDown(0.4);
      section(doc, "Not yet specified", c.not_yet_specified);
    },
  },
  {
    key: "hospitalBagChecklist",
    title: "Hospital Bag Checklist",
    render: (doc, c) => {
      section(doc, "For you", c.for_you);
      section(doc, "For baby", c.for_baby);
      section(doc, "For your support person", c.for_support_person);
      section(doc, "Documents & logistics", c.documents_and_logistics);
      section(doc, "Confirm with your hospital", c.confirm_with_your_hospital);
    },
  },
  {
    key: "pelvicFloorRecovery",
    title: "Pelvic Floor Recovery Guide",
    render: (doc, c) => {
      section(doc, "Symptoms logged", c.symptoms_logged);
      section(doc, "Guidance already received", c.guidance_already_received);
      section(doc, "Symptoms to discuss with a specialist", c.symptoms_to_discuss_with_a_specialist);
    },
  },
  {
    key: "infantGrowthTracker",
    title: "Infant Growth Tracker",
    render: (doc, c) => {
      (c.measurements || []).forEach((m) => doc.text(`•  [${m.date}] ${m.type}: ${m.value}`));
      doc.moveDown(0.4);
      section(doc, "Trend notes", c.trend_notes);
      section(doc, "Questions for pediatrician", c.questions_for_pediatrician);
    },
  },
  {
    key: "vaccinationSchedule",
    title: "Vaccination Checklist — Mother & Baby",
    render: (doc, c) => {
      section(doc, "Mother's vaccines logged", c.mother_vaccines_logged);
      section(doc, "Baby's vaccines logged", c.baby_vaccines_logged);
      section(doc, "Things to confirm with your provider", c.things_to_confirm_with_provider);
    },
  },
  {
    key: "nutritionGuide",
    title: "Nutrition & Meal Guide",
    render: (doc, c) => {
      section(doc, "General nutrition notes", c.general_nutrition_notes);
      section(doc, "Food safety reminders", c.food_safety_reminders);
      section(doc, "Discuss with a dietitian or provider", c.discuss_with_a_dietitian_or_provider);
    },
  },
  {
    key: "feedingSupport",
    title: "Feeding Log Support",
    render: (doc, c) => {
      (c.feeding_log_summary || []).forEach((f) => doc.text(`•  [${f.date}] ${f.type}${f.duration_or_amount ? " — " + f.duration_or_amount : ""}`));
      doc.moveDown(0.4);
      section(doc, "Patterns observed", c.patterns_observed);
      section(doc, "Concerns for a lactation consultant", c.concerns_for_a_lactation_consultant);
    },
  },
  {
    key: "newbornCareGuide",
    title: "Newborn Care Guide",
    render: (doc, c) => {
      section(doc, "Feeding & sleep", c.feeding_and_sleep);
      section(doc, "Diapering & hygiene", c.diapering_and_hygiene);
      section(doc, "Questions to confirm with pediatrician", c.questions_to_confirm_with_pediatrician);
      section(doc, "Flag for pediatrician now", c.flag_for_pediatrician_now);
    },
  },
];

// results is a map of jobKey -> content, exactly as built by the `jobs`
// object in routes/mcp.js `/full-package`. Sections are emitted in
// SECTION_REGISTRY order, skipping any key not present in results —
// nothing here needs updating when a skill is added or removed, only
// SECTION_REGISTRY does.
export async function fullPackageToPdf(results) {
  const doc = new PDFDocument({ margin: 56 });
  const present = SECTION_REGISTRY.filter((s) => results && results[s.key]);

  doc.fontSize(22).fillColor("#2a1f2d").text("Maternal Health Companion");
  doc.fontSize(14).fillColor("#c13f6b").text("Full Package");
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#8a7686").text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#2a1f2d").text(
    present.length
      ? `This document contains: ${present.map((s) => s.title).join(", ")}.`
      : "No sections were generated for this request."
  );

  present.forEach((s, i) => {
    doc.addPage();
    doc.fontSize(16).fillColor("#c13f6b").text(`${i + 1}. ${s.titleFor ? s.titleFor(results[s.key]) : s.title}`);
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#2a1f2d");
    s.render(doc, results[s.key]);
    doc.moveDown(0.4);
  });

  doc.addPage();
  doc
    .fontSize(9)
    .fillColor("#8a7686")
    .text(
      "This is an informational and productivity tool. It is not a medical device, does not diagnose, and does not replace your healthcare provider. Letters are drafts only and not legal advice."
    );

  return streamToBuffer(doc);
}

export { SECTION_REGISTRY };
