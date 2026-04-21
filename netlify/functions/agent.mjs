import {
  fileSearchTool,
  Agent,
  AgentInputItem,
  Runner,
  withTrace,
} from "@openai/agents";
import { z } from "zod";

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const fileSearch = fileSearchTool(["vs_69d18c5f75d08191b4baa2e4e63be312"]);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const Node1IntakeScopeLockCanonBasisAndStoreRoutingSchema = z.object({
  story_run_id: z.any(), project_id: z.any(), chapter_worker_version: z.any(),
  chapter_context: z.any(), run_config: z.any(),
  status: z.enum(["ready", "needs_input", "blocked"]),
  requested_operation: z.enum(["draft", "evaluate", "rewrite", "polish", "format"]),
  resolved_scope: z.string(), target_units_requested: z.array(z.string()),
  canon_basis: z.enum(["master_story_bible", "approved_draft", "target_text_only"]),
  active_bible_sections: z.array(z.any()),
  drafting_bible_stack: z.object({ active_every_time: z.array(z.object({ section_number: z.any(), section_name: z.string(), packet_name: z.string(), drafting_role: z.string() })) }),
  downstream_store_requests: z.object({
    drafting_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["DraftingHouseRules.pdf"]), required_for_operations: z.array(z.enum(["draft", "evaluate", "rewrite"])), priority_rules: z.array(z.enum(["12", "13", "13A", "22", "23"])), structure_lock_policy: z.enum(["not_required"]) }),
    polish_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["PolishHouseRules.pdf"]), required_for_operations: z.array(z.enum(["polish"])), priority_rules: z.array(z.string()), structure_lock_policy: z.enum(["required"]) }),
  }),
  missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N2_Unit_Contract_Builder", ""]),
});

const DraftingBibleStackSchema = z.object({ active_every_time: z.array(z.object({ section_number: z.any(), section_name: z.string(), packet_name: z.string(), drafting_role: z.string() })) });
const DownstreamStoreRequestsSchema = z.object({
  drafting_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["DraftingHouseRules.pdf"]), required_for_operations: z.array(z.enum(["draft", "evaluate", "rewrite"])), priority_rules: z.array(z.enum(["12", "13", "13A", "22", "23"])), structure_lock_policy: z.enum(["not_required"]) }),
  polish_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["PolishHouseRules.pdf"]), required_for_operations: z.array(z.enum(["polish"])), priority_rules: z.array(z.string()), structure_lock_policy: z.enum(["required"]) }),
});
const StylePacketSchema = z.object({ source_section_number: z.any(), narrative_mandate: z.string(), prose_texture: z.string(), opening_propulsion: z.string(), narrative_rhythm: z.string(), descriptive_priority: z.string(), object_engine_rule: z.string(), emotional_handling: z.string(), pleasure_rule: z.string(), emotion_inside_motion: z.string(), suspense_rule: z.string(), political_handling: z.string(), action_handling: z.string(), dialogue_relation: z.string(), pov_discipline: z.string(), atmosphere_rule: z.string(), ending_rule: z.string(), suspense_sequence_pass_criteria: z.array(z.string()), suspense_sequence_failure_signs: z.array(z.string()), forbidden_style_failures: z.array(z.string()), style_shorthand: z.string() });
const DialogueVoicePacketSchema = z.object({ source_section_number: z.any(), dialogue_mandate: z.string(), voice_differentiation_rules: z.array(z.string()), subtext_rules: z.array(z.string()), compression_rules: z.array(z.string()), interruption_and_silence_rules: z.array(z.string()), flirtation_and_desire_rules: z.array(z.string()), institutional_speech_rules: z.array(z.string()), voice_forbidden_failures: z.array(z.string()), dialogue_voice_shorthand: z.string() });
const LockedDraftPrioritiesPacketSchema = z.object({ source_section_number: z.any(), locked_draft_mandate: z.string(), nonnegotiable_priorities: z.array(z.string()), do_not_change: z.array(z.string()), escalation_priorities: z.array(z.string()), relationship_lock_points: z.array(z.string()), object_and_motif_lock_points: z.array(z.string()), ending_and_payoff_lock_points: z.array(z.string()), locked_priorities_shorthand: z.string() });
const CharacterConstellationPacketSchema = z.object({ source_section_number: z.any(), constellation_mandate: z.string(), central_pairing: z.string(), major_characters: z.array(z.object({ name: z.string(), role: z.string(), function: z.string(), relation_to_pov: z.string() })), relationship_pressure_lines: z.array(z.string()), attraction_conflict_axes: z.array(z.string()), trust_fault_lines: z.array(z.string()), constellation_shorthand: z.string() });
const StructuralSpinePacketSchema = z.object({ source_section_number: z.any(), current_unit_spine_function: z.string(), upstream_dependencies: z.array(z.string()), downstream_setup_payoffs: z.array(z.string()), escalation_logic: z.array(z.string()), spine_shorthand: z.string() });
const SetpieceSymbolArchitecturePacketSchema = z.object({ source_section_number: z.any(), setpiece_mandate: z.string(), chapter_relevant_setpieces: z.array(z.string()), object_symbol_rules: z.array(z.string()), visual_escalation_cues: z.array(z.string()), setpiece_failure_signs: z.array(z.string()), architecture_shorthand: z.string() });
const WorldSettingPalettePacketSchema = z.object({ source_section_number: z.any(), setting_palette_rules: z.array(z.string()), city_specific_texture_rules: z.array(z.string()), environmental_pressure_cues: z.array(z.string()), institutional_surface_rules: z.array(z.string()), palette_shorthand: z.string() });
const ThematicMoralArchitecturePacketSchema = z.object({ source_section_number: z.any(), thematic_mandate: z.string(), central_thematic_questions: z.array(z.string()), moral_pressure_lines: z.array(z.string()), private_public_cost_rules: z.array(z.string()), contradiction_and_complicity_rules: z.array(z.string()), thematic_shorthand: z.string() });
const SignatureVerbalDeploymentPacketSchema = z.object({ source_section_number: z.any(), signature_language_rules: z.array(z.string()), recurring_phrase_motifs: z.array(z.string()), metaphor_and_comparison_rules: z.array(z.string()), verbal_do_not_use: z.array(z.string()), signature_shorthand: z.string() });
const ResearchAuthenticityPacketSchema = z.object({ source_section_number: z.any(), authenticity_mandate: z.string(), procedural_truth_rules: z.array(z.string()), terminology_and_register_rules: z.array(z.string()), domain_specific_constraints: z.array(z.string()), realism_do_not_fake: z.array(z.string()), authenticity_shorthand: z.string() });
const PrestigeQualityAlignmentPacketSchema = z.object({ source_section_number: z.any(), prestige_mandate: z.string(), quality_benchmarks: z.array(z.string()), anti_generic_failures: z.array(z.string()), audience_promise_rules: z.array(z.string()), prestige_shorthand: z.string() });
const UnitContractSchema = z.object({ source_section_number: z.any(), movement_label: z.string(), movement_approximate_length: z.any(), unit_label: z.string(), target_word_count: z.any(), pov: z.string(), setting: z.string(), objective: z.string(), conflict: z.string(), reversal: z.string(), reveal: z.string(), carry_forward: z.string(), ending_hook: z.string(), drafting_beats: z.array(z.string()) });
const DraftedUnitSchema = z.object({ unit_label: z.string(), chapter_heading: z.string(), drafted_text: z.string(), ending_condition: z.string(), carry_forward_summary: z.string() });

const SharedBaseSchema = z.object({
  story_run_id: z.any(), project_id: z.any(), chapter_worker_version: z.any(),
  chapter_context: z.any(), run_config: z.any(),
  status: z.enum(["ready", "needs_input", "blocked"]),
  requested_operation: z.enum(["draft", "evaluate", "rewrite", "polish", "format", "final_output", "story_orchestrator_handoff"]),
  resolved_scope: z.string(), target_units_requested: z.array(z.string()),
});

const Node2UnitContractBuilderSchema = SharedBaseSchema.extend({
  canon_basis: z.enum(["master_story_bible", "approved_draft", "target_text_only"]),
  active_bible_sections: z.array(z.any()), drafting_bible_stack: DraftingBibleStackSchema,
  style_packet: StylePacketSchema, dialogue_voice_packet: DialogueVoicePacketSchema,
  locked_draft_priorities_packet: LockedDraftPrioritiesPacketSchema,
  character_constellation_packet: CharacterConstellationPacketSchema,
  structural_spine_packet: StructuralSpinePacketSchema,
  setpiece_symbol_architecture_packet: SetpieceSymbolArchitecturePacketSchema,
  world_setting_palette_packet: WorldSettingPalettePacketSchema,
  thematic_moral_architecture_packet: ThematicMoralArchitecturePacketSchema,
  signature_verbal_deployment_packet: SignatureVerbalDeploymentPacketSchema,
  research_authenticity_packet: ResearchAuthenticityPacketSchema,
  prestige_quality_alignment_packet: PrestigeQualityAlignmentPacketSchema,
  unit_contracts: z.array(UnitContractSchema), downstream_store_requests: DownstreamStoreRequestsSchema,
  missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N3_Chapter_Drafter", ""]),
});

const Node3ChapterDrafterSchema = Node2UnitContractBuilderSchema.omit({ next_node: true }).extend({
  store_packet_status: z.enum(["preserved", "rebuilt"]),
  drafted_units: z.array(DraftedUnitSchema),
  missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N4A_Upstream_Draft_Gate", ""]),
});

const Node4aUpstreamDraftGateSchema = SharedBaseSchema.extend({
  upstream_draft_status: z.enum(["present", "missing"]),
  upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]),
  matching_node2_status: z.enum(["present", "missing"]),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N4B_Enhancement_Evaluator", ""]),
});

const PerUnitEnhancementPacketSchema = z.object({ unit_label: z.string(), contract_fidelity_score: z.any(), drafting_rules_compliance_score: z.any(), chapter_drive_score: z.any(), kindle_readability_score: z.any(), suspense_emotional_voltage_score: z.any(), preserve: z.array(z.string()), clarify: z.array(z.string()), cut_or_reduce: z.array(z.string()), strengthen: z.array(z.string()), add_or_sharpen: z.array(z.string()), dialogue_upgrades: z.array(z.string()), pov_emotional_access_upgrades: z.array(z.string()), suspense_thriller_pressure_upgrades: z.array(z.string()), pacing_bingeability_upgrades: z.array(z.string()), paragraphing_kindle_readability_upgrades: z.array(z.string()), ending_forward_pressure_upgrades: z.array(z.string()), ready_to_paste_rewrite_brief: z.string() });

const Node4bEnhancementEvaluatorSchema = SharedBaseSchema.extend({
  upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]),
  matching_node2_status: z.enum(["present", "missing"]),
  enhancement_cycle_number: z.any(), max_enhancement_cycles: z.any(),
  cycles_remaining_after_rewrite: z.any(),
  per_unit_enhancement_packets: z.array(PerUnitEnhancementPacketSchema),
  cross_chapter_sequence_instructions: z.string(), rewrite_brief: z.string(),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N5_Chapter_Rewriter", ""]),
});

const Node5ChapterRewriterSchema = SharedBaseSchema.extend({
  rewrite_cycle_completed: z.any(), max_enhancement_cycles: z.any(),
  remaining_rewrite_cycles: z.any(),
  upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]),
  drafted_units: z.array(DraftedUnitSchema), rewrite_applied_summary: z.string(),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N4A_Upstream_Draft_Gate", "N6_Polish_Pass_1", ""]),
});

const Node6PolishReadyGateSchema = SharedBaseSchema.extend({
  configured_max_polish_cycles: z.any(),
  upstream_polish_status: z.enum(["present", "missing"]),
  upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]),
  structural_lock_status: z.enum(["locked", "not_locked"]),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N7_Polish_Evaluator", ""]),
});

const PerUnitPolishPacketSchema = z.object({ unit_label: z.string(), polish_readiness_score: z.any(), dialogue_naturalism_score: z.any(), kindle_readability_score: z.any(), paragraph_density_score: z.any(), voice_preservation_score: z.any(), preserve: z.array(z.string()), tighten: z.array(z.string()), smooth_or_rephrase: z.array(z.string()), punctuation_cleanup: z.array(z.string()), dialogue_self_check_repairs: z.array(z.string()), character_voice_preservation: z.array(z.string()), paragraph_density_cleanup: z.array(z.string()), line_break_cleanup: z.array(z.string()), formatting_cleanup: z.array(z.string()), continuity_microfixes: z.array(z.string()), final_surface_cleanup: z.array(z.string()), ready_to_paste_polish_brief: z.string() });

const Node7PolishEvaluatorSchema = SharedBaseSchema.extend({
  configured_max_polish_cycles: z.any(),
  upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]),
  polish_cycle_number: z.any(), max_polish_cycles: z.any(), cycles_remaining_after_polish: z.any(),
  per_unit_polish_packets: z.array(PerUnitPolishPacketSchema),
  cross_chapter_polish_instructions: z.string(), polish_brief: z.string(),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N8_Polish_Rewriter", ""]),
});

const Node8PolishRewriterSchema = SharedBaseSchema.extend({
  configured_max_polish_cycles: z.any(), polish_cycle_completed: z.any(),
  max_polish_cycles: z.any(), remaining_polish_cycles: z.any(),
  upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]),
  drafted_units: z.array(DraftedUnitSchema), polish_applied_summary: z.string(),
  blocked_reasons: z.array(z.string()),
  next_node: z.enum(["N6_Polish_Pass_1", "N9_Final_Chapter_Output", ""]),
});

const Node9FinalChapterOutputSchema = SharedBaseSchema.extend({
  configured_max_polish_cycles: z.any(), polish_cycles_completed: z.any(),
  final_source_node: z.enum(["N8_Polish_Rewriter", ""]),
  drafted_units: z.array(DraftedUnitSchema), final_output_summary: z.string(),
  blocked_reasons: z.array(z.string()), next_node: z.enum([""]),
});

const Node10StoryOrchestratorHandoffPackagerSchema = SharedBaseSchema.extend({
  final_source_node: z.enum(["N9_Final_Chapter_Output", ""]),
  chapter_number: z.any(), chapter_title: z.any(), unit_label: z.any(),
  chapter_heading: z.any(), final_chapter_text: z.string(), final_word_count: z.any(),
  chapter_summary: z.string(), carry_forward_summary: z.string(),
  end_of_chapter_transition_snippet: z.string(), ending_condition: z.string(),
  open_threads_after_chapter: z.object({ threads_opened: z.array(z.string()), threads_advanced: z.array(z.string()), threads_resolved: z.array(z.string()), threads_deferred: z.array(z.string()) }),
  relationship_state_delta: z.object({ characters_affected: z.array(z.string()), relationship_changes: z.array(z.string()) }),
  object_motif_delta: z.object({ objects_introduced: z.array(z.string()), objects_changed: z.array(z.string()), motifs_activated: z.array(z.string()), motifs_paid_off: z.array(z.string()) }),
  location_time_state: z.object({ ending_location: z.any(), ending_time_marker: z.any(), timeline_delta: z.any(), travel_or_transition_state: z.any() }),
  continuity_flags: z.object({ new_character_names: z.array(z.string()), new_locations: z.array(z.string()), new_objects: z.array(z.string()), new_promises_or_setups: z.array(z.string()) }),
  worker_metrics: z.object({ rewrite_cycles_configured: z.any(), polish_cycles_configured: z.any(), mode: z.any(), final_source_node: z.enum(["N9_Final_Chapter_Output"]) }),
  handoff_summary: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum([""]),
});

// ─── Agents ───────────────────────────────────────────────────────────────────
// Paste your full agent definitions here exactly as exported from Agent Builder.
// Each agent block (node1IntakeScopeLock..., node2UnitContractBuilder, etc.)
// is unchanged — copy them verbatim from your SDK export.

// ─── Workflow ─────────────────────────────────────────────────────────────────

type WorkflowInput = { input_as_text: string };

export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("CHAPTER WORKER v2", async () => {
    const state = {
      remaining_rewrite_cycles: 4,
      remaining_polish_cycles: 2,
    };

    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] },
    ];

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_69e19ca44b48819095fdcc1546128f870c10ef5883d49c83",
      },
    });

    // Node 1 — does not add to history (runs independently)
    const n1 = await runner.run(node1IntakeScopeLockCanonBasisAndStoreRouting, [...conversationHistory]);
    if (!n1.finalOutput) throw new Error("Node 1 returned no output");
    conversationHistory.push(...n1.newItems.map((i) => i.rawItem));

    // Node 2
    const n2 = await runner.run(node2UnitContractBuilder, [...conversationHistory]);
    if (!n2.finalOutput) throw new Error("Node 2 returned no output");
    conversationHistory.push(...n2.newItems.map((i) => i.rawItem));

    // Node 3
    const n3 = await runner.run(node3ChapterDrafter, [...conversationHistory]);
    if (!n3.finalOutput) throw new Error("Node 3 returned no output");
    conversationHistory.push(...n3.newItems.map((i) => i.rawItem));

    // Rewrite loop (Nodes 4A → 4B → 5)
    while (Number(state.remaining_rewrite_cycles) > 0) {
      const n4a = await runner.run(node4aUpstreamDraftGate, [...conversationHistory]);
      if (!n4a.finalOutput) throw new Error("Node 4A returned no output");
      conversationHistory.push(...n4a.newItems.map((i) => i.rawItem));
      if (n4a.finalOutput.status !== "ready") return n4a.finalOutput;

      const n4b = await runner.run(node4bEnhancementEvaluator, [...conversationHistory]);
      if (!n4b.finalOutput) throw new Error("Node 4B returned no output");
      conversationHistory.push(...n4b.newItems.map((i) => i.rawItem));
      if (n4b.finalOutput.status !== "ready") return n4b.finalOutput;

      const n5 = await runner.run(node5ChapterRewriter, [...conversationHistory]);
      if (!n5.finalOutput) throw new Error("Node 5 returned no output");
      conversationHistory.push(...n5.newItems.map((i) => i.rawItem));

      state.remaining_rewrite_cycles = Number(n5.finalOutput.remaining_rewrite_cycles);
    }

    // Polish loop (Nodes 6 → 7 → 8)
    while (Number(state.remaining_polish_cycles) > 0) {
      const n6 = await runner.run(node6PolishReadyGate, [...conversationHistory]);
      if (!n6.finalOutput) throw new Error("Node 6 returned no output");
      conversationHistory.push(...n6.newItems.map((i) => i.rawItem));
      if (n6.finalOutput.status !== "ready") return n6.finalOutput;

      const n7 = await runner.run(node7PolishEvaluator, [...conversationHistory]);
      if (!n7.finalOutput) throw new Error("Node 7 returned no output");
      conversationHistory.push(...n7.newItems.map((i) => i.rawItem));
      if (n7.finalOutput.status !== "ready") return n7.finalOutput;

      const n8 = await runner.run(node8PolishRewriter, [...conversationHistory]);
      if (!n8.finalOutput) throw new Error("Node 8 returned no output");
      conversationHistory.push(...n8.newItems.map((i) => i.rawItem));
      if (n8.finalOutput.status !== "ready") return n8.finalOutput;

      state.remaining_polish_cycles = Number(n8.finalOutput.remaining_polish_cycles);
    }

    // Node 9 — Final output
    const n9 = await runner.run(node9FinalChapterOutput, [...conversationHistory]);
    if (!n9.finalOutput) throw new Error("Node 9 returned no output");
    conversationHistory.push(...n9.newItems.map((i) => i.rawItem));

    // Node 10 — Handoff packager
    const n10 = await runner.run(node10StoryOrchestratorHandoffPackager, [...conversationHistory]);
    if (!n10.finalOutput) throw new Error("Node 10 returned no output");

    return n10.finalOutput;
  });
};

// ─── Netlify HTTP Handler ─────────────────────────────────────────────────────

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    if (!body.input_as_text) {
      return new Response(
        JSON.stringify({ error: "input_as_text is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await runWorkflow({ input_as_text: body.input_as_text });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Workflow error:", err);
    return new Response(
      JSON.stringify({ error: "Workflow failed", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/chapter-worker",
  type: "background",
};
