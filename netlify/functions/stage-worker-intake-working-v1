// netlify/functions/agent-background-stage.mjs
//
// Story Orchestrator staged background worker
// Version: agent-background-stage-v2026-05-12-03-intake-stage-payload-unwrap
//
// Purpose:
// - Receives one stage payload from BuildShip /story-run/execute-stage.
// - Runs exactly one stage.
// - Posts a stage-complete callback to BuildShip /story-run/stage-complete.
// - v1 supports "intake" stage fully without OpenAI calls by using the deterministic
//   structured active stack already present in the BuildShip payload.
// - v1 returns a clean blocked/not_implemented callback for draft/rewrite/polish/finalize
//   until those stages are wired to the Agent SDK in the next iteration.
//
// Required Netlify env vars:
// - BUILDSHIP_STAGE_COMPLETE_URL=https://5gb6hf.buildship.run/story-run/stage-complete
// - AGENT_SHARED_SECRET=<optional shared secret used by BuildShip + Netlify>
// Optional env vars:
// - AGENT_STAGE_SHARED_SECRET=<stage-specific override; falls back to AGENT_SHARED_SECRET>

const AGENT_BACKGROUND_STAGE_VERSION =
  "agent-background-stage-v2026-05-12-03-intake-stage-payload-unwrap";

const ACTIVE_PACKET_KEYS = [
  "style_packet",
  "dialogue_voice_packet",
  "locked_draft_priorities_packet",
  "character_constellation_packet",
  "structural_spine_packet",
  "setpiece_symbol_architecture_packet",
  "world_setting_palette_packet",
  "thematic_moral_architecture_packet",
  "signature_verbal_deployment_packet",
  "research_authenticity_packet",
  "prestige_quality_alignment_packet"
];

const ALLOWED_STAGES = ["intake", "draft", "rewrite", "polish", "finalize"];

function getEnv(name) {
  return globalThis?.Netlify?.env?.get?.(name) ?? process?.env?.[name] ?? null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function safeString(value, fallback = null) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeCycleCount(value, fallback = 0, { min = 0, max = 10 } = {}) {
  const n = toInt(value, fallback);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function parseMaybeJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function coerceObject(value) {
  const parsed = parseMaybeJson(value, value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  return null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeDraftingBeats(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const parsed = parseMaybeJson(trimmed);
    if (Array.isArray(parsed)) return normalizeDraftingBeats(parsed);
    return trimmed
      .split(/\n+|\r+|\u2022|- /g)
      .map((item) => item.replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function mergeEmbeddedRequestPayload(rawBody) {
  if (!rawBody || typeof rawBody !== "object") return {};
  const embedded =
    coerceObject(rawBody.request_payload_json) ??
    coerceObject(rawBody.request_payload) ??
    coerceObject(rawBody.payload_json) ??
    null;
  if (!embedded) {
    console.log("[stage-worker] embedded request_payload_json present", false);
    return rawBody;
  }
  const merged = { ...embedded, ...rawBody, request_payload_json: rawBody.request_payload_json ?? JSON.stringify(embedded) };
  merged.run_config = {
    ...(embedded.run_config && typeof embedded.run_config === "object" ? embedded.run_config : {}),
    ...(rawBody.run_config && typeof rawBody.run_config === "object" ? rawBody.run_config : {})
  };
  merged.chapter_context = {
    ...(embedded.chapter_context && typeof embedded.chapter_context === "object" ? embedded.chapter_context : {}),
    ...(rawBody.chapter_context && typeof rawBody.chapter_context === "object" ? rawBody.chapter_context : {})
  };
  merged.active_stack_override = {
    ...(embedded.active_stack_override && typeof embedded.active_stack_override === "object" ? embedded.active_stack_override : {}),
    ...(rawBody.active_stack_override && typeof rawBody.active_stack_override === "object" ? rawBody.active_stack_override : {})
  };
  merged.drafting_bible_stack = {
    ...(embedded.drafting_bible_stack && typeof embedded.drafting_bible_stack === "object" ? embedded.drafting_bible_stack : {}),
    ...(rawBody.drafting_bible_stack && typeof rawBody.drafting_bible_stack === "object" ? rawBody.drafting_bible_stack : {})
  };
  for (const key of ACTIVE_PACKET_KEYS) {
    if (rawBody[key] == null && embedded[key] != null) merged[key] = embedded[key];
  }
  if (rawBody.unit_contracts == null && embedded.unit_contracts != null) merged.unit_contracts = embedded.unit_contracts;
  if (rawBody.unit_contract_override == null && embedded.unit_contract_override != null) merged.unit_contract_override = embedded.unit_contract_override;
  if (rawBody.downstream_store_requests == null && embedded.downstream_store_requests != null) merged.downstream_store_requests = embedded.downstream_store_requests;
  console.log("[stage-worker] embedded request_payload_json present", true);
  console.log("[stage-worker] embedded request_payload_json keys", Object.keys(embedded));
  return merged;
}

function packetLooksUsable(value) {
  const obj = coerceObject(value);
  if (!obj) return false;
  if (obj.source_section_number != null) return true;
  if (obj.sourceSectionNumber != null) return true;
  return Object.keys(obj).length >= 2;
}

function getIncomingPacket(payload, key) {
  const embedded = coerceObject(payload?.request_payload_json);
  const candidates = [
    payload?.[key],
    payload?.active_stack_override?.[key],
    payload?.drafting_bible_stack?.[key],
    embedded?.[key],
    embedded?.active_stack_override?.[key],
    embedded?.drafting_bible_stack?.[key]
  ];
  for (const candidate of candidates) {
    const obj = coerceObject(candidate);
    if (obj) return obj;
  }
  return null;
}

function activeStackDiagnostics(payload) {
  const present = ACTIVE_PACKET_KEYS.filter((key) => packetLooksUsable(getIncomingPacket(payload, key)));
  const missing = ACTIVE_PACKET_KEYS.filter((key) => !packetLooksUsable(getIncomingPacket(payload, key)));
  return {
    present_count: present.length,
    missing_count: missing.length,
    present,
    missing,
    has_active_stack_override: !!payload?.active_stack_override && typeof payload.active_stack_override === "object",
    active_stack_override_keys: payload?.active_stack_override && typeof payload.active_stack_override === "object" ? Object.keys(payload.active_stack_override) : [],
    has_drafting_bible_stack: !!payload?.drafting_bible_stack && typeof payload.drafting_bible_stack === "object",
    drafting_bible_stack_keys: payload?.drafting_bible_stack && typeof payload.drafting_bible_stack === "object" ? Object.keys(payload.drafting_bible_stack) : []
  };
}

function buildActiveEveryTimeStack() {
  return [
    [12, "Chapter-by-Chapter Breakdown", "unit_contracts", "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."],
    [3, "Writing Style & Narrative Voice", "style_packet", "Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling."],
    [15, "Dialogue & Voice Cheat Sheet", "dialogue_voice_packet", "Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline."],
    [19, "Locked Draft Priorities", "locked_draft_priorities_packet", "Controls nonnegotiable priorities, do-not-change items, lock points, and veto constraints."],
    [7, "Cast / Character Constellation", "character_constellation_packet", "Controls relationship geometry, social vectors, attraction-conflict axes, trust fault lines, and who matters in the room."],
    [11, "Structural Spine", "structural_spine_packet", "Supports sequence placement, escalation logic, handoff force, and setup/payoff tracking."],
    [13, "Set-Pieces & Symbol Architecture", "setpiece_symbol_architecture_packet", "Controls set-piece intent, symbolic object deployment, visual escalation, and scene architecture pressure."],
    [8, "World, Setting & Cinematic Palette", "world_setting_palette_packet", "Supports setting texture, city palette, environmental pressure, and institutional surface cues."],
    [9, "Thematic Spine & Moral Architecture", "thematic_moral_architecture_packet", "Controls thematic pressure, moral contradictions, private/public cost lines, and meaning under action."],
    [21, "Signature Verbal Identity and Franchise Deployment", "signature_verbal_deployment_packet", "Sharpens signature language, recurring phrase motifs, and franchise verbal deployment."],
    [18, "Research & Authenticity Bible", "research_authenticity_packet", "Controls procedural truth, terminology discipline, realism boundaries, and authenticity anchors."],
    [4, "Prestige Quality Alignment", "prestige_quality_alignment_packet", "Supports prestige calibration, anti-generic control, audience promise, and publish-ready quality pressure."]
  ].map(([section_number, section_name, packet_name, drafting_role]) => ({ section_number, section_name, packet_name, drafting_role }));
}

function buildDefaultDownstreamStoreRequests() {
  return {
    drafting_rules_request: {
      store_name: "VeritasStudioStore",
      document_name: "DraftingHouseRules.pdf",
      required_for_operations: ["draft", "evaluate", "rewrite"],
      priority_rules: ["12", "13", "13A", "22", "23"],
      structure_lock_policy: "not_required"
    },
    polish_rules_request: {
      store_name: "VeritasStudioStore",
      document_name: "PolishHouseRules.pdf",
      required_for_operations: ["polish"],
      priority_rules: [],
      structure_lock_policy: "required"
    }
  };
}

function normalizeUnitContract(payload) {
  const direct = coerceObject(payload?.unit_contract_override) ?? coerceObject(payload?.unit_contract) ?? coerceObject(payload?.chapter_unit_contract) ?? null;
  const manifestRow = direct ?? coerceObject(payload?.chapter_manifest_entry) ?? coerceObject(payload?.selected_chapter_manifest) ?? coerceObject(payload?.project_chapter_manifest_row) ?? coerceObject(payload?.chapter_manifest_json) ?? null;
  if (!manifestRow || typeof manifestRow !== "object") return null;
  const chapterNumber = firstNonEmpty(manifestRow.chapter_number, manifestRow.selected_chapter_number, payload?.selected_chapter_number, payload?.chapter_context?.chapter_number);
  const chapterTitle = firstNonEmpty(manifestRow.chapter_title, manifestRow.selected_chapter_title, manifestRow.title, payload?.selected_chapter_title, payload?.chapter_context?.chapter_title);
  const unitLabel = firstNonEmpty(manifestRow.unit_label, manifestRow.selected_unit_label, manifestRow.chapter_label, payload?.selected_unit_label, payload?.current_unit_label, payload?.chapter_context?.unit_label, chapterNumber && chapterTitle ? `Chapter ${chapterNumber} - ${chapterTitle}` : null, chapterNumber ? `Chapter ${chapterNumber}` : null);
  const normalized = {
    source_section_number: Number(manifestRow.source_section_number ?? 12),
    movement_label: String(firstNonEmpty(manifestRow.movement_label, manifestRow.movement, "") ?? ""),
    movement_approximate_length: firstNonEmpty(manifestRow.movement_approximate_length, manifestRow.movement_length, manifestRow.approximate_length),
    unit_label: String(unitLabel ?? ""),
    target_word_count: firstNonEmpty(manifestRow.target_word_count, manifestRow.word_count, manifestRow.target_words),
    pov: String(firstNonEmpty(manifestRow.pov, manifestRow.point_of_view, "") ?? ""),
    setting: String(firstNonEmpty(manifestRow.setting, manifestRow.location, "") ?? ""),
    objective: String(firstNonEmpty(manifestRow.objective, manifestRow.chapter_objective, "") ?? ""),
    conflict: String(firstNonEmpty(manifestRow.conflict, manifestRow.chapter_conflict, "") ?? ""),
    reversal: String(firstNonEmpty(manifestRow.reversal, manifestRow.turn, manifestRow.chapter_reversal, "") ?? ""),
    reveal: String(firstNonEmpty(manifestRow.reveal, manifestRow.revelation, manifestRow.chapter_reveal, "") ?? ""),
    carry_forward: String(firstNonEmpty(manifestRow.carry_forward, manifestRow.carryforward, manifestRow.carry_forward_summary, "") ?? ""),
    ending_hook: String(firstNonEmpty(manifestRow.ending_hook, manifestRow.hook, manifestRow.chapter_ending_hook, "") ?? ""),
    drafting_beats: normalizeDraftingBeats(manifestRow.drafting_beats ?? manifestRow.beats ?? manifestRow.chapter_beats ?? manifestRow.draft_beats)
  };
  if (!normalized.unit_label) return null;
  return normalized;
}

function normalizeUnitContracts(payload) {
  const raw = payload?.unit_contracts ?? coerceObject(payload?.request_payload_json)?.unit_contracts ?? null;
  const parsed = parseMaybeJson(raw, raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.unit_contracts)) return parsed.unit_contracts;
  if (parsed && typeof parsed === "object" && parsed.unit_contract_override) return [parsed.unit_contract_override];
  const fallback = normalizeUnitContract(payload);
  return fallback ? [fallback] : [];
}

function getChapterContext(payload, unitLabel) {
  const incoming = payload?.chapter_context && typeof payload.chapter_context === "object" ? payload.chapter_context : {};
  return {
    chapter_number: incoming.chapter_number ?? payload?.selected_chapter_number ?? payload?.current_chapter_number ?? payload?.chapter_number ?? null,
    chapter_title: incoming.chapter_title ?? payload?.selected_chapter_title ?? payload?.current_chapter_title ?? payload?.chapter_title ?? null,
    unit_label: incoming.unit_label ?? unitLabel,
    prior_chapter_summary: incoming.prior_chapter_summary ?? null,
    prior_chapter_end_snippet: incoming.prior_chapter_end_snippet ?? null,
    prior_chapter_ending_condition: incoming.prior_chapter_ending_condition ?? null
  };
}

function getRunConfig(payload) {
  const incoming = payload?.run_config && typeof payload.run_config === "object" ? payload.run_config : {};
  return {
    rewrite_cycles: incoming.rewrite_cycles ?? payload?.rewrite_cycles ?? null,
    polish_cycles: incoming.polish_cycles ?? payload?.polish_cycles ?? null,
    mode: incoming.mode ?? payload?.execution_mode ?? payload?.mode ?? null
  };
}

function buildNode1Packet(payload, unitLabel) {
  return {
    story_run_id: payload?.story_run_id ?? null,
    project_id: payload?.project_id ?? null,
    chapter_worker_version: payload?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    chapter_context: getChapterContext(payload, unitLabel),
    run_config: getRunConfig(payload),
    status: "ready",
    requested_operation: "draft",
    resolved_scope: `single_chapter: ${unitLabel}`,
    target_units_requested: [unitLabel],
    canon_basis: "master_story_bible",
    active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
    drafting_bible_stack: { active_every_time: buildActiveEveryTimeStack() },
    downstream_store_requests: buildDefaultDownstreamStoreRequests(),
    missing_required_inputs: [],
    blocked_reasons: [],
    next_node: "N2_Unit_Contract_Builder"
  };
}

function buildNode2Packet(payload, node1Packet) {
  const diagnostics = activeStackDiagnostics(payload);
  const unitContracts = normalizeUnitContracts(payload);
  const firstUnit = unitContracts[0] ?? {};
  const unitLabel = firstNonEmpty(firstUnit.unit_label, payload?.selected_unit_label, payload?.current_unit_label, payload?.chapter_context?.unit_label, node1Packet?.target_units_requested?.[0]) ?? "Chapter";
  const missingPackets = ACTIVE_PACKET_KEYS.filter((key) => !packetLooksUsable(getIncomingPacket(payload, key)));
  if (unitContracts.length === 0 || missingPackets.length > 0) {
    return {
      story_run_id: payload?.story_run_id ?? null,
      project_id: payload?.project_id ?? null,
      chapter_worker_version: payload?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
      chapter_context: getChapterContext(payload, unitLabel),
      run_config: getRunConfig(payload),
      status: "needs_input",
      requested_operation: "draft",
      resolved_scope: `single_chapter: ${unitLabel}`,
      target_units_requested: [unitLabel],
      canon_basis: "master_story_bible",
      active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
      drafting_bible_stack: { active_every_time: buildActiveEveryTimeStack() },
      unit_contracts: unitContracts,
      downstream_store_requests: buildDefaultDownstreamStoreRequests(),
      missing_required_inputs: [...(unitContracts.length === 0 ? ["unit_contracts"] : []), ...missingPackets],
      blocked_reasons: [],
      next_node: "",
      diagnostics
    };
  }
  return {
    story_run_id: payload?.story_run_id ?? node1Packet?.story_run_id ?? null,
    project_id: payload?.project_id ?? node1Packet?.project_id ?? null,
    chapter_worker_version: payload?.chapter_worker_version ?? node1Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    chapter_context: getChapterContext(payload, unitLabel),
    run_config: getRunConfig(payload),
    status: "ready",
    requested_operation: "draft",
    resolved_scope: node1Packet?.resolved_scope ?? `single_chapter: ${unitLabel}`,
    target_units_requested: [unitLabel],
    canon_basis: "master_story_bible",
    active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
    drafting_bible_stack: { active_every_time: buildActiveEveryTimeStack() },
    style_packet: getIncomingPacket(payload, "style_packet"),
    dialogue_voice_packet: getIncomingPacket(payload, "dialogue_voice_packet"),
    locked_draft_priorities_packet: getIncomingPacket(payload, "locked_draft_priorities_packet"),
    character_constellation_packet: getIncomingPacket(payload, "character_constellation_packet"),
    structural_spine_packet: getIncomingPacket(payload, "structural_spine_packet"),
    setpiece_symbol_architecture_packet: getIncomingPacket(payload, "setpiece_symbol_architecture_packet"),
    world_setting_palette_packet: getIncomingPacket(payload, "world_setting_palette_packet"),
    thematic_moral_architecture_packet: getIncomingPacket(payload, "thematic_moral_architecture_packet"),
    signature_verbal_deployment_packet: getIncomingPacket(payload, "signature_verbal_deployment_packet"),
    research_authenticity_packet: getIncomingPacket(payload, "research_authenticity_packet"),
    prestige_quality_alignment_packet: getIncomingPacket(payload, "prestige_quality_alignment_packet"),
    unit_contracts: unitContracts,
    downstream_store_requests: payload?.downstream_store_requests ?? buildDefaultDownstreamStoreRequests(),
    missing_required_inputs: [],
    blocked_reasons: [],
    next_node: "N3_Chapter_Drafter",
    diagnostics
  };
}

function buildConversationHistoryJson(packets) {
  const items = [];
  for (const [label, packet] of packets) {
    items.push({ role: "user", content: [{ type: "input_text", text: `${label}\n${JSON.stringify(packet)}` }] });
  }
  return JSON.stringify(items);
}

function buildIntakeStageResult(payload) {
  const unitContracts = normalizeUnitContracts(payload);
  const unitLabel = firstNonEmpty(unitContracts?.[0]?.unit_label, payload?.selected_unit_label, payload?.current_unit_label, payload?.chapter_context?.unit_label, "Chapter") ?? "Chapter";
  const node1Packet = buildNode1Packet(payload, unitLabel);
  const node2Packet = buildNode2Packet(payload, node1Packet);
  const ready = node2Packet.status === "ready";
  const rewriteCyclesConfigured = safeCycleCount(payload?.run_config?.rewrite_cycles ?? payload?.rewrite_cycles, 1, { min: 0, max: 4 });
  const polishCyclesConfigured = safeCycleCount(payload?.run_config?.polish_cycles ?? payload?.polish_cycles, 1, { min: 0, max: 2 });
  return {
    ok: ready,
    story_run_id: payload.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    stage: "intake",
    stage_status: ready ? "completed" : "needs_input",
    next_stage: ready ? "draft" : "",
    current_node: "Node 2",
    stage_started_at: payload.stage_started_at ?? null,
    stage_completed_at: new Date().toISOString(),
    rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
    remaining_rewrite_cycles: payload.remaining_rewrite_cycles != null ? safeCycleCount(payload.remaining_rewrite_cycles, rewriteCyclesConfigured, { min: 0, max: 4 }) : rewriteCyclesConfigured,
    polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
    remaining_polish_cycles: payload.remaining_polish_cycles != null ? safeCycleCount(payload.remaining_polish_cycles, polishCyclesConfigured, { min: 0, max: 2 }) : polishCyclesConfigured,
    latest_node1_json: JSON.stringify(node1Packet),
    latest_node2_json: JSON.stringify(node2Packet),
    conversation_history_json: buildConversationHistoryJson([
      ["STAGE_INTAKE_NODE1_PACKET", node1Packet],
      ["STAGE_INTAKE_NODE2_PACKET", node2Packet]
    ]),
    result_payload_json: {
      ok: ready,
      agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
      stage: "intake",
      node1_status: node1Packet.status,
      node2_status: node2Packet.status,
      unit_label: unitLabel,
      diagnostics: node2Packet.diagnostics ?? activeStackDiagnostics(payload)
    },
    error_message: ready ? null : `Intake stage needs input: ${(node2Packet.missing_required_inputs ?? []).join("; ")}`,
    stage_error_message: ready ? null : `Intake stage needs input: ${(node2Packet.missing_required_inputs ?? []).join("; ")}`
  };
}

function buildNotImplementedStageResult(payload, stage) {
  return {
    ok: false,
    story_run_id: payload.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    stage,
    stage_status: "blocked",
    next_stage: stage,
    current_node: `stage:${stage}:not_implemented`,
    stage_started_at: payload.stage_started_at ?? null,
    stage_completed_at: new Date().toISOString(),
    rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
    remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
    polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
    remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }),
    result_payload_json: {
      ok: false,
      agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
      stage,
      error_type: "stage_not_implemented",
      message: `Stage '${stage}' is intentionally blocked in v1. Deploy the next stage-worker revision to enable it.`
    },
    error_message: `Stage '${stage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`,
    stage_error_message: `Stage '${stage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`
  };
}


function unwrapStagePayload(body) {
  if (!body || typeof body !== "object") return body;

  if (
    body.stage_payload &&
    typeof body.stage_payload === "object" &&
    !Array.isArray(body.stage_payload)
  ) {
    return body.stage_payload;
  }

  if (typeof body.stage_payload_json === "string") {
    try {
      const parsed = JSON.parse(body.stage_payload_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error("[agent-background-stage] Failed to parse stage_payload_json", error);
    }
  }

  return body;
}

function buildStageResult(body) {
  const payload = mergeEmbeddedRequestPayload(body);
  const stage = safeString(payload.stage, "intake");
  if (!ALLOWED_STAGES.includes(stage)) {
    return {
      ok: false,
      story_run_id: payload.story_run_id ?? null,
      chapter_run_id: payload.chapter_run_id ?? null,
      stage,
      stage_status: "failed",
      next_stage: "",
      current_node: "stage:invalid",
      stage_completed_at: new Date().toISOString(),
      result_payload_json: { ok: false, error_type: "invalid_stage", allowed_stages: ALLOWED_STAGES, received_stage: stage },
      error_message: `Invalid stage '${stage}'.`,
      stage_error_message: `Invalid stage '${stage}'.`
    };
  }
  if (stage === "intake") return buildIntakeStageResult(payload);
  return buildNotImplementedStageResult(payload, stage);
}

function getStageCompleteUrl() {
  return getEnv("BUILDSHIP_STAGE_COMPLETE_URL") || getEnv("BUILDSHIP_STORY_RUN_STAGE_COMPLETE_URL") || getEnv("BUILDSHIP_STAGE_CALLBACK_URL") || null;
}

async function postStageComplete(stageResult) {
  const stageCompleteUrl = getStageCompleteUrl();
  if (!stageCompleteUrl) {
    console.error("[agent-background-stage] Missing BUILDSHIP_STAGE_COMPLETE_URL");
    console.error("[agent-background-stage] Stage payload was:", JSON.stringify(stageResult).slice(0, 4000));
    return { ok: false, error: "Missing BUILDSHIP_STAGE_COMPLETE_URL" };
  }
  const sharedSecret = getEnv("AGENT_STAGE_SHARED_SECRET") || getEnv("AGENT_SHARED_SECRET") || null;
  const headers = { "Content-Type": "application/json" };
  if (sharedSecret) headers["x-agent-secret"] = sharedSecret;
  const startedAt = Date.now();
  const response = await fetch(stageCompleteUrl, {
    method: "POST",
    headers,
    // BuildShip /story-run/stage-complete now expects a flat callback payload,
    // not { callback: ... }.
    body: JSON.stringify(stageResult)
  });
  const responseText = await response.text();
  console.log("[agent-background-stage] stage callback status", response.status);
  console.log("[agent-background-stage] stage callback elapsed_ms", Date.now() - startedAt);
  console.log("[agent-background-stage] stage callback preview", responseText.slice(0, 1000));
  return { ok: response.ok, status: response.status, response_preview: responseText.slice(0, 1000) };
}

export default async (req, context) => {
  const invokedAt = new Date().toISOString();
  let parsedBodyForFailure = {};
  try {
    if (req.method !== "POST") {
      console.error("[agent-background-stage] Method not allowed", req.method);
      return json({ ok: false, error: "Method not allowed" }, 405);
    }
    const sharedSecret = getEnv("AGENT_STAGE_SHARED_SECRET") || getEnv("AGENT_SHARED_SECRET") || null;
    if (sharedSecret) {
      const providedSecret = req.headers.get("x-agent-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (providedSecret !== sharedSecret) {
        console.error("[agent-background-stage] Unauthorized request");
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
    }
    let body = {};
    try {
      body = await req.json();
      parsedBodyForFailure = body;
    } catch (error) {
      console.error("[agent-background-stage] Invalid JSON body", error);
      const failurePayload = {
        ok: false,
        story_run_id: null,
        chapter_run_id: null,
        stage: null,
        stage_status: "failed",
        current_node: "stage:request:json_parse",
        stage_completed_at: new Date().toISOString(),
        error_message: "Invalid JSON body",
        stage_error_message: "Invalid JSON body",
        result_payload_json: { ok: false, error_type: "invalid_json_body", agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION }
      };
      await postStageComplete(failurePayload);
      return json(failurePayload, 400);
    }
    console.log("[agent-background-stage] invoked_at", invokedAt);
    console.log("[agent-background-stage] received_keys", Object.keys(body || {}));
    console.log("[agent-background-stage] story_run_id", body?.story_run_id ?? null);
    console.log("[agent-background-stage] chapter_run_id", body?.chapter_run_id ?? null);
    console.log("[agent-background-stage] stage", body?.stage ?? null);

    if (body?.debug_env === true || body?.ping === true || body?.debug_ping === true || body?.ping === "test") {
      const debugPayload = {
        ok: true,
        story_run_id: body?.story_run_id ?? "stage_debug",
        chapter_run_id: body?.chapter_run_id ?? null,
        stage: body?.stage ?? "debug",
        stage_status: "completed",
        next_stage: "",
        current_node: "debug",
        stage_completed_at: new Date().toISOString(),
        result_payload_json: {
          ok: true,
          mode: body?.debug_env === true ? "debug_env" : "stage_background_ping",
          agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
          has_stage_complete_url: !!getStageCompleteUrl(),
          has_agent_shared_secret: !!sharedSecret,
          received_at: new Date().toISOString(),
          received_keys: Object.keys(body || {})
        },
        error_message: null,
        stage_error_message: null
      };
      await postStageComplete(debugPayload);
      return json(debugPayload, 200);
    }

    const effectiveBody = unwrapStagePayload(body);

    console.log("[agent-background-stage] effective_body_keys", Object.keys(effectiveBody || {}));
    console.log("[agent-background-stage] effective_story_run_id", effectiveBody?.story_run_id ?? null);
    console.log("[agent-background-stage] effective_chapter_run_id", effectiveBody?.chapter_run_id ?? null);
    console.log("[agent-background-stage] effective_stage", effectiveBody?.stage ?? null);

    if (!effectiveBody?.story_run_id || !effectiveBody?.chapter_run_id || !effectiveBody?.stage) {
      const failurePayload = {
        ok: false,
        story_run_id: effectiveBody?.story_run_id ?? body?.story_run_id ?? null,
        chapter_run_id: effectiveBody?.chapter_run_id ?? body?.chapter_run_id ?? null,
        stage: effectiveBody?.stage ?? body?.stage ?? null,
        stage_status: "failed",
        next_stage: "",
        current_node: "stage:request:validation",
        stage_completed_at: new Date().toISOString(),
        error_message: "Stage payload must include story_run_id, chapter_run_id, and stage.",
        stage_error_message: "Stage payload must include story_run_id, chapter_run_id, and stage.",
        result_payload_json: {
          ok: false,
          error_type: "missing_required_stage_fields",
          received_keys: Object.keys(body || {}),
          effective_body_keys: Object.keys(effectiveBody || {}),
          agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION
        }
      };
      await postStageComplete(failurePayload);
      return json(failurePayload, 400);
    }

    const stageResult = buildStageResult(effectiveBody);
    const callbackResult = await postStageComplete(stageResult);
    return json({
      accepted: true,
      ok: stageResult.ok,
      story_run_id: stageResult.story_run_id,
      chapter_run_id: stageResult.chapter_run_id,
      stage: stageResult.stage,
      stage_status: stageResult.stage_status,
      current_node: stageResult.current_node,
      callback: callbackResult,
      agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION
    }, 200);
  } catch (error) {
    console.error("[agent-background-stage] failed", error);
    const failurePayload = {
      ok: false,
      story_run_id: parsedBodyForFailure?.story_run_id ?? null,
      chapter_run_id: parsedBodyForFailure?.chapter_run_id ?? null,
      stage: parsedBodyForFailure?.stage ?? null,
      stage_status: "failed",
      next_stage: "",
      current_node: "stage:exception",
      stage_completed_at: new Date().toISOString(),
      error_message: error?.message ?? String(error),
      stage_error_message: error?.message ?? String(error),
      result_payload_json: { ok: false, error_type: "stage_worker_exception", agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION, stack: error?.stack ?? null }
    };
    await postStageComplete(failurePayload);
    return json(failurePayload, 500);
  }
};
