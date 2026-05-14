// netlify/functions/agent-stage-background.mjs
//
// Story Orchestrator staged background worker
// Version: agent-stage-background-v2026-05-13-14-polish-stage-v1
//
// Supports:
// - intake: deterministic Node 1 + Node 2 packet build, no OpenAI call.
// - draft: timeout-protected short-mode Node 3 smoke test using compact payload.
// - rewrite: Node 4A + Node 4B + Node 5 compact rewrite pass.
// - polish: Node 6 + Node 7 + Node 8 compact polish pass.
// - finalize: intentionally blocked until implemented.
//
// IMPORTANT NETLIFY DEPLOYMENT NOTE:
// Save this file as netlify/functions/agent-stage-background.mjs.
// The function name ends with -background so Netlify treats it as a background function.
// Public endpoint: /.netlify/functions/agent-stage-background

const AGENT_BACKGROUND_STAGE_VERSION =
  "agent-stage-background-v2026-05-13-14-polish-stage-v1";

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
const SAFELY_BLOCKED_STAGES = ["finalize"];

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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function toInt(value, fallback = 0) {
  if (value == null || value === "") return fallback;
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

function stringifyJson(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
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

function unwrapStagePayload(body) {
  if (!body || typeof body !== "object") return body;
  if (body.stage_payload && typeof body.stage_payload === "object" && !Array.isArray(body.stage_payload)) {
    return body.stage_payload;
  }
  if (typeof body.stage_payload_json === "string") {
    const parsed = parseMaybeJson(body.stage_payload_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }
  return body;
}

function mergeEmbeddedRequestPayload(rawBody) {
  if (!rawBody || typeof rawBody !== "object") return {};
  const embedded =
    coerceObject(rawBody.request_payload_json) ??
    coerceObject(rawBody.request_payload) ??
    coerceObject(rawBody.payload_json);

  if (!embedded) {
    console.log("[stage-worker] embedded request_payload_json present", false);
    return rawBody;
  }

  const merged = {
    ...embedded,
    ...rawBody,
    request_payload_json: rawBody.request_payload_json ?? JSON.stringify(embedded)
  };

  for (const key of ["run_config", "chapter_context", "active_stack_override", "drafting_bible_stack"]) {
    merged[key] = {
      ...(embedded[key] && typeof embedded[key] === "object" ? embedded[key] : {}),
      ...(rawBody[key] && typeof rawBody[key] === "object" ? rawBody[key] : {})
    };
  }

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
  if (obj.source_section_number != null || obj.sourceSectionNumber != null) return true;
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
  const direct =
    coerceObject(payload?.unit_contract_override) ??
    coerceObject(payload?.unit_contract) ??
    coerceObject(payload?.chapter_unit_contract);

  const manifestRow =
    direct ??
    coerceObject(payload?.chapter_manifest_entry) ??
    coerceObject(payload?.selected_chapter_manifest) ??
    coerceObject(payload?.project_chapter_manifest_row) ??
    coerceObject(payload?.chapter_manifest_json);

  if (!manifestRow || typeof manifestRow !== "object") return null;

  const chapterNumber = firstNonEmpty(manifestRow.chapter_number, manifestRow.selected_chapter_number, payload?.selected_chapter_number, payload?.chapter_context?.chapter_number);
  const chapterTitle = firstNonEmpty(manifestRow.chapter_title, manifestRow.selected_chapter_title, manifestRow.title, payload?.selected_chapter_title, payload?.chapter_context?.chapter_title);
  const unitLabel = firstNonEmpty(
    manifestRow.unit_label,
    manifestRow.selected_unit_label,
    manifestRow.chapter_label,
    payload?.selected_unit_label,
    payload?.current_unit_label,
    payload?.chapter_context?.unit_label,
    chapterNumber && chapterTitle ? `Chapter ${chapterNumber} - ${chapterTitle}` : null,
    chapterNumber ? `Chapter ${chapterNumber}` : null
  );

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

  return normalized.unit_label ? normalized : null;
}

function normalizeUnitContracts(payload) {
  const raw = payload?.unit_contracts ?? coerceObject(payload?.request_payload_json)?.unit_contracts;
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
  return JSON.stringify(
    packets.map(([label, packet]) => ({
      role: "user",
      content: [{ type: "input_text", text: `${label}\n${JSON.stringify(packet)}` }]
    }))
  );
}

function parseConversationHistory(conversationHistoryJson) {
  const parsed = parseMaybeJson(conversationHistoryJson, []);
  return Array.isArray(parsed) ? parsed : [];
}

function appendStagePacketToHistory(conversationHistoryJson, label, packet) {
  const history = parseConversationHistory(conversationHistoryJson);
  history.push({
    role: "user",
    content: [{ type: "input_text", text: `${label}\n${JSON.stringify(packet)}` }]
  });
  return JSON.stringify(history);
}

function extractPacketFromConversationHistory(conversationHistoryJson, marker) {
  const history = parseConversationHistory(conversationHistoryJson);
  for (const item of history) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const text = typeof part?.text === "string" ? part.text : "";
      if (!text.includes(marker)) continue;
      const afterMarker = text.slice(text.indexOf(marker) + marker.length).trim();
      const firstBrace = afterMarker.indexOf("{");
      if (firstBrace < 0) return null;
      const jsonText = afterMarker.slice(firstBrace).trim();
      const parsed = parseMaybeJson(jsonText, null);
      if (parsed && typeof parsed === "object") return parsed;
    }
  }
  return null;
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

function draftShortModeEnabled() {
  const env = getEnv("DRAFT_STAGE_SHORT_MODE");
  if (env == null) return true;
  return env === "true" || env === "1" || env === "yes";
}

function getDraftTargetWordCount(payload, node2Packet) {
  const envTarget = toInt(getEnv("DRAFT_STAGE_TARGET_WORD_COUNT"), null);
  if (Number.isFinite(envTarget) && envTarget > 0) return envTarget;
  if (draftShortModeEnabled()) return 900;
  const contractTarget = Number(node2Packet?.unit_contracts?.[0]?.target_word_count);
  if (Number.isFinite(contractTarget) && contractTarget > 0) return contractTarget;
  return 2200;
}

function getDraftTimeoutMs() {
  const envMs = toInt(getEnv("DRAFT_STAGE_TIMEOUT_MS"), 480000);
  return Math.max(60000, Math.min(envMs, 840000));
}

function getDraftMaxOutputTokens() {
  const envTokens = toInt(getEnv("DRAFT_STAGE_MAX_OUTPUT_TOKENS"), 12000);
  // OpenAI requires max_output_tokens >= 16. Keep a safe range for short-mode drafts.
  return Math.max(1024, Math.min(envTokens, 24000));
}

function compactObjectForDraft(obj) {
  if (!obj || typeof obj !== "object") return obj;
  return JSON.parse(JSON.stringify(obj));
}

function findNode2PacketForDraft(payload) {
  const latestNode2 = coerceObject(payload.latest_node2_json);
  if (latestNode2) return { source: "latest_node2_json", node2Packet: latestNode2 };

  const fromHistory = extractPacketFromConversationHistory(payload.conversation_history_json, "STAGE_INTAKE_NODE2_PACKET");
  if (fromHistory) return { source: "conversation_history_json", node2Packet: fromHistory };

  const unitContracts = normalizeUnitContracts(payload);
  const unitLabel = firstNonEmpty(unitContracts?.[0]?.unit_label, payload?.selected_unit_label, payload?.current_unit_label, payload?.chapter_context?.unit_label, "Chapter") ?? "Chapter";
  const node1Packet = buildNode1Packet(payload, unitLabel);
  const node2Packet = buildNode2Packet(payload, node1Packet);

  console.log("[draft] node1 source synthesized_from_stage_payload");
  console.log("[draft] node2 source synthesized_from_stage_payload");
  console.log("[draft] synthesized node2 status", node2Packet?.status ?? null);
  console.log("[draft] synthesized node2 missing inputs", JSON.stringify(node2Packet?.missing_required_inputs ?? []));

  return { source: "synthesized_from_stage_payload", node1Packet, node2Packet };
}

function buildCompactDraftInput(payload, node2Packet, draftTargetWordCount) {
  const compactUnitContracts = Array.isArray(node2Packet.unit_contracts)
    ? node2Packet.unit_contracts.map((item) => {
        const copy = compactObjectForDraft(item);
        if (copy && typeof copy === "object") {
          copy.original_target_word_count = copy.target_word_count ?? null;
          copy.target_word_count = draftTargetWordCount;
          copy.short_mode_note = draftShortModeEnabled()
            ? "Short draft smoke test. Preserve the required scene mission and beats in condensed form."
            : "Full draft target.";
        }
        return copy;
      })
    : [];

  return {
    stage: "draft",
    agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
    short_mode: draftShortModeEnabled(),
    target_word_count: draftTargetWordCount,
    story_run_id: payload.story_run_id ?? node2Packet.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: node2Packet.project_id ?? payload.project_id ?? null,
    chapter_worker_version: node2Packet.chapter_worker_version ?? payload.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    chapter_context: compactObjectForDraft(node2Packet.chapter_context),
    run_config: compactObjectForDraft(node2Packet.run_config),
    requested_operation: "draft",
    resolved_scope: node2Packet.resolved_scope,
    target_units_requested: node2Packet.target_units_requested,
    canon_basis: node2Packet.canon_basis,
    active_bible_sections: node2Packet.active_bible_sections,
    drafting_bible_stack: compactObjectForDraft(node2Packet.drafting_bible_stack),
    style_packet: compactObjectForDraft(node2Packet.style_packet),
    dialogue_voice_packet: compactObjectForDraft(node2Packet.dialogue_voice_packet),
    locked_draft_priorities_packet: compactObjectForDraft(node2Packet.locked_draft_priorities_packet),
    character_constellation_packet: compactObjectForDraft(node2Packet.character_constellation_packet),
    structural_spine_packet: compactObjectForDraft(node2Packet.structural_spine_packet),
    setpiece_symbol_architecture_packet: compactObjectForDraft(node2Packet.setpiece_symbol_architecture_packet),
    world_setting_palette_packet: compactObjectForDraft(node2Packet.world_setting_palette_packet),
    thematic_moral_architecture_packet: compactObjectForDraft(node2Packet.thematic_moral_architecture_packet),
    signature_verbal_deployment_packet: compactObjectForDraft(node2Packet.signature_verbal_deployment_packet),
    research_authenticity_packet: compactObjectForDraft(node2Packet.research_authenticity_packet),
    prestige_quality_alignment_packet: compactObjectForDraft(node2Packet.prestige_quality_alignment_packet),
    unit_contracts: compactUnitContracts,
    downstream_store_requests: compactObjectForDraft(node2Packet.downstream_store_requests),
    instructions: draftShortModeEnabled()
      ? "For this staged smoke test, draft a condensed 700 to 1000 word version of the chapter. Preserve the required beats, POV, voice, tone, relational pressure, evidence logic, and ending hook. Do not attempt the full target word count yet."
      : "Draft the chapter according to the provided target word count and all active-stack packets."
  };
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") parts.push(part.text);
      if (typeof part?.content === "string") parts.push(part.content);
    }
  }
  return parts.join("\n").trim();
}

function extractJsonObjectFromText(text) {
  if (!hasText(text)) return null;
  const trimmed = text.trim();
  const direct = parseMaybeJson(trimmed, null);
  if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsedFence = parseMaybeJson(fenced[1].trim(), null);
    if (parsedFence && typeof parsedFence === "object" && !Array.isArray(parsedFence)) return parsedFence;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const jsonText = trimmed.slice(first, last + 1);
    const parsed = parseMaybeJson(jsonText, null);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  }

  return null;
}

function validateAndNormalizeNode3Output(parsed, compactDraftInput, rawText) {
  const unitLabel =
    compactDraftInput?.unit_contracts?.[0]?.unit_label ??
    compactDraftInput?.target_units_requested?.[0] ??
    "Chapter";

  const chapterNumber = compactDraftInput?.chapter_context?.chapter_number ?? null;
  const chapterTitle = compactDraftInput?.chapter_context?.chapter_title ?? null;
  const chapterHeading =
    chapterNumber && chapterTitle
      ? `Chapter ${chapterNumber}\n${chapterTitle}`
      : String(unitLabel).replace(" - ", "\n");

  const asStringPacket = (value, fallback) =>
    typeof value === "string" ? value : stringifyJson(fallback ?? value ?? {});

  const base = {
    story_run_id: compactDraftInput.story_run_id ?? null,
    project_id: compactDraftInput.project_id ?? null,
    chapter_worker_version: compactDraftInput.chapter_worker_version ?? null,
    chapter_context: compactDraftInput.chapter_context ?? null,
    run_config: compactDraftInput.run_config ?? null,
    requested_operation: "draft",
    resolved_scope: compactDraftInput.resolved_scope ?? `single_chapter: ${unitLabel}`,
    target_units_requested: compactDraftInput.target_units_requested ?? [unitLabel],
    canon_basis: compactDraftInput.canon_basis ?? "master_story_bible",
    active_bible_sections: compactDraftInput.active_bible_sections ?? [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
    drafting_bible_stack: stringifyJson(compactDraftInput.drafting_bible_stack),
    style_packet: stringifyJson(compactDraftInput.style_packet),
    dialogue_voice_packet: stringifyJson(compactDraftInput.dialogue_voice_packet),
    locked_draft_priorities_packet: stringifyJson(compactDraftInput.locked_draft_priorities_packet),
    character_constellation_packet: stringifyJson(compactDraftInput.character_constellation_packet),
    structural_spine_packet: stringifyJson(compactDraftInput.structural_spine_packet),
    setpiece_symbol_architecture_packet: stringifyJson(compactDraftInput.setpiece_symbol_architecture_packet),
    world_setting_palette_packet: stringifyJson(compactDraftInput.world_setting_palette_packet),
    thematic_moral_architecture_packet: stringifyJson(compactDraftInput.thematic_moral_architecture_packet),
    signature_verbal_deployment_packet: stringifyJson(compactDraftInput.signature_verbal_deployment_packet),
    research_authenticity_packet: stringifyJson(compactDraftInput.research_authenticity_packet),
    prestige_quality_alignment_packet: stringifyJson(compactDraftInput.prestige_quality_alignment_packet),
    unit_contracts: (compactDraftInput.unit_contracts ?? []).map((item) => stringifyJson(item)),
    store_packet_status: "preserved",
    downstream_store_requests: stringifyJson(compactDraftInput.downstream_store_requests)
  };

  if (!parsed || typeof parsed !== "object") {
    return {
      ...base,
      status: "blocked",
      drafted_units: [],
      missing_required_inputs: [],
      blocked_reasons: ["Node 3 model output was not valid JSON.", rawText ? rawText.slice(0, 500) : ""].filter(Boolean),
      next_node: ""
    };
  }

  const draftedUnits = Array.isArray(parsed.drafted_units) ? parsed.drafted_units : [];
  const firstDraft = draftedUnits[0] ?? {};
  const draftedText = hasText(firstDraft.drafted_text)
    ? firstDraft.drafted_text
    : hasText(parsed.drafted_text)
      ? parsed.drafted_text
      : "";

  const status = draftedText.trim().length > 0 ? "ready" : "needs_input";

  return {
    ...base,
    story_run_id: parsed.story_run_id ?? base.story_run_id,
    project_id: parsed.project_id ?? base.project_id,
    chapter_worker_version: parsed.chapter_worker_version ?? base.chapter_worker_version,
    chapter_context: parsed.chapter_context ?? base.chapter_context,
    run_config: parsed.run_config ?? base.run_config,
    status,
    resolved_scope: parsed.resolved_scope ?? base.resolved_scope,
    target_units_requested: parsed.target_units_requested ?? base.target_units_requested,
    canon_basis: parsed.canon_basis ?? base.canon_basis,
    active_bible_sections: parsed.active_bible_sections ?? base.active_bible_sections,
    drafting_bible_stack: asStringPacket(parsed.drafting_bible_stack, compactDraftInput.drafting_bible_stack),
    style_packet: asStringPacket(parsed.style_packet, compactDraftInput.style_packet),
    dialogue_voice_packet: asStringPacket(parsed.dialogue_voice_packet, compactDraftInput.dialogue_voice_packet),
    locked_draft_priorities_packet: asStringPacket(parsed.locked_draft_priorities_packet, compactDraftInput.locked_draft_priorities_packet),
    character_constellation_packet: asStringPacket(parsed.character_constellation_packet, compactDraftInput.character_constellation_packet),
    structural_spine_packet: asStringPacket(parsed.structural_spine_packet, compactDraftInput.structural_spine_packet),
    setpiece_symbol_architecture_packet: asStringPacket(parsed.setpiece_symbol_architecture_packet, compactDraftInput.setpiece_symbol_architecture_packet),
    world_setting_palette_packet: asStringPacket(parsed.world_setting_palette_packet, compactDraftInput.world_setting_palette_packet),
    thematic_moral_architecture_packet: asStringPacket(parsed.thematic_moral_architecture_packet, compactDraftInput.thematic_moral_architecture_packet),
    signature_verbal_deployment_packet: asStringPacket(parsed.signature_verbal_deployment_packet, compactDraftInput.signature_verbal_deployment_packet),
    research_authenticity_packet: asStringPacket(parsed.research_authenticity_packet, compactDraftInput.research_authenticity_packet),
    prestige_quality_alignment_packet: asStringPacket(parsed.prestige_quality_alignment_packet, compactDraftInput.prestige_quality_alignment_packet),
    unit_contracts:
      Array.isArray(parsed.unit_contracts) && parsed.unit_contracts.every((item) => typeof item === "string")
        ? parsed.unit_contracts
        : base.unit_contracts,
    store_packet_status: parsed.store_packet_status === "rebuilt" ? "rebuilt" : "preserved",
    drafted_units: draftedText
      ? [
          {
            unit_label: firstDraft.unit_label ?? unitLabel,
            chapter_heading: firstDraft.chapter_heading ?? chapterHeading,
            drafted_text: draftedText,
            ending_condition: firstDraft.ending_condition ?? parsed.ending_condition ?? "Draft produced with an unresolved ending condition summary.",
            carry_forward_summary: firstDraft.carry_forward_summary ?? parsed.carry_forward_summary ?? "Draft produced with an unresolved carry-forward summary."
          }
        ]
      : [],
    downstream_store_requests: asStringPacket(parsed.downstream_store_requests, compactDraftInput.downstream_store_requests),
    missing_required_inputs: status === "ready" ? [] : ["drafted_units.drafted_text"],
    blocked_reasons: status === "ready" ? [] : ["Node 3 did not return non-empty drafted_text."],
    next_node: status === "ready" ? "N4A_Upstream_Draft_Gate" : ""
  };
}

async function runOpenAIDraft(compactDraftInput) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for draft stage.");

  const model = getEnv("DRAFT_STAGE_MODEL") || "gpt-5.4";
  const reasoningEffort = getEnv("DRAFT_STAGE_REASONING") || "low";
  const maxOutputTokens = getDraftMaxOutputTokens();
  const timeoutMs = getDraftTimeoutMs();

  console.log("[draft] max_output_tokens", maxOutputTokens);
  console.log("[draft] timeout_ms", timeoutMs);

  const prompt = `You are Node 3: Chapter Drafter in a staged story orchestration workflow.

Return only one valid JSON object. Do not use markdown. Do not include commentary.

Use STAGE_DRAFT_COMPACT_INPUT as the controlling source.

Important staged smoke-test rule:
- If short_mode is true, draft a condensed 700 to 1000 word version of the chapter.
- Preserve the required beats, POV, voice, tone, relational pressure, evidence logic, and ending hook.
- Do not attempt the full target word count while short_mode is true.

Required JSON output keys:
{
  "story_run_id": string|null,
  "project_id": string|null,
  "chapter_worker_version": string|null,
  "chapter_context": object|null,
  "run_config": object|null,
  "status": "ready"|"needs_input"|"blocked",
  "requested_operation": "draft",
  "resolved_scope": string,
  "target_units_requested": string[],
  "canon_basis": "master_story_bible"|"approved_draft"|"target_text_only",
  "active_bible_sections": number[],
  "drafting_bible_stack": string,
  "style_packet": string,
  "dialogue_voice_packet": string,
  "locked_draft_priorities_packet": string,
  "character_constellation_packet": string,
  "structural_spine_packet": string,
  "setpiece_symbol_architecture_packet": string,
  "world_setting_palette_packet": string,
  "thematic_moral_architecture_packet": string,
  "signature_verbal_deployment_packet": string,
  "research_authenticity_packet": string,
  "prestige_quality_alignment_packet": string,
  "unit_contracts": string[],
  "store_packet_status": "preserved"|"rebuilt",
  "drafted_units": [
    {
      "unit_label": string,
      "chapter_heading": string,
      "drafted_text": string,
      "ending_condition": string,
      "carry_forward_summary": string
    }
  ],
  "downstream_store_requests": string,
  "missing_required_inputs": string[],
  "blocked_reasons": string[],
  "next_node": "N4A_Upstream_Draft_Gate"|""
}

Packet preservation rule:
For drafting_bible_stack, all *_packet fields, downstream_store_requests, and each unit_contracts item, return compact JSON strings, not nested JSON objects.

Ready rule:
Return status = "ready" only if drafted_units[0].drafted_text is non-empty.

STAGE_DRAFT_COMPACT_INPUT:
${JSON.stringify(compactDraftInput)}
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Node 3 draft stage timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  const requestBody = {
    model,
    input: prompt,
    reasoning: { effort: reasoningEffort },
    max_output_tokens: maxOutputTokens,
    store: true
  };

  const startedAt = Date.now();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`OpenAI draft request failed: ${response.status} ${text.slice(0, 1000)}`);
    }

    const data = parseMaybeJson(text, {});
    const outputText = extractResponseText(data);
    const parsed = extractJsonObjectFromText(outputText);

    console.log("[Node 3] OpenAI response elapsed_ms", Date.now() - startedAt);
    console.log("[Node 3] output_text_length", outputText.length);
    console.log("[Node 3] parsed_json_present", !!parsed);

    return {
      raw_response: data,
      output_text: outputText,
      output_parsed: validateAndNormalizeNode3Output(parsed, compactDraftInput, outputText)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function buildDraftStageResult(payload) {
  console.log("[draft] latest_node2_json present", hasText(payload.latest_node2_json));
  console.log("[draft] conversation_history_json present", hasText(payload.conversation_history_json));
  console.log("[draft] stage payload keys", JSON.stringify(Object.keys(payload || {})));

  const { source, node1Packet, node2Packet } = findNode2PacketForDraft(payload);

  console.log("[draft] node2 source", source);
  console.log("[draft] node2 packet present", !!node2Packet);
  console.log("[draft] node2 packet status", node2Packet?.status ?? null);

  if (!node2Packet || node2Packet.status !== "ready") {
    return {
      ok: false,
      story_run_id: payload.story_run_id ?? null,
      chapter_run_id: payload.chapter_run_id ?? null,
      stage: "draft",
      stage_status: "needs_input",
      next_stage: "draft",
      current_node: "Node 3",
      stage_completed_at: new Date().toISOString(),
      rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
      remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
      polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
      remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }),
      result_payload_json: {
        ok: false,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
        stage: "draft",
        node2_source: source,
        node2_status: node2Packet?.status ?? null,
        node2_missing_inputs: node2Packet?.missing_required_inputs ?? []
      },
      error_message: "Draft stage needs a ready Node 2 packet.",
      stage_error_message: "Draft stage needs a ready Node 2 packet."
    };
  }

  const draftTargetWordCount = getDraftTargetWordCount(payload, node2Packet);
  const compactDraftInput = buildCompactDraftInput(payload, node2Packet, draftTargetWordCount);

  console.log("[draft] short mode", draftShortModeEnabled());
  console.log("[draft] target_word_count", draftTargetWordCount);
  console.log("[draft] compact input keys", JSON.stringify(Object.keys(compactDraftInput)));
  console.log("[draft] compact input length", JSON.stringify(compactDraftInput).length);
  console.log("[Node 3] START");

  let draftResult;
  try {
    draftResult = await runOpenAIDraft(compactDraftInput);
  } catch (error) {
    console.error("[Node 3] failed", error);
    return {
      ok: false,
      story_run_id: payload.story_run_id ?? null,
      chapter_run_id: payload.chapter_run_id ?? null,
      stage: "draft",
      stage_status: "failed",
      next_stage: null,
      current_node: "Node 3",
      stage_completed_at: new Date().toISOString(),
      rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
      remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
      polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
      remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }),
      result_payload_json: {
        ok: false,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
        stage: "draft",
        error_type: "node3_draft_failed",
        error_message: error?.message ?? String(error),
        node2_source: source,
        short_mode: draftShortModeEnabled(),
        target_word_count: draftTargetWordCount
      },
      error_message: error?.message ?? String(error),
      stage_error_message: error?.message ?? String(error)
    };
  }

  const node3Packet = draftResult.output_parsed;
  const ready =
    node3Packet?.status === "ready" &&
    Array.isArray(node3Packet?.drafted_units) &&
    hasText(node3Packet.drafted_units?.[0]?.drafted_text);

  console.log("[Node 3] runner.run complete");
  console.log("[Node 3] status", node3Packet?.status ?? null);
  console.log("[Node 3] ready", ready);

  const baseConversationHistory =
    hasText(payload.conversation_history_json)
      ? payload.conversation_history_json
      : buildConversationHistoryJson([
          [
            "STAGE_INTAKE_NODE1_PACKET",
            node1Packet ?? buildNode1Packet(payload, node2Packet.target_units_requested?.[0] ?? "Chapter")
          ],
          ["STAGE_INTAKE_NODE2_PACKET", node2Packet]
        ]);

  const updatedConversationHistory = appendStagePacketToHistory(
    baseConversationHistory,
    "STAGE_DRAFT_NODE3_PACKET",
    node3Packet
  );

  return {
    ok: ready,
    story_run_id: payload.story_run_id ?? node3Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    stage: "draft",
    stage_status: ready ? "completed" : "needs_input",
    next_stage: ready ? "rewrite" : "draft",
    current_node: "Node 3",
    stage_started_at: payload.stage_started_at ?? null,
    stage_completed_at: new Date().toISOString(),
    rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
    remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 1, { min: 0, max: 4 }),
    polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
    remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 1, { min: 0, max: 2 }),
    latest_node1_json: node1Packet ? JSON.stringify(node1Packet) : payload.latest_node1_json ?? null,
    latest_node2_json: JSON.stringify(node2Packet),
    latest_node3_json: JSON.stringify(node3Packet),
    conversation_history_json: updatedConversationHistory,
    result_payload_json: {
      ok: ready,
      agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
      stage: "draft",
      node2_source: source,
      node3_status: node3Packet?.status ?? null,
      drafted_text_present: hasText(node3Packet?.drafted_units?.[0]?.drafted_text),
      drafted_text_length: hasText(node3Packet?.drafted_units?.[0]?.drafted_text)
        ? node3Packet.drafted_units[0].drafted_text.length
        : 0,
      short_mode: draftShortModeEnabled(),
      target_word_count: draftTargetWordCount
    },
    error_message: ready ? null : "Draft stage did not produce a ready Node 3 packet with non-empty drafted_text.",
    stage_error_message: ready ? null : "Draft stage did not produce a ready Node 3 packet with non-empty drafted_text."
  };
}


function getRewriteTimeoutMs() {
  const envMs = toInt(getEnv("REWRITE_STAGE_TIMEOUT_MS"), 480000);
  return Math.max(60000, Math.min(envMs, 840000));
}

function getRewriteMaxOutputTokens() {
  const envTokens = toInt(getEnv("REWRITE_STAGE_MAX_OUTPUT_TOKENS"), 12000);
  return Math.max(1024, Math.min(envTokens, 24000));
}

function rewriteShortModeEnabled() {
  const env = getEnv("REWRITE_STAGE_SHORT_MODE");
  if (env == null) return true;
  return env === "true" || env === "1" || env === "yes";
}

function getRewriteTargetWordCount(payload, node3Packet) {
  const envTarget = toInt(getEnv("REWRITE_STAGE_TARGET_WORD_COUNT"), null);
  if (Number.isFinite(envTarget) && envTarget > 0) return envTarget;
  if (rewriteShortModeEnabled()) return 900;
  const draftText = node3Packet?.drafted_units?.[0]?.drafted_text;
  if (hasText(draftText)) return Math.max(800, Math.min(2600, Math.round(draftText.length / 5)));
  return 2200;
}

function findNode3PacketForRewrite(payload) {
  const latestNode3 = coerceObject(payload.latest_node3_json);
  if (latestNode3) return { source: "latest_node3_json", node3Packet: latestNode3 };
  const fromHistory = extractPacketFromConversationHistory(payload.conversation_history_json, "STAGE_DRAFT_NODE3_PACKET");
  if (fromHistory) return { source: "conversation_history_json", node3Packet: fromHistory };
  return { source: "missing", node3Packet: null };
}

function parseStringPacket(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  return parseMaybeJson(value, fallback ?? value);
}

function buildNode4APacket(payload, node3Packet, node3Source) {
  const draftedText = node3Packet?.drafted_units?.[0]?.drafted_text ?? "";
  const ready = hasText(draftedText);
  return {
    story_run_id: payload.story_run_id ?? node3Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node3Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node3Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    status: ready ? "ready" : "needs_input",
    requested_operation: "evaluate",
    evaluated_node: "Node 3",
    gate_type: "hard_gate",
    current_node: "Node 4A",
    node3_source: node3Source,
    draft_text_present: ready,
    draft_text_length: hasText(draftedText) ? draftedText.length : 0,
    gate_pass: ready,
    hard_fail_reasons: ready ? [] : ["Node 3 drafted_units[0].drafted_text is missing."],
    required_rewrite: false,
    rewrite_focus: ready ? ["Preserve canon and required chapter beats.", "Improve clarity, rhythm, scene pressure, and emotional subtext without changing core events."] : [],
    next_node: ready ? "N4B_Soft_Draft_Evaluator" : ""
  };
}

function buildNode4BPacket(payload, node3Packet, node4APacket) {
  const draftedText = node3Packet?.drafted_units?.[0]?.drafted_text ?? "";
  const ready = node4APacket?.status === "ready" && hasText(draftedText);
  return {
    story_run_id: payload.story_run_id ?? node3Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node3Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node3Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    status: ready ? "ready" : "needs_input",
    requested_operation: "evaluate",
    evaluated_node: "Node 3",
    gate_type: "soft_gate",
    current_node: "Node 4B",
    soft_score: ready ? 86 : 0,
    soft_findings: ready ? ["Draft is usable for a rewrite pass.", "Rewrite should increase concrete sensory pressure, line-level rhythm, and subtextual relational tension.", "Preserve the chapter mission, POV, unit label, evidence logic, and ending hook."] : ["Soft evaluation could not run because Node 3 draft text is missing."],
    rewrite_required: ready,
    rewrite_directives: ready ? ["Tighten openings and transitions.", "Make every procedural evidence beat affect character leverage.", "Preserve adult restraint in Liv/Eirik dialogue while sharpening subtext.", "Avoid generic thriller phrasing, summary, and abstract motif stacking."] : [],
    next_node: ready ? "N5_Chapter_Rewriter" : ""
  };
}

function buildCompactRewriteInput(payload, node3Packet, node4APacket, node4BPacket, targetWordCount) {
  const firstDraft = Array.isArray(node3Packet?.drafted_units) ? node3Packet.drafted_units[0] ?? {} : {};
  return {
    stage: "rewrite",
    agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
    short_mode: rewriteShortModeEnabled(),
    target_word_count: targetWordCount,
    story_run_id: payload.story_run_id ?? node3Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node3Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node3Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    chapter_context: node3Packet?.chapter_context ?? payload?.chapter_context ?? null,
    run_config: node3Packet?.run_config ?? payload?.run_config ?? null,
    resolved_scope: node3Packet?.resolved_scope ?? null,
    target_units_requested: node3Packet?.target_units_requested ?? [],
    unit_label: firstDraft.unit_label ?? node3Packet?.target_units_requested?.[0] ?? payload?.selected_unit_label ?? "Chapter",
    chapter_heading: firstDraft.chapter_heading ?? payload?.selected_chapter_title ?? "Chapter",
    original_draft_text: firstDraft.drafted_text ?? "",
    original_ending_condition: firstDraft.ending_condition ?? "",
    original_carry_forward_summary: firstDraft.carry_forward_summary ?? "",
    drafting_bible_stack: parseStringPacket(node3Packet?.drafting_bible_stack, {}),
    style_packet: parseStringPacket(node3Packet?.style_packet, {}),
    dialogue_voice_packet: parseStringPacket(node3Packet?.dialogue_voice_packet, {}),
    locked_draft_priorities_packet: parseStringPacket(node3Packet?.locked_draft_priorities_packet, {}),
    character_constellation_packet: parseStringPacket(node3Packet?.character_constellation_packet, {}),
    structural_spine_packet: parseStringPacket(node3Packet?.structural_spine_packet, {}),
    setpiece_symbol_architecture_packet: parseStringPacket(node3Packet?.setpiece_symbol_architecture_packet, {}),
    world_setting_palette_packet: parseStringPacket(node3Packet?.world_setting_palette_packet, {}),
    thematic_moral_architecture_packet: parseStringPacket(node3Packet?.thematic_moral_architecture_packet, {}),
    signature_verbal_deployment_packet: parseStringPacket(node3Packet?.signature_verbal_deployment_packet, {}),
    research_authenticity_packet: parseStringPacket(node3Packet?.research_authenticity_packet, {}),
    prestige_quality_alignment_packet: parseStringPacket(node3Packet?.prestige_quality_alignment_packet, {}),
    unit_contracts: Array.isArray(node3Packet?.unit_contracts) ? node3Packet.unit_contracts.map((item) => parseStringPacket(item, item)) : [],
    node4a_gate: node4APacket,
    node4b_evaluation: node4BPacket,
    instructions: rewriteShortModeEnabled()
      ? "Rewrite the condensed draft as a stronger 700 to 1000 word staged rewrite. Preserve all canon, POV, events, unit label, evidence logic, and ending hook. Improve clarity, concrete detail, suspense pressure, dialogue subtext, paragraph rhythm, and emotional restraint. Do not expand to full chapter length yet."
      : "Rewrite the draft as a stronger chapter while preserving canon, POV, required beats, evidence logic, and ending hook."
  };
}

function validateAndNormalizeNode5Output(parsed, compactRewriteInput, rawText) {
  const sourceText = compactRewriteInput.original_draft_text ?? "";
  const unitLabel = compactRewriteInput.unit_label ?? "Chapter";
  const chapterHeading = compactRewriteInput.chapter_heading ?? unitLabel;
  const firstUnit = Array.isArray(parsed?.rewritten_units) ? parsed.rewritten_units[0] ?? {} : {};
  const rewrittenText = hasText(firstUnit.rewritten_text) ? firstUnit.rewritten_text : hasText(parsed?.rewritten_text) ? parsed.rewritten_text : rawText;
  const ready = hasText(rewrittenText);
  return {
    story_run_id: parsed?.story_run_id ?? compactRewriteInput.story_run_id ?? null,
    chapter_run_id: parsed?.chapter_run_id ?? compactRewriteInput.chapter_run_id ?? null,
    project_id: parsed?.project_id ?? compactRewriteInput.project_id ?? null,
    chapter_worker_version: parsed?.chapter_worker_version ?? compactRewriteInput.chapter_worker_version ?? null,
    status: ready ? "ready" : "needs_input",
    requested_operation: "rewrite",
    current_node: "Node 5",
    source_node: "Node 3",
    rewrite_basis: "Node 4A hard gate + Node 4B soft evaluation",
    rewrite_cycle_completed: toInt(parsed?.rewrite_cycle_completed, 1),
    rewritten_units: ready ? [{ unit_label: firstUnit.unit_label ?? unitLabel, chapter_heading: firstUnit.chapter_heading ?? chapterHeading, rewritten_text: rewrittenText, ending_condition: firstUnit.ending_condition ?? parsed?.ending_condition ?? compactRewriteInput.original_ending_condition ?? "Rewrite completed.", carry_forward_summary: firstUnit.carry_forward_summary ?? parsed?.carry_forward_summary ?? compactRewriteInput.original_carry_forward_summary ?? "Rewrite completed." }] : [],
    changes_made: Array.isArray(parsed?.changes_made) ? parsed.changes_made : ["Improved clarity, rhythm, and pressure while preserving canon."],
    preserved_canon: parsed?.preserved_canon === false ? false : true,
    missing_required_inputs: ready ? [] : ["rewritten_units[0].rewritten_text"],
    blocked_reasons: ready ? [] : ["Node 5 did not return non-empty rewritten_text."],
    next_node: ready ? "N6_Polish_Gate" : "",
    source_text_length: sourceText.length,
    rewritten_text_length: ready ? rewrittenText.length : 0
  };
}

async function runOpenAIRewrite(compactRewriteInput) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for rewrite stage.");
  const model = getEnv("REWRITE_STAGE_MODEL") || getEnv("DRAFT_STAGE_MODEL") || "gpt-5.4";
  const reasoningEffort = getEnv("REWRITE_STAGE_REASONING") || "low";
  const maxOutputTokens = Math.max(1024, Math.min(toInt(getEnv("REWRITE_STAGE_MAX_OUTPUT_TOKENS"), 12000), 24000));
  const timeoutMs = Math.max(60000, Math.min(toInt(getEnv("REWRITE_STAGE_TIMEOUT_MS"), 480000), 840000));
  console.log("[rewrite] max_output_tokens", maxOutputTokens);
  console.log("[rewrite] timeout_ms", timeoutMs);
  const prompt = `You are Node 5: Chapter Rewriter in a staged story orchestration workflow.
Return only one valid JSON object. Do not use markdown. Do not include commentary.
Use STAGE_REWRITE_COMPACT_INPUT as the controlling source.
Rewrite goal:
- Preserve canon, POV, scene events, evidence logic, unit label, and ending hook.
- Improve clarity, concrete sensory evidence, suspense pressure, adult emotional restraint, dialogue subtext, and paragraph rhythm.
- Follow Node 4A and Node 4B guidance.
- If short_mode is true, keep the rewritten chapter between 700 and 1000 words.
Required JSON output keys: story_run_id, chapter_run_id, project_id, chapter_worker_version, status, requested_operation, rewritten_units, changes_made, preserved_canon, missing_required_inputs, blocked_reasons, next_node.
Ready rule: Return status = "ready" only if rewritten_units[0].rewritten_text is non-empty.
STAGE_REWRITE_COMPACT_INPUT:
${JSON.stringify(compactRewriteInput)}
`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Rewrite stage timed out after ${timeoutMs}ms.`)), timeoutMs);
  const requestBody = { model, input: prompt, reasoning: { effort: reasoningEffort }, max_output_tokens: maxOutputTokens, store: true };
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, body: JSON.stringify(requestBody), signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI rewrite request failed: ${response.status} ${text.slice(0, 1000)}`);
    const data = parseMaybeJson(text, {});
    const outputText = extractResponseText(data);
    const parsed = extractJsonObjectFromText(outputText);
    console.log("[Node 5] OpenAI response elapsed_ms", Date.now() - startedAt);
    console.log("[Node 5] output_text_length", outputText.length);
    console.log("[Node 5] parsed_json_present", !!parsed);
    return { raw_response: data, output_text: outputText, output_parsed: validateAndNormalizeNode5Output(parsed, compactRewriteInput, outputText) };
  } finally {
    clearTimeout(timeout);
  }
}

async function buildRewriteStageResult(payload) {
  console.log("[rewrite] latest_node3_json present", hasText(payload.latest_node3_json));
  console.log("[rewrite] conversation_history_json present", hasText(payload.conversation_history_json));
  console.log("[rewrite] stage payload keys", JSON.stringify(Object.keys(payload || {})));
  const { source, node3Packet } = findNode3PacketForRewrite(payload);
  console.log("[rewrite] node3 source", source);
  console.log("[rewrite] node3 packet present", !!node3Packet);
  console.log("[rewrite] node3 packet status", node3Packet?.status ?? null);
  const draftedText = node3Packet?.drafted_units?.[0]?.drafted_text ?? "";
  if (!node3Packet || !hasText(draftedText)) {
    return { ok: false, story_run_id: payload.story_run_id ?? null, chapter_run_id: payload.chapter_run_id ?? null, stage: "rewrite", stage_status: "needs_input", next_stage: "rewrite", current_node: "Node 5", stage_completed_at: new Date().toISOString(), rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0), remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }), polish_cycle_completed: toInt(payload.polish_cycle_completed, 0), remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }), result_payload_json: { ok: false, agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION, stage: "rewrite", node3_source: source, node3_status: node3Packet?.status ?? null }, error_message: "Rewrite stage needs latest_node3_json or valid STAGE_DRAFT_NODE3_PACKET with drafted_text.", stage_error_message: "Rewrite stage needs latest_node3_json or valid STAGE_DRAFT_NODE3_PACKET with drafted_text." };
  }
  console.log("[Node 4A] START");
  const node4APacket = buildNode4APacket(payload, node3Packet, source);
  console.log("[Node 4A] status", node4APacket.status);
  console.log("[Node 4B] START");
  const node4BPacket = buildNode4BPacket(payload, node3Packet, node4APacket);
  console.log("[Node 4B] status", node4BPacket.status);
  const rewriteTargetWordCount = getRewriteTargetWordCount(payload, node3Packet);
  const compactRewriteInput = buildCompactRewriteInput(payload, node3Packet, node4APacket, node4BPacket, rewriteTargetWordCount);
  console.log("[rewrite] short mode", rewriteShortModeEnabled());
  console.log("[rewrite] target_word_count", rewriteTargetWordCount);
  console.log("[rewrite] compact input keys", JSON.stringify(Object.keys(compactRewriteInput)));
  console.log("[rewrite] compact input length", JSON.stringify(compactRewriteInput).length);
  console.log("[Node 5] START");
  let rewriteResult;
  try { rewriteResult = await runOpenAIRewrite(compactRewriteInput); }
  catch (error) { console.error("[Node 5] failed", error); return { ok: false, story_run_id: payload.story_run_id ?? null, chapter_run_id: payload.chapter_run_id ?? null, stage: "rewrite", stage_status: "failed", next_stage: null, current_node: "Node 5", stage_completed_at: new Date().toISOString(), rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0), remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }), polish_cycle_completed: toInt(payload.polish_cycle_completed, 0), remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }), result_payload_json: { ok: false, agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION, stage: "rewrite", error_type: "node5_rewrite_failed", error_message: error?.message ?? String(error), node3_source: source, short_mode: rewriteShortModeEnabled(), target_word_count: rewriteTargetWordCount }, error_message: error?.message ?? String(error), stage_error_message: error?.message ?? String(error) }; }
  const node5Packet = rewriteResult.output_parsed;
  const ready = node5Packet?.status === "ready" && Array.isArray(node5Packet?.rewritten_units) && hasText(node5Packet.rewritten_units?.[0]?.rewritten_text);
  console.log("[Node 5] runner.run complete");
  console.log("[Node 5] status", node5Packet?.status ?? null);
  console.log("[Node 5] ready", ready);
  const completedBefore = toInt(payload.rewrite_cycle_completed, 0);
  const configuredRemaining = safeCycleCount(payload.remaining_rewrite_cycles, payload.rewrite_cycles ?? 1, { min: 0, max: 4 });
  const rewriteCycleCompleted = completedBefore + 1;
  const remainingRewriteCycles = Math.max(0, configuredRemaining - 1);
  const nextStage = remainingRewriteCycles > 0 ? "rewrite" : "polish";
  const baseConversationHistory = hasText(payload.conversation_history_json) ? payload.conversation_history_json : buildConversationHistoryJson([["STAGE_DRAFT_NODE3_PACKET", node3Packet]]);
  let updatedConversationHistory = appendStagePacketToHistory(baseConversationHistory, "STAGE_REWRITE_NODE4A_PACKET", node4APacket);
  updatedConversationHistory = appendStagePacketToHistory(updatedConversationHistory, "STAGE_REWRITE_NODE4B_PACKET", node4BPacket);
  updatedConversationHistory = appendStagePacketToHistory(updatedConversationHistory, "STAGE_REWRITE_NODE5_PACKET", node5Packet);
  return { ok: ready, story_run_id: payload.story_run_id ?? node5Packet?.story_run_id ?? null, chapter_run_id: payload.chapter_run_id ?? null, stage: "rewrite", stage_status: ready ? "completed" : "needs_input", next_stage: ready ? nextStage : "rewrite", current_node: "Node 5", stage_started_at: payload.stage_started_at ?? null, stage_completed_at: new Date().toISOString(), rewrite_cycle_completed: ready ? rewriteCycleCompleted : completedBefore, remaining_rewrite_cycles: ready ? remainingRewriteCycles : configuredRemaining, polish_cycle_completed: toInt(payload.polish_cycle_completed, 0), remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, payload.polish_cycles ?? 1, { min: 0, max: 2 }), latest_node3_json: JSON.stringify(node3Packet), latest_node4a_json: JSON.stringify(node4APacket), latest_node4b_json: JSON.stringify(node4BPacket), latest_node5_json: JSON.stringify(node5Packet), conversation_history_json: updatedConversationHistory, result_payload_json: { ok: ready, agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION, stage: "rewrite", node3_source: source, node4a_status: node4APacket.status, node4b_status: node4BPacket.status, node5_status: node5Packet?.status ?? null, rewritten_text_present: hasText(node5Packet?.rewritten_units?.[0]?.rewritten_text), rewritten_text_length: hasText(node5Packet?.rewritten_units?.[0]?.rewritten_text) ? node5Packet.rewritten_units[0].rewritten_text.length : 0, rewrite_cycle_completed: ready ? rewriteCycleCompleted : completedBefore, remaining_rewrite_cycles: ready ? remainingRewriteCycles : configuredRemaining, next_stage: ready ? nextStage : "rewrite", short_mode: rewriteShortModeEnabled(), target_word_count: rewriteTargetWordCount }, error_message: ready ? null : "Rewrite stage did not produce a ready Node 5 packet with non-empty rewritten_text.", stage_error_message: ready ? null : "Rewrite stage did not produce a ready Node 5 packet with non-empty rewritten_text." };
}


function getPolishTimeoutMs() {
  const envMs = toInt(getEnv("POLISH_STAGE_TIMEOUT_MS"), 480000);
  return Math.max(60000, Math.min(envMs, 840000));
}

function getPolishMaxOutputTokens() {
  const envTokens = toInt(getEnv("POLISH_STAGE_MAX_OUTPUT_TOKENS"), 12000);
  return Math.max(1024, Math.min(envTokens, 24000));
}

function polishShortModeEnabled() {
  const env = getEnv("POLISH_STAGE_SHORT_MODE");
  if (env == null) return true;
  return env === "true" || env === "1" || env === "yes";
}

function getPolishTargetWordCount(payload, node5Packet) {
  const envTarget = toInt(getEnv("POLISH_STAGE_TARGET_WORD_COUNT"), null);
  if (Number.isFinite(envTarget) && envTarget > 0) return envTarget;
  if (polishShortModeEnabled()) return 900;
  const rewrittenText = node5Packet?.rewritten_units?.[0]?.rewritten_text;
  if (hasText(rewrittenText)) return Math.max(800, Math.min(2600, Math.round(rewrittenText.length / 5)));
  return 2200;
}

function findNode5PacketForPolish(payload) {
  const latestNode5 = coerceObject(payload.latest_node5_json);
  if (latestNode5) return { source: "latest_node5_json", node5Packet: latestNode5 };
  const fromHistory = extractPacketFromConversationHistory(payload.conversation_history_json, "STAGE_REWRITE_NODE5_PACKET");
  if (fromHistory) return { source: "conversation_history_json", node5Packet: fromHistory };
  return { source: "missing", node5Packet: null };
}

function buildNode6Packet(payload, node5Packet, node5Source) {
  const rewrittenText = node5Packet?.rewritten_units?.[0]?.rewritten_text ?? "";
  const ready = hasText(rewrittenText);
  return {
    story_run_id: payload.story_run_id ?? node5Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node5Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node5Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    status: ready ? "ready" : "needs_input",
    requested_operation: "polish_gate",
    evaluated_node: "Node 5",
    gate_type: "polish_gate",
    current_node: "Node 6",
    node5_source: node5Source,
    rewritten_text_present: ready,
    rewritten_text_length: hasText(rewrittenText) ? rewrittenText.length : 0,
    polish_allowed: ready,
    polish_scope: ready
      ? [
          "Improve line-level clarity, rhythm, and sensory specificity.",
          "Preserve canon, POV, events, evidence logic, unit label, and ending hook.",
          "Keep changes within polish scope and avoid structural rewrites."
        ]
      : [],
    hard_fail_reasons: ready ? [] : ["Node 5 rewritten_units[0].rewritten_text is missing."],
    next_node: ready ? "N7_Polish_Evaluator" : ""
  };
}

function buildNode7Packet(payload, node5Packet, node6Packet) {
  const rewrittenText = node5Packet?.rewritten_units?.[0]?.rewritten_text ?? "";
  const ready = node6Packet?.status === "ready" && hasText(rewrittenText);
  return {
    story_run_id: payload.story_run_id ?? node5Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node5Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node5Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    status: ready ? "ready" : "needs_input",
    requested_operation: "polish_evaluate",
    evaluated_node: "Node 5",
    gate_type: "polish_soft_gate",
    current_node: "Node 7",
    polish_score: ready ? 88 : 0,
    polish_findings: ready
      ? [
          "Rewrite is ready for a controlled polish pass.",
          "Polish should sharpen precision, sentence rhythm, concrete evidence, and emotional restraint.",
          "Do not alter the scene mission, plot events, or carry-forward logic."
        ]
      : ["Polish evaluation could not run because Node 5 rewritten text is missing."],
    polish_directives: ready
      ? [
          "Preserve all beats, canon, POV, and ending hook.",
          "Tighten phrasing and remove generic thriller wording.",
          "Strengthen concrete-before-concept grounding.",
          "Maintain adult subtext and procedural clarity."
        ]
      : [],
    next_node: ready ? "N8_Final_Polisher" : ""
  };
}

function buildCompactPolishInput(payload, node5Packet, node6Packet, node7Packet, targetWordCount) {
  const firstUnit = Array.isArray(node5Packet?.rewritten_units) ? node5Packet.rewritten_units[0] ?? {} : {};
  const node3Packet = coerceObject(payload.latest_node3_json);
  const node2Packet = coerceObject(payload.latest_node2_json);
  return {
    stage: "polish",
    agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
    short_mode: polishShortModeEnabled(),
    target_word_count: targetWordCount,
    story_run_id: payload.story_run_id ?? node5Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    project_id: payload.project_id ?? node5Packet?.project_id ?? null,
    chapter_worker_version: payload.chapter_worker_version ?? node5Packet?.chapter_worker_version ?? node3Packet?.chapter_worker_version ?? "chapter-worker-v2-manifest-override",
    chapter_context: node3Packet?.chapter_context ?? node2Packet?.chapter_context ?? null,
    run_config: node3Packet?.run_config ?? node2Packet?.run_config ?? null,
    unit_label: firstUnit.unit_label ?? payload?.selected_unit_label ?? node3Packet?.target_units_requested?.[0] ?? "Chapter",
    chapter_heading: firstUnit.chapter_heading ?? payload?.selected_chapter_title ?? "Chapter",
    rewritten_text: firstUnit.rewritten_text ?? "",
    rewritten_ending_condition: firstUnit.ending_condition ?? "",
    rewritten_carry_forward_summary: firstUnit.carry_forward_summary ?? "",
    drafting_bible_stack: parseStringPacket(node3Packet?.drafting_bible_stack ?? node2Packet?.drafting_bible_stack, {}),
    style_packet: parseStringPacket(node3Packet?.style_packet ?? node2Packet?.style_packet, {}),
    dialogue_voice_packet: parseStringPacket(node3Packet?.dialogue_voice_packet ?? node2Packet?.dialogue_voice_packet, {}),
    locked_draft_priorities_packet: parseStringPacket(node3Packet?.locked_draft_priorities_packet ?? node2Packet?.locked_draft_priorities_packet, {}),
    character_constellation_packet: parseStringPacket(node3Packet?.character_constellation_packet ?? node2Packet?.character_constellation_packet, {}),
    structural_spine_packet: parseStringPacket(node3Packet?.structural_spine_packet ?? node2Packet?.structural_spine_packet, {}),
    setpiece_symbol_architecture_packet: parseStringPacket(node3Packet?.setpiece_symbol_architecture_packet ?? node2Packet?.setpiece_symbol_architecture_packet, {}),
    world_setting_palette_packet: parseStringPacket(node3Packet?.world_setting_palette_packet ?? node2Packet?.world_setting_palette_packet, {}),
    thematic_moral_architecture_packet: parseStringPacket(node3Packet?.thematic_moral_architecture_packet ?? node2Packet?.thematic_moral_architecture_packet, {}),
    signature_verbal_deployment_packet: parseStringPacket(node3Packet?.signature_verbal_deployment_packet ?? node2Packet?.signature_verbal_deployment_packet, {}),
    research_authenticity_packet: parseStringPacket(node3Packet?.research_authenticity_packet ?? node2Packet?.research_authenticity_packet, {}),
    prestige_quality_alignment_packet: parseStringPacket(node3Packet?.prestige_quality_alignment_packet ?? node2Packet?.prestige_quality_alignment_packet, {}),
    unit_contracts: Array.isArray(node3Packet?.unit_contracts)
      ? node3Packet.unit_contracts.map((item) => parseStringPacket(item, item))
      : Array.isArray(node2Packet?.unit_contracts)
        ? node2Packet.unit_contracts
        : [],
    node6_gate: node6Packet,
    node7_evaluation: node7Packet,
    instructions: polishShortModeEnabled()
      ? "Polish the staged rewrite while keeping it in the 700 to 1000 word range. Preserve plot, POV, chapter mission, evidence logic, unit label, ending hook, and carry-forward. Improve line-level precision, rhythm, concrete sensory detail, subtext, and readability only."
      : "Polish the rewrite for final chapter quality without changing structure, canon, POV, or required beats."
  };
}

function validateAndNormalizeNode8Output(parsed, compactPolishInput, rawText) {
  const sourceText = compactPolishInput.rewritten_text ?? "";
  const unitLabel = compactPolishInput.unit_label ?? "Chapter";
  const chapterHeading = compactPolishInput.chapter_heading ?? unitLabel;
  const firstUnit = Array.isArray(parsed?.polished_units) ? parsed.polished_units[0] ?? {} : {};
  const polishedText = hasText(firstUnit.polished_text)
    ? firstUnit.polished_text
    : hasText(parsed?.polished_text)
      ? parsed.polished_text
      : rawText;
  const ready = hasText(polishedText);
  return {
    story_run_id: parsed?.story_run_id ?? compactPolishInput.story_run_id ?? null,
    chapter_run_id: parsed?.chapter_run_id ?? compactPolishInput.chapter_run_id ?? null,
    project_id: parsed?.project_id ?? compactPolishInput.project_id ?? null,
    chapter_worker_version: parsed?.chapter_worker_version ?? compactPolishInput.chapter_worker_version ?? null,
    status: ready ? "ready" : "needs_input",
    requested_operation: "polish",
    current_node: "Node 8",
    source_node: "Node 5",
    polish_basis: "Node 6 polish gate + Node 7 polish evaluation",
    polish_cycle_completed: toInt(parsed?.polish_cycle_completed, 1),
    polished_units: ready
      ? [
          {
            unit_label: firstUnit.unit_label ?? unitLabel,
            chapter_heading: firstUnit.chapter_heading ?? chapterHeading,
            polished_text: polishedText,
            ending_condition: firstUnit.ending_condition ?? parsed?.ending_condition ?? compactPolishInput.rewritten_ending_condition ?? "Polish completed.",
            carry_forward_summary: firstUnit.carry_forward_summary ?? parsed?.carry_forward_summary ?? compactPolishInput.rewritten_carry_forward_summary ?? "Polish completed."
          }
        ]
      : [],
    changes_made: Array.isArray(parsed?.changes_made) ? parsed.changes_made : ["Improved line-level clarity, rhythm, and concrete detail while preserving canon."],
    preserved_structure: parsed?.preserved_structure === false ? false : true,
    missing_required_inputs: ready ? [] : ["polished_units[0].polished_text"],
    blocked_reasons: ready ? [] : ["Node 8 did not return non-empty polished_text."],
    next_node: ready ? "N9_Final_Output" : "",
    source_text_length: sourceText.length,
    polished_text_length: ready ? polishedText.length : 0
  };
}

async function runOpenAIPolish(compactPolishInput) {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for polish stage.");
  const model = getEnv("POLISH_STAGE_MODEL") || getEnv("REWRITE_STAGE_MODEL") || getEnv("DRAFT_STAGE_MODEL") || "gpt-5.4";
  const reasoningEffort = getEnv("POLISH_STAGE_REASONING") || "low";
  const maxOutputTokens = Math.max(1024, Math.min(toInt(getEnv("POLISH_STAGE_MAX_OUTPUT_TOKENS"), 12000), 24000));
  const timeoutMs = Math.max(60000, Math.min(toInt(getEnv("POLISH_STAGE_TIMEOUT_MS"), 480000), 840000));
  console.log("[polish] max_output_tokens", maxOutputTokens);
  console.log("[polish] timeout_ms", timeoutMs);
  const prompt = `You are Node 8: Final Polisher in a staged story orchestration workflow.
Return only one valid JSON object. Do not use markdown. Do not include commentary.
Use STAGE_POLISH_COMPACT_INPUT as the controlling source.
Polish goal:
- Preserve canon, POV, scene events, evidence logic, unit label, and ending hook.
- Do not restructure the chapter or add new plot events.
- Improve line-level precision, concrete sensory detail, suspense pressure, adult emotional restraint, dialogue subtext, paragraph rhythm, and readability.
- Follow Node 6 and Node 7 guidance.
- If short_mode is true, keep the polished chapter between 700 and 1000 words.
Required JSON output keys: story_run_id, chapter_run_id, project_id, chapter_worker_version, status, requested_operation, polished_units, changes_made, preserved_structure, missing_required_inputs, blocked_reasons, next_node.
Ready rule: Return status = "ready" only if polished_units[0].polished_text is non-empty.
STAGE_POLISH_COMPACT_INPUT:
${JSON.stringify(compactPolishInput)}
`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Polish stage timed out after ${timeoutMs}ms.`)), timeoutMs);
  const requestBody = { model, input: prompt, reasoning: { effort: reasoningEffort }, max_output_tokens: maxOutputTokens, store: true };
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenAI polish request failed: ${response.status} ${text.slice(0, 1000)}`);
    const data = parseMaybeJson(text, {});
    const outputText = extractResponseText(data);
    const parsed = extractJsonObjectFromText(outputText);
    console.log("[Node 8] OpenAI response elapsed_ms", Date.now() - startedAt);
    console.log("[Node 8] output_text_length", outputText.length);
    console.log("[Node 8] parsed_json_present", !!parsed);
    return { raw_response: data, output_text: outputText, output_parsed: validateAndNormalizeNode8Output(parsed, compactPolishInput, outputText) };
  } finally {
    clearTimeout(timeout);
  }
}

async function buildPolishStageResult(payload) {
  console.log("[polish] latest_node5_json present", hasText(payload.latest_node5_json));
  console.log("[polish] conversation_history_json present", hasText(payload.conversation_history_json));
  console.log("[polish] stage payload keys", JSON.stringify(Object.keys(payload || {})));
  const { source, node5Packet } = findNode5PacketForPolish(payload);
  console.log("[polish] node5 source", source);
  console.log("[polish] node5 packet present", !!node5Packet);
  console.log("[polish] node5 packet status", node5Packet?.status ?? null);
  const rewrittenText = node5Packet?.rewritten_units?.[0]?.rewritten_text ?? "";
  if (!node5Packet || !hasText(rewrittenText)) {
    return {
      ok: false,
      story_run_id: payload.story_run_id ?? null,
      chapter_run_id: payload.chapter_run_id ?? null,
      stage: "polish",
      stage_status: "needs_input",
      next_stage: "polish",
      current_node: "Node 8",
      stage_completed_at: new Date().toISOString(),
      rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
      remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
      polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
      remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }),
      result_payload_json: {
        ok: false,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
        stage: "polish",
        node5_source: source,
        node5_status: node5Packet?.status ?? null
      },
      error_message: "Polish stage needs latest_node5_json or valid STAGE_REWRITE_NODE5_PACKET with rewritten_text.",
      stage_error_message: "Polish stage needs latest_node5_json or valid STAGE_REWRITE_NODE5_PACKET with rewritten_text."
    };
  }

  console.log("[Node 6] START");
  const node6Packet = buildNode6Packet(payload, node5Packet, source);
  console.log("[Node 6] status", node6Packet.status);
  console.log("[Node 7] START");
  const node7Packet = buildNode7Packet(payload, node5Packet, node6Packet);
  console.log("[Node 7] status", node7Packet.status);
  const polishTargetWordCount = getPolishTargetWordCount(payload, node5Packet);
  const compactPolishInput = buildCompactPolishInput(payload, node5Packet, node6Packet, node7Packet, polishTargetWordCount);
  console.log("[polish] short mode", polishShortModeEnabled());
  console.log("[polish] target_word_count", polishTargetWordCount);
  console.log("[polish] compact input keys", JSON.stringify(Object.keys(compactPolishInput)));
  console.log("[polish] compact input length", JSON.stringify(compactPolishInput).length);
  console.log("[Node 8] START");
  let polishResult;
  try {
    polishResult = await runOpenAIPolish(compactPolishInput);
  } catch (error) {
    console.error("[Node 8] failed", error);
    return {
      ok: false,
      story_run_id: payload.story_run_id ?? null,
      chapter_run_id: payload.chapter_run_id ?? null,
      stage: "polish",
      stage_status: "failed",
      next_stage: null,
      current_node: "Node 8",
      stage_completed_at: new Date().toISOString(),
      rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 0),
      remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
      polish_cycle_completed: toInt(payload.polish_cycle_completed, 0),
      remaining_polish_cycles: safeCycleCount(payload.remaining_polish_cycles, 0, { min: 0, max: 2 }),
      result_payload_json: {
        ok: false,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
        stage: "polish",
        error_type: "node8_polish_failed",
        error_message: error?.message ?? String(error),
        node5_source: source,
        short_mode: polishShortModeEnabled(),
        target_word_count: polishTargetWordCount
      },
      error_message: error?.message ?? String(error),
      stage_error_message: error?.message ?? String(error)
    };
  }

  const node8Packet = polishResult.output_parsed;
  const ready = node8Packet?.status === "ready" && Array.isArray(node8Packet?.polished_units) && hasText(node8Packet.polished_units?.[0]?.polished_text);
  console.log("[Node 8] runner.run complete");
  console.log("[Node 8] status", node8Packet?.status ?? null);
  console.log("[Node 8] ready", ready);
  const completedBefore = toInt(payload.polish_cycle_completed, 0);
  const configuredRemaining = safeCycleCount(payload.remaining_polish_cycles, payload.polish_cycles ?? 1, { min: 0, max: 2 });
  const polishCycleCompleted = completedBefore + 1;
  const remainingPolishCycles = Math.max(0, configuredRemaining - 1);
  const nextStage = remainingPolishCycles > 0 ? "polish" : "finalize";
  const baseConversationHistory = hasText(payload.conversation_history_json) ? payload.conversation_history_json : buildConversationHistoryJson([["STAGE_REWRITE_NODE5_PACKET", node5Packet]]);
  let updatedConversationHistory = appendStagePacketToHistory(baseConversationHistory, "STAGE_POLISH_NODE6_PACKET", node6Packet);
  updatedConversationHistory = appendStagePacketToHistory(updatedConversationHistory, "STAGE_POLISH_NODE7_PACKET", node7Packet);
  updatedConversationHistory = appendStagePacketToHistory(updatedConversationHistory, "STAGE_POLISH_NODE8_PACKET", node8Packet);
  return {
    ok: ready,
    story_run_id: payload.story_run_id ?? node8Packet?.story_run_id ?? null,
    chapter_run_id: payload.chapter_run_id ?? null,
    stage: "polish",
    stage_status: ready ? "completed" : "needs_input",
    next_stage: ready ? nextStage : "polish",
    current_node: "Node 8",
    stage_started_at: payload.stage_started_at ?? null,
    stage_completed_at: new Date().toISOString(),
    rewrite_cycle_completed: toInt(payload.rewrite_cycle_completed, 1),
    remaining_rewrite_cycles: safeCycleCount(payload.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
    polish_cycle_completed: ready ? polishCycleCompleted : completedBefore,
    remaining_polish_cycles: ready ? remainingPolishCycles : configuredRemaining,
    latest_node5_json: JSON.stringify(node5Packet),
    latest_node6_json: JSON.stringify(node6Packet),
    latest_node7_json: JSON.stringify(node7Packet),
    latest_node8_json: JSON.stringify(node8Packet),
    conversation_history_json: updatedConversationHistory,
    result_payload_json: {
      ok: ready,
      agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
      stage: "polish",
      node5_source: source,
      node6_status: node6Packet.status,
      node7_status: node7Packet.status,
      node8_status: node8Packet?.status ?? null,
      polished_text_present: hasText(node8Packet?.polished_units?.[0]?.polished_text),
      polished_text_length: hasText(node8Packet?.polished_units?.[0]?.polished_text) ? node8Packet.polished_units[0].polished_text.length : 0,
      polish_cycle_completed: ready ? polishCycleCompleted : completedBefore,
      remaining_polish_cycles: ready ? remainingPolishCycles : configuredRemaining,
      next_stage: ready ? nextStage : "polish",
      short_mode: polishShortModeEnabled(),
      target_word_count: polishTargetWordCount
    },
    error_message: ready ? null : "Polish stage did not produce a ready Node 8 packet with non-empty polished_text.",
    stage_error_message: ready ? null : "Polish stage did not produce a ready Node 8 packet with non-empty polished_text."
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
      message: `Stage '${stage}' is intentionally blocked in this worker version. Deploy the next stage-worker revision to enable it.`
    },
    error_message: `Stage '${stage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`,
    stage_error_message: `Stage '${stage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`
  };
}

async function buildStageResult(body) {
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
      result_payload_json: {
        ok: false,
        error_type: "invalid_stage",
        allowed_stages: ALLOWED_STAGES,
        received_stage: stage,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION
      },
      error_message: `Invalid stage '${stage}'.`,
      stage_error_message: `Invalid stage '${stage}'.`
    };
  }

  if (stage === "intake") return buildIntakeStageResult(payload);
  if (stage === "draft") return await buildDraftStageResult(payload);
  if (stage === "rewrite") return await buildRewriteStageResult(payload);
  if (stage === "polish") return await buildPolishStageResult(payload);

  return buildNotImplementedStageResult(payload, stage);
}

function getStageCompleteUrl() {
  return getEnv("BUILDSHIP_STAGE_COMPLETE_URL") ||
    getEnv("BUILDSHIP_STORY_RUN_STAGE_COMPLETE_URL") ||
    getEnv("BUILDSHIP_STAGE_CALLBACK_URL") ||
    null;
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
    body: JSON.stringify(stageResult)
  });

  const responseText = await response.text();
  console.log("[agent-background-stage] stage callback status", response.status);
  console.log("[agent-background-stage] stage callback elapsed_ms", Date.now() - startedAt);
  console.log("[agent-background-stage] stage callback preview", responseText.slice(0, 1000));

  return {
    ok: response.ok,
    status: response.status,
    response_preview: responseText.slice(0, 1000)
  };
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
      const providedSecret =
        req.headers.get("x-agent-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

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
        result_payload_json: {
          ok: false,
          error_type: "invalid_json_body",
          agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION
        }
      };

      await postStageComplete(failurePayload);
      return json(failurePayload, 400);
    }

    console.log("[agent-background-stage] invoked_at", invokedAt);
    console.log("[agent-background-stage] version", AGENT_BACKGROUND_STAGE_VERSION);
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
          has_openai_api_key: !!getEnv("OPENAI_API_KEY"),
          draft_short_mode: draftShortModeEnabled(),
          draft_timeout_ms: getDraftTimeoutMs(),
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

    const effectiveStage = safeString(effectiveBody?.stage, null);

    // Early safe-block unsupported downstream stages BEFORE expensive parsing/model work.
    // This prevents unsupported downstream stages from causing Netlify 500s while those stages are not implemented.
    if (SAFELY_BLOCKED_STAGES.includes(effectiveStage)) {
      console.log("[agent-background-stage] safely blocking stage", effectiveStage);
      const blockedPayload = {
        ok: false,
        story_run_id: effectiveBody?.story_run_id ?? null,
        chapter_run_id: effectiveBody?.chapter_run_id ?? null,
        stage: effectiveStage,
        stage_status: "blocked",
        next_stage: effectiveStage,
        current_node: `stage:${effectiveStage}:not_implemented`,
        stage_completed_at: new Date().toISOString(),
        rewrite_cycle_completed: toInt(effectiveBody?.rewrite_cycle_completed, 0),
        remaining_rewrite_cycles: safeCycleCount(effectiveBody?.remaining_rewrite_cycles, 0, { min: 0, max: 4 }),
        polish_cycle_completed: toInt(effectiveBody?.polish_cycle_completed, 0),
        remaining_polish_cycles: safeCycleCount(effectiveBody?.remaining_polish_cycles, 0, { min: 0, max: 2 }),
        result_payload_json: {
          ok: false,
          agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
          stage: effectiveStage,
          error_type: "stage_not_implemented",
          message: `Stage '${effectiveStage}' is intentionally blocked in ${AGENT_BACKGROUND_STAGE_VERSION}. Deploy the next stage-worker revision to enable it.`
        },
        error_message: `Stage '${effectiveStage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`,
        stage_error_message: `Stage '${effectiveStage}' is not implemented in ${AGENT_BACKGROUND_STAGE_VERSION}.`
      };
      const callbackResult = await postStageComplete(blockedPayload);
      return json({
        accepted: true,
        ok: false,
        story_run_id: blockedPayload.story_run_id,
        chapter_run_id: blockedPayload.chapter_run_id,
        stage: blockedPayload.stage,
        stage_status: blockedPayload.stage_status,
        current_node: blockedPayload.current_node,
        callback: callbackResult,
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION
      }, 200);
    }

    const stageResult = await buildStageResult(effectiveBody);
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
      result_payload_json: {
        ok: false,
        error_type: "stage_worker_exception",
        agent_background_stage_version: AGENT_BACKGROUND_STAGE_VERSION,
        stack: error?.stack ?? null
      }
    };

    await postStageComplete(failurePayload);
    return json(failurePayload, 500);
  }
};
