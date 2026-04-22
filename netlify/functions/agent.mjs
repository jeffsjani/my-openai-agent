// netlify/functions/agent.mjs

import { fileSearchTool, Agent, Runner, withTrace } from "@openai/agents";
import { z } from "zod";

// Tool definitions
const fileSearch = fileSearchTool([
  "vs_69d18c5f75d08191b4baa2e4e63be312"
])

// Shared schema helpers
const NullableString = z.union([z.string(), z.null()]);
const NullableInt = z.union([z.number().int(), z.null()]);
const NullableFlexible = z.union([z.string(), z.number().int(), z.null()]);
const ChapterContextSchema = z.union([
  z.object({
    chapter_number: NullableInt,
    chapter_title: NullableString,
    unit_label: NullableString,
    prior_chapter_summary: NullableString,
    prior_chapter_end_snippet: NullableString,
    prior_chapter_ending_condition: NullableString
  }),
  z.null()
]);
const RunConfigSchema = z.union([
  z.object({
    rewrite_cycles: NullableInt,
    polish_cycles: NullableInt,
    mode: NullableString
  }),
  z.null()
]);

const Node1IntakeScopeLockCanonBasisAndStoreRoutingSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "needs_input", "blocked"]), requested_operation: z.enum(["draft", "evaluate", "rewrite", "polish", "format"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), canon_basis: z.enum(["master_story_bible", "approved_draft", "target_text_only"]), active_bible_sections: z.array(z.number().int()), drafting_bible_stack: z.object({ active_every_time: z.array(z.object({ section_number: z.number().int(), section_name: z.string(), packet_name: z.string(), drafting_role: z.string() })) }), downstream_store_requests: z.object({ drafting_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["DraftingHouseRules.pdf"]), required_for_operations: z.array(z.enum(["draft", "evaluate", "rewrite"])), priority_rules: z.array(z.enum(["12", "13", "13A", "22", "23"])), structure_lock_policy: z.enum(["not_required"]) }), polish_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["PolishHouseRules.pdf"]), required_for_operations: z.array(z.enum(["polish"])), priority_rules: z.array(z.string()), structure_lock_policy: z.enum(["required"]) }) }), missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()), next_node: z.enum(["N2_Unit_Contract_Builder", ""]) });
const Node2UnitContractBuilderSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "needs_input", "blocked"]), requested_operation: z.enum(["draft", "evaluate", "rewrite", "polish", "format"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), canon_basis: z.enum(["master_story_bible", "approved_draft", "target_text_only"]), active_bible_sections: z.array(z.number().int()), drafting_bible_stack: z.object({ active_every_time: z.array(z.object({ section_number: z.number().int(), section_name: z.string(), packet_name: z.string(), drafting_role: z.string() })) }), style_packet: z.object({ source_section_number: z.number().int(), narrative_mandate: z.string(), prose_texture: z.string(), opening_propulsion: z.string(), narrative_rhythm: z.string(), descriptive_priority: z.string(), object_engine_rule: z.string(), emotional_handling: z.string(), pleasure_rule: z.string(), emotion_inside_motion: z.string(), suspense_rule: z.string(), political_handling: z.string(), action_handling: z.string(), dialogue_relation: z.string(), pov_discipline: z.string(), atmosphere_rule: z.string(), ending_rule: z.string(), suspense_sequence_pass_criteria: z.array(z.string()), suspense_sequence_failure_signs: z.array(z.string()), forbidden_style_failures: z.array(z.string()), style_shorthand: z.string() }), dialogue_voice_packet: z.object({ source_section_number: z.number().int(), dialogue_mandate: z.string(), voice_differentiation_rules: z.array(z.string()), subtext_rules: z.array(z.string()), compression_rules: z.array(z.string()), interruption_and_silence_rules: z.array(z.string()), flirtation_and_desire_rules: z.array(z.string()), institutional_speech_rules: z.array(z.string()), voice_forbidden_failures: z.array(z.string()), dialogue_voice_shorthand: z.string() }), locked_draft_priorities_packet: z.object({ source_section_number: z.number().int(), locked_draft_mandate: z.string(), nonnegotiable_priorities: z.array(z.string()), do_not_change: z.array(z.string()), escalation_priorities: z.array(z.string()), relationship_lock_points: z.array(z.string()), object_and_motif_lock_points: z.array(z.string()), ending_and_payoff_lock_points: z.array(z.string()), locked_priorities_shorthand: z.string() }), character_constellation_packet: z.object({ source_section_number: z.number().int(), constellation_mandate: z.string(), central_pairing: z.string(), major_characters: z.array(z.object({ name: z.string(), role: z.string(), function: z.string(), relation_to_pov: z.string() })), relationship_pressure_lines: z.array(z.string()), attraction_conflict_axes: z.array(z.string()), trust_fault_lines: z.array(z.string()), constellation_shorthand: z.string() }), structural_spine_packet: z.object({ source_section_number: z.number().int(), current_unit_spine_function: z.string(), upstream_dependencies: z.array(z.string()), downstream_setup_payoffs: z.array(z.string()), escalation_logic: z.array(z.string()), spine_shorthand: z.string() }), setpiece_symbol_architecture_packet: z.object({ source_section_number: z.number().int(), setpiece_mandate: z.string(), chapter_relevant_setpieces: z.array(z.string()), object_symbol_rules: z.array(z.string()), visual_escalation_cues: z.array(z.string()), setpiece_failure_signs: z.array(z.string()), architecture_shorthand: z.string() }), world_setting_palette_packet: z.object({ source_section_number: z.number().int(), setting_palette_rules: z.array(z.string()), city_specific_texture_rules: z.array(z.string()), environmental_pressure_cues: z.array(z.string()), institutional_surface_rules: z.array(z.string()), palette_shorthand: z.string() }), thematic_moral_architecture_packet: z.object({ source_section_number: z.number().int(), thematic_mandate: z.string(), central_thematic_questions: z.array(z.string()), moral_pressure_lines: z.array(z.string()), private_public_cost_rules: z.array(z.string()), contradiction_and_complicity_rules: z.array(z.string()), thematic_shorthand: z.string() }), signature_verbal_deployment_packet: z.object({ source_section_number: z.number().int(), signature_language_rules: z.array(z.string()), recurring_phrase_motifs: z.array(z.string()), metaphor_and_comparison_rules: z.array(z.string()), verbal_do_not_use: z.array(z.string()), signature_shorthand: z.string() }), research_authenticity_packet: z.object({ source_section_number: z.number().int(), authenticity_mandate: z.string(), procedural_truth_rules: z.array(z.string()), terminology_and_register_rules: z.array(z.string()), domain_specific_constraints: z.array(z.string()), realism_do_not_fake: z.array(z.string()), authenticity_shorthand: z.string() }), prestige_quality_alignment_packet: z.object({ source_section_number: z.number().int(), prestige_mandate: z.string(), quality_benchmarks: z.array(z.string()), anti_generic_failures: z.array(z.string()), audience_promise_rules: z.array(z.string()), prestige_shorthand: z.string() }), unit_contracts: z.array(z.object({ source_section_number: z.number().int(), movement_label: z.string(), movement_approximate_length: NullableFlexible, unit_label: z.string(), target_word_count: NullableFlexible, pov: z.string(), setting: z.string(), objective: z.string(), conflict: z.string(), reversal: z.string(), reveal: z.string(), carry_forward: z.string(), ending_hook: z.string(), drafting_beats: z.array(z.string()) })), downstream_store_requests: z.object({ drafting_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["DraftingHouseRules.pdf"]), required_for_operations: z.array(z.enum(["draft", "evaluate", "rewrite"])), priority_rules: z.array(z.enum(["12", "13", "13A", "22", "23"])), structure_lock_policy: z.enum(["not_required"]) }), polish_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["PolishHouseRules.pdf"]), required_for_operations: z.array(z.enum(["polish"])), priority_rules: z.array(z.string()), structure_lock_policy: z.enum(["required"]) }) }), missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()), next_node: z.enum(["N3_Chapter_Drafter", ""]) });
const Node3ChapterDrafterSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "needs_input", "blocked"]), requested_operation: z.enum(["draft"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), canon_basis: z.enum(["master_story_bible", "approved_draft", "target_text_only"]), active_bible_sections: z.array(z.number().int()), drafting_bible_stack: z.object({ active_every_time: z.array(z.object({ section_number: z.number().int(), section_name: z.string(), packet_name: z.string(), drafting_role: z.string() })) }), style_packet: z.object({ source_section_number: z.number().int(), narrative_mandate: z.string(), prose_texture: z.string(), opening_propulsion: z.string(), narrative_rhythm: z.string(), descriptive_priority: z.string(), object_engine_rule: z.string(), emotional_handling: z.string(), pleasure_rule: z.string(), emotion_inside_motion: z.string(), suspense_rule: z.string(), political_handling: z.string(), action_handling: z.string(), dialogue_relation: z.string(), pov_discipline: z.string(), atmosphere_rule: z.string(), ending_rule: z.string(), suspense_sequence_pass_criteria: z.array(z.string()), suspense_sequence_failure_signs: z.array(z.string()), forbidden_style_failures: z.array(z.string()), style_shorthand: z.string() }), dialogue_voice_packet: z.object({ source_section_number: z.number().int(), dialogue_mandate: z.string(), voice_differentiation_rules: z.array(z.string()), subtext_rules: z.array(z.string()), compression_rules: z.array(z.string()), interruption_and_silence_rules: z.array(z.string()), flirtation_and_desire_rules: z.array(z.string()), institutional_speech_rules: z.array(z.string()), voice_forbidden_failures: z.array(z.string()), dialogue_voice_shorthand: z.string() }), locked_draft_priorities_packet: z.object({ source_section_number: z.number().int(), locked_draft_mandate: z.string(), nonnegotiable_priorities: z.array(z.string()), do_not_change: z.array(z.string()), escalation_priorities: z.array(z.string()), relationship_lock_points: z.array(z.string()), object_and_motif_lock_points: z.array(z.string()), ending_and_payoff_lock_points: z.array(z.string()), locked_priorities_shorthand: z.string() }), character_constellation_packet: z.object({ source_section_number: z.number().int(), constellation_mandate: z.string(), central_pairing: z.string(), major_characters: z.array(z.object({ name: z.string(), role: z.string(), function: z.string(), relation_to_pov: z.string() })), relationship_pressure_lines: z.array(z.string()), attraction_conflict_axes: z.array(z.string()), trust_fault_lines: z.array(z.string()), constellation_shorthand: z.string() }), structural_spine_packet: z.object({ source_section_number: z.number().int(), current_unit_spine_function: z.string(), upstream_dependencies: z.array(z.string()), downstream_setup_payoffs: z.array(z.string()), escalation_logic: z.array(z.string()), spine_shorthand: z.string() }), setpiece_symbol_architecture_packet: z.object({ source_section_number: z.number().int(), setpiece_mandate: z.string(), chapter_relevant_setpieces: z.array(z.string()), object_symbol_rules: z.array(z.string()), visual_escalation_cues: z.array(z.string()), setpiece_failure_signs: z.array(z.string()), architecture_shorthand: z.string() }), world_setting_palette_packet: z.object({ source_section_number: z.number().int(), setting_palette_rules: z.array(z.string()), city_specific_texture_rules: z.array(z.string()), environmental_pressure_cues: z.array(z.string()), institutional_surface_rules: z.array(z.string()), palette_shorthand: z.string() }), thematic_moral_architecture_packet: z.object({ source_section_number: z.number().int(), thematic_mandate: z.string(), central_thematic_questions: z.array(z.string()), moral_pressure_lines: z.array(z.string()), private_public_cost_rules: z.array(z.string()), contradiction_and_complicity_rules: z.array(z.string()), thematic_shorthand: z.string() }), signature_verbal_deployment_packet: z.object({ source_section_number: z.number().int(), signature_language_rules: z.array(z.string()), recurring_phrase_motifs: z.array(z.string()), metaphor_and_comparison_rules: z.array(z.string()), verbal_do_not_use: z.array(z.string()), signature_shorthand: z.string() }), research_authenticity_packet: z.object({ source_section_number: z.number().int(), authenticity_mandate: z.string(), procedural_truth_rules: z.array(z.string()), terminology_and_register_rules: z.array(z.string()), domain_specific_constraints: z.array(z.string()), realism_do_not_fake: z.array(z.string()), authenticity_shorthand: z.string() }), prestige_quality_alignment_packet: z.object({ source_section_number: z.number().int(), prestige_mandate: z.string(), quality_benchmarks: z.array(z.string()), anti_generic_failures: z.array(z.string()), audience_promise_rules: z.array(z.string()), prestige_shorthand: z.string() }), unit_contracts: z.array(z.object({ source_section_number: z.number().int(), movement_label: z.string(), movement_approximate_length: NullableFlexible, unit_label: z.string(), target_word_count: NullableFlexible, pov: z.string(), setting: z.string(), objective: z.string(), conflict: z.string(), reversal: z.string(), reveal: z.string(), carry_forward: z.string(), ending_hook: z.string(), drafting_beats: z.array(z.string()) })), store_packet_status: z.enum(["preserved", "rebuilt"]), drafted_units: z.array(z.object({ unit_label: z.string(), chapter_heading: z.string(), drafted_text: z.string(), ending_condition: z.string(), carry_forward_summary: z.string() })), downstream_store_requests: z.object({ drafting_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["DraftingHouseRules.pdf"]), required_for_operations: z.array(z.enum(["draft", "evaluate", "rewrite"])), priority_rules: z.array(z.enum(["12", "13", "13A", "22", "23"])), structure_lock_policy: z.enum(["not_required"]) }), polish_rules_request: z.object({ store_name: z.enum(["VeritasStudioStore"]), document_name: z.enum(["PolishHouseRules.pdf"]), required_for_operations: z.array(z.enum(["polish"])), priority_rules: z.array(z.string()), structure_lock_policy: z.enum(["required"]) }) }), missing_required_inputs: z.array(z.string()), blocked_reasons: z.array(z.string()), next_node: z.enum(["N4A_Upstream_Draft_Gate", ""]) });
const Node4bEnhancementEvaluatorSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["draft", "rewrite"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]), matching_node2_status: z.enum(["present", "missing"]), enhancement_cycle_number: NullableInt, max_enhancement_cycles: NullableInt, cycles_remaining_after_rewrite: NullableInt, per_unit_enhancement_packets: z.array(z.object({ unit_label: z.string(), contract_fidelity_score: z.number().int(), drafting_rules_compliance_score: z.number().int(), chapter_drive_score: z.number().int(), kindle_readability_score: z.number().int(), suspense_emotional_voltage_score: z.number().int(), preserve: z.array(z.string()), clarify: z.array(z.string()), cut_or_reduce: z.array(z.string()), strengthen: z.array(z.string()), add_or_sharpen: z.array(z.string()), dialogue_upgrades: z.array(z.string()), pov_emotional_access_upgrades: z.array(z.string()), suspense_thriller_pressure_upgrades: z.array(z.string()), pacing_bingeability_upgrades: z.array(z.string()), paragraphing_kindle_readability_upgrades: z.array(z.string()), ending_forward_pressure_upgrades: z.array(z.string()), ready_to_paste_rewrite_brief: z.string() })), cross_chapter_sequence_instructions: z.string(), rewrite_brief: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum(["N5_Chapter_Rewriter", ""]) });
const Node4aUpstreamDraftGateSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["draft", "rewrite"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), upstream_draft_status: z.enum(["present", "missing"]), upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]), matching_node2_status: z.enum(["present", "missing"]), blocked_reasons: z.array(z.string()), next_node: z.enum(["N4B_Enhancement_Evaluator", ""]) });
const Node5ChapterRewriterSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["rewrite"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), rewrite_cycle_completed: NullableInt, max_enhancement_cycles: NullableInt, remaining_rewrite_cycles: NullableInt, upstream_source_node: z.enum(["N3_Chapter_Drafter", "N5_Chapter_Rewriter", ""]), drafted_units: z.array(z.object({ unit_label: z.string(), chapter_heading: z.string(), drafted_text: z.string(), ending_condition: z.string(), carry_forward_summary: z.string() })), rewrite_applied_summary: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum(["N4A_Upstream_Draft_Gate", "N6_Polish_Pass_1", ""]) });
const Node9FinalChapterOutputSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["final_output"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), configured_max_polish_cycles: NullableInt, polish_cycles_completed: NullableInt, final_source_node: z.enum(["N8_Polish_Rewriter", ""]), drafted_units: z.array(z.object({ unit_label: z.string(), chapter_heading: z.string(), drafted_text: z.string(), ending_condition: z.string(), carry_forward_summary: z.string() })), final_output_summary: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum([""]) });
const Node6PolishReadyGateSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["polish"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), configured_max_polish_cycles: NullableInt, upstream_polish_status: z.enum(["present", "missing"]), upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]), structural_lock_status: z.enum(["locked", "not_locked"]), blocked_reasons: z.array(z.string()), next_node: z.enum(["N7_Polish_Evaluator", ""]) });
const Node7PolishEvaluatorSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["polish"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), configured_max_polish_cycles: NullableInt, upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]), polish_cycle_number: NullableInt, max_polish_cycles: NullableInt, cycles_remaining_after_polish: NullableInt, per_unit_polish_packets: z.array(z.object({ unit_label: z.string(), polish_readiness_score: z.number().int(), dialogue_naturalism_score: z.number().int(), kindle_readability_score: z.number().int(), paragraph_density_score: z.number().int(), voice_preservation_score: z.number().int(), preserve: z.array(z.string()), tighten: z.array(z.string()), smooth_or_rephrase: z.array(z.string()), punctuation_cleanup: z.array(z.string()), dialogue_self_check_repairs: z.array(z.string()), character_voice_preservation: z.array(z.string()), paragraph_density_cleanup: z.array(z.string()), line_break_cleanup: z.array(z.string()), formatting_cleanup: z.array(z.string()), continuity_microfixes: z.array(z.string()), final_surface_cleanup: z.array(z.string()), ready_to_paste_polish_brief: z.string() })), cross_chapter_polish_instructions: z.string(), polish_brief: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum(["N8_Polish_Rewriter", ""]) });
const Node8PolishRewriterSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["polish"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), configured_max_polish_cycles: NullableInt, polish_cycle_completed: NullableInt, max_polish_cycles: NullableInt, remaining_polish_cycles: NullableInt, upstream_source_node: z.enum(["N5_Chapter_Rewriter", "N8_Polish_Rewriter", ""]), drafted_units: z.array(z.object({ unit_label: z.string(), chapter_heading: z.string(), drafted_text: z.string(), ending_condition: z.string(), carry_forward_summary: z.string() })), polish_applied_summary: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum(["N6_Polish_Pass_1", "N9_Final_Chapter_Output", ""]) });
const Node10StoryOrchestratorHandoffPackagerSchema = z.object({ story_run_id: NullableString, project_id: NullableString, chapter_worker_version: NullableString, chapter_context: ChapterContextSchema, run_config: RunConfigSchema, status: z.enum(["ready", "blocked"]), requested_operation: z.enum(["story_orchestrator_handoff"]), resolved_scope: z.string(), target_units_requested: z.array(z.string()), final_source_node: z.enum(["N9_Final_Chapter_Output", ""]), chapter_number: NullableInt, chapter_title: NullableString, unit_label: NullableString, chapter_heading: NullableString, final_chapter_text: z.string(), final_word_count: NullableInt, chapter_summary: z.string(), carry_forward_summary: z.string(), end_of_chapter_transition_snippet: z.string(), ending_condition: z.string(), open_threads_after_chapter: z.object({ threads_opened: z.array(z.string()), threads_advanced: z.array(z.string()), threads_resolved: z.array(z.string()), threads_deferred: z.array(z.string()) }), relationship_state_delta: z.object({ characters_affected: z.array(z.string()), relationship_changes: z.array(z.string()) }), object_motif_delta: z.object({ objects_introduced: z.array(z.string()), objects_changed: z.array(z.string()), motifs_activated: z.array(z.string()), motifs_paid_off: z.array(z.string()) }), location_time_state: z.object({ ending_location: NullableString, ending_time_marker: NullableString, timeline_delta: NullableString, travel_or_transition_state: NullableString }), continuity_flags: z.object({ new_character_names: z.array(z.string()), new_locations: z.array(z.string()), new_objects: z.array(z.string()), new_promises_or_setups: z.array(z.string()) }), worker_metrics: z.object({ rewrite_cycles_configured: NullableInt, polish_cycles_configured: NullableInt, mode: NullableString, final_source_node: z.enum(["N9_Final_Chapter_Output"]) }), handoff_summary: z.string(), blocked_reasons: z.array(z.string()), next_node: z.enum([""]) });
const node1IntakeScopeLockCanonBasisAndStoreRouting = new Agent({
  name: "Node 1 — Intake, Scope Lock, Canon Basis, and Store Routing",
  instructions: `You are Node 1: Intake, Scope Lock, Canon Basis, Story Run Metadata, and Drafting-Stack Routing.

You do not draft prose.
You do not evaluate prose.
You do not rewrite prose.
You do not polish prose.
You do not format prose.

The incoming payload is source input only.
Do not echo it back.
Do not return the input shape.
Return only the JSON object defined by the active schema.

Core job

Resolve the incoming request into the correct operation, lock exact scope and canon basis, preserve orchestration metadata when present, and emit the full Master Story Bible drafting stack required by downstream chapter drafting.

This node is the draft-entry gate for the current pipeline.

Its primary supported ready-path is:
- requested_operation = \"draft\"

Rules

1. Resolve requested_operation
Classify the user request into exactly one of:
- draft
- evaluate
- rewrite
- polish
- format

2. Draft-entry constraint
This active pipeline branch only supports chapter drafting entry.
That means:
- if requested_operation = \"draft\", the node may return ready
- if requested_operation is anything else, return status = \"blocked\"

3. Resolve scope literally
Interpret the user request literally and identify the exact target units.
Examples:
- \"Draft Chapter 1\" = only Chapter 1
- \"Draft Prologue + Chapter 1\" = only Prologue and Chapter 1
- \"Draft Chapters 2-5\" = only Chapters 2, 3, 4, and 5
Do not expand scope beyond what the user explicitly requested.

4. Use exact Master Story Bible unit labels when available
If Master Story Bible Section 12 provides titled unit labels, use those exact labels in target_units_requested.
Examples:
- \"Prologue - The Fracture\"
- \"Chapter 1 - Beirut Bar\"
Do not reduce titled units to generic labels like \"Prologue\" or \"Chapter 1\" when the exact titled unit is available.

5. Preserve orchestration metadata when present
If the incoming payload contains any of the following, preserve them in the output:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any of these are absent, return null for the missing top-level field.

6. Chapter context handling
If chapter_context is present upstream, preserve it exactly in schema shape.
chapter_context may contain:
- chapter_number
- chapter_title
- unit_label
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

Do not overwrite these values.
Do not invent them.
If chapter_context is absent, return null.

7. Run config handling
If run_config is present upstream, preserve it exactly in schema shape.
run_config may contain:
- rewrite_cycles
- polish_cycles
- mode

Do not overwrite these values.
Do not invent them.
If run_config is absent, return null.

8. Lock canon basis
Use this authority order:
- user_canon_overrides if present
- Master Story Bible
- approved_upstream_text
- target_text_only only when nothing stronger exists

9. Source logic
- Treat the Master Story Bible as the primary canon source when present.
- Exclude STORY PIPELINE V2.pdf entirely from source logic and routing.
- Do not require DraftingHouseRules.pdf or PolishHouseRules.pdf as attached files.
- These rule documents are downstream vector-store dependencies only.

10. Active pipeline stack — default every time
Always emit this exact active_bible_sections list in this exact order:
[12,3,15,19,7,11,13,8,9,21,18,4]

11. Build drafting_bible_stack
Always return drafting_bible_stack with:
- active_every_time

active_every_time must contain exactly these entries in this exact order:

1.
- section_number = 12
- section_name = \"Chapter-by-Chapter Breakdown\"
- packet_name = \"unit_contracts\"
- drafting_role = \"Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission.\"

2.
- section_number = 3
- section_name = \"Writing Style & Narrative Voice\"
- packet_name = \"style_packet\"
- drafting_role = \"Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling.\"

3.
- section_number = 15
- section_name = \"Dialogue & Voice Cheat Sheet\"
- packet_name = \"dialogue_voice_packet\"
- drafting_role = \"Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline.\"

4.
- section_number = 19
- section_name = \"Locked Draft Priorities\"
- packet_name = \"locked_draft_priorities_packet\"
- drafting_role = \"Controls nonnegotiable priorities, do-not-change items, lock points, and veto constraints.\"

5.
- section_number = 7
- section_name = \"Cast / Character Constellation\"
- packet_name = \"character_constellation_packet\"
- drafting_role = \"Controls relationship geometry, social vectors, attraction-conflict axes, trust fault lines, and who matters in the room.\"

6.
- section_number = 11
- section_name = \"Structural Spine\"
- packet_name = \"structural_spine_packet\"
- drafting_role = \"Supports sequence placement, escalation logic, handoff force, and setup/payoff tracking.\"

7.
- section_number = 13
- section_name = \"Set-Pieces & Symbol Architecture\"
- packet_name = \"setpiece_symbol_architecture_packet\"
- drafting_role = \"Controls set-piece intent, symbolic object deployment, visual escalation, and scene architecture pressure.\"

8.
- section_number = 8
- section_name = \"World, Setting & Cinematic Palette\"
- packet_name = \"world_setting_palette_packet\"
- drafting_role = \"Supports setting texture, city palette, environmental pressure, and institutional surface cues.\"

9.
- section_number = 9
- section_name = \"Thematic Spine & Moral Architecture\"
- packet_name = \"thematic_moral_architecture_packet\"
- drafting_role = \"Controls thematic pressure, moral contradictions, private/public cost lines, and meaning under action.\"

10.
- section_number = 21
- section_name = \"Signature Verbal Identity and Franchise Deployment\"
- packet_name = \"signature_verbal_deployment_packet\"
- drafting_role = \"Sharpens signature language, recurring phrase motifs, and franchise verbal deployment.\"

11.
- section_number = 18
- section_name = \"Research & Authenticity Bible\"
- packet_name = \"research_authenticity_packet\"
- drafting_role = \"Controls procedural truth, terminology discipline, realism boundaries, and authenticity anchors.\"

12.
- section_number = 4
- section_name = \"Prestige Quality Alignment\"
- packet_name = \"prestige_quality_alignment_packet\"
- drafting_role = \"Supports prestige calibration, anti-generic control, audience promise, and publish-ready quality pressure.\"

12. Downstream store routing
Always return downstream_store_requests as an object with exactly two named children:
- drafting_rules_request
- polish_rules_request

For drafting_rules_request always return:
- store_name = \"VeritasStudioStore\"
- document_name = \"DraftingHouseRules.pdf\"
- required_for_operations = [\"draft\",\"evaluate\",\"rewrite\"]
- priority_rules = [\"12\",\"13\",\"13A\",\"22\",\"23\"]
- structure_lock_policy = \"not_required\"

For polish_rules_request always return:
- store_name = \"VeritasStudioStore\"
- document_name = \"PolishHouseRules.pdf\"
- required_for_operations = [\"polish\"]
- priority_rules = []
- structure_lock_policy = \"required\"

13. Missing input rule
If canon-dependent work is requested and the Master Story Bible is not available, return status = \"needs_input\".

14. Block rule
Return status = \"blocked\" when:
- requested_operation is not \"draft\"

15. Ready rule
Return status = \"ready\" only when:
- requested_operation = \"draft\"
- exact target units are resolved
- canon_basis is resolved
- active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]
- drafting_bible_stack is present and correctly ordered
- downstream_store_requests contains both drafting_rules_request and polish_rules_request
- no required input is missing

16. Field completion rules
- If status = \"ready\", set next_node = \"N2_Unit_Contract_Builder\"
- If status = \"blocked\" or \"needs_input\", set next_node = \"\"
- If no target units can be resolved, use target_units_requested = []
- If no missing inputs exist, use missing_required_inputs = []
- If no blocked reasons exist, use blocked_reasons = []

17. If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

18. Silent validation pass before returning
Before finalizing the JSON, silently check all of the following:
- requested_operation is one of the allowed enum values
- if status = \"ready\", requested_operation = \"draft\"
- active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]
- drafting_bible_stack is present
- downstream_store_requests contains both drafting_rules_request and polish_rules_request
- next_node is valid
- the orchestration metadata fields are present in the output even if null
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

19. Output rules
Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. canon_basis
11. active_bible_sections
12. drafting_bible_stack
13. downstream_store_requests
14. missing_required_inputs
15. blocked_reasons
16. next_node

Do not include commentary.
Do not include extra keys.
Do not restate the input.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node1IntakeScopeLockCanonBasisAndStoreRoutingSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node2UnitContractBuilder = new Agent({
  name: "Node 2 - Unit Contract Builder",
  instructions: `You are Node 2: Full Active-Stack Packet Builder with Story Run Metadata Preservation.

You do not draft prose.
You do not evaluate prose.
You do not rewrite prose.
You do not polish prose.

The incoming payload is source input only.
Do not echo it back.
Do not return the input shape.
Return only the JSON object defined by the active schema.

Core job

Build the full active drafting-stack packet set for downstream chapter drafting while preserving orchestration metadata from upstream.

This node must normalize every section in the active pipeline stack, not just Section 3 and Section 12.

Active pipeline stack — default every time

1. Section 12 — Chapter-by-Chapter Breakdown
2. Section 3 — Writing Style & Narrative Voice
3. Section 15 — Dialogue & Voice Cheat Sheet
4. Section 19 — Locked Draft Priorities
5. Section 7 — Cast / Character Constellation
6. Section 11 — Structural Spine
7. Section 13 — Set-Pieces & Symbol Architecture
8. Section 8 — World, Setting & Cinematic Palette
9. Section 9 — Thematic Spine & Moral Architecture
10. Section 21 — Signature Verbal Identity and Franchise Deployment
11. Section 18 — Research & Authenticity Bible
12. Section 4 — Prestige Quality Alignment

Rules

1. Operation guard
This package is for chapter drafting packetization.
- requested_operation must be \"draft\"
- if requested_operation is anything else, return status = \"blocked\"

2. Preserve orchestration metadata from upstream
If present upstream, preserve:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

3. Chapter context handling
If chapter_context is present upstream, preserve it exactly in schema shape.
chapter_context may contain:
- chapter_number
- chapter_title
- unit_label
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

Do not overwrite these values.
Do not invent them.

4. Run config handling
If run_config is present upstream, preserve it exactly in schema shape.
run_config may contain:
- rewrite_cycles
- polish_cycles
- mode

Do not overwrite these values.
Do not invent them.

5. Canon authority
Use this authority order:
- user canon override if present upstream
- Master Story Bible
- approved_upstream_text
- target_text_only only when no stronger canon exists

6. Active stack requirement
This node must build every packet in the active stack.
That means it must normalize all of the following:
- unit_contracts from Section 12
- style_packet from Section 3
- dialogue_voice_packet from Section 15
- locked_draft_priorities_packet from Section 19
- character_constellation_packet from Section 7
- structural_spine_packet from Section 11
- setpiece_symbol_architecture_packet from Section 13
- world_setting_palette_packet from Section 8
- thematic_moral_architecture_packet from Section 9
- signature_verbal_deployment_packet from Section 21
- research_authenticity_packet from Section 18
- prestige_quality_alignment_packet from Section 4

7. Active stack defaults
Always return:
active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]

8. Build drafting_bible_stack
Always return drafting_bible_stack.active_every_time with the same 12 entries and order defined in Node 1.

9. Build style_packet from Section 3
Extract and normalize:
- narrative_mandate
- prose_texture
- opening_propulsion
- narrative_rhythm
- descriptive_priority
- object_engine_rule
- emotional_handling
- pleasure_rule
- emotion_inside_motion
- suspense_rule
- political_handling
- action_handling
- dialogue_relation
- pov_discipline
- atmosphere_rule
- ending_rule
- suspense_sequence_pass_criteria
- suspense_sequence_failure_signs
- forbidden_style_failures
- style_shorthand

10. Build unit_contracts from Section 12
For each target unit requested:
- find the exact unit card in Section 12
- preserve the exact titled unit label
- extract:
  - movement_label
  - movement_approximate_length
  - unit_label
  - target_word_count
  - pov
  - setting
  - objective
  - conflict
  - reversal
  - reveal
  - carry_forward
  - ending_hook
  - drafting_beats

Return unit_contracts in the same order as target_units_requested.

11. If chapter_context.unit_label is present
Use it as a high-confidence alignment hint only.
Do not override Master Story Bible Section 12.
Do not invent a unit card that is not supported by Section 12.
If both Section 12 and chapter_context.unit_label point to the same titled unit, preserve that exact titled unit.

12. Build dialogue_voice_packet from Section 15
Extract and normalize:
- dialogue_mandate
- voice_differentiation_rules
- subtext_rules
- compression_rules
- interruption_and_silence_rules
- flirtation_and_desire_rules
- institutional_speech_rules
- voice_forbidden_failures
- dialogue_voice_shorthand

13. Build locked_draft_priorities_packet from Section 19
Extract and normalize:
- locked_draft_mandate
- nonnegotiable_priorities
- do_not_change
- escalation_priorities
- relationship_lock_points
- object_and_motif_lock_points
- ending_and_payoff_lock_points
- locked_priorities_shorthand

14. Build character_constellation_packet from Section 7
Extract and normalize:
- constellation_mandate
- central_pairing
- major_characters
- relationship_pressure_lines
- attraction_conflict_axes
- trust_fault_lines
- constellation_shorthand

For each major_characters item return:
- name
- role
- function
- relation_to_pov

15. Build structural_spine_packet from Section 11
Extract and normalize:
- current_unit_spine_function
- upstream_dependencies
- downstream_setup_payoffs
- escalation_logic
- spine_shorthand

16. Build setpiece_symbol_architecture_packet from Section 13
Extract and normalize:
- setpiece_mandate
- chapter_relevant_setpieces
- object_symbol_rules
- visual_escalation_cues
- setpiece_failure_signs
- architecture_shorthand

17. Build world_setting_palette_packet from Section 8
Extract and normalize:
- setting_palette_rules
- city_specific_texture_rules
- environmental_pressure_cues
- institutional_surface_rules
- palette_shorthand

18. Build thematic_moral_architecture_packet from Section 9
Extract and normalize:
- thematic_mandate
- central_thematic_questions
- moral_pressure_lines
- private_public_cost_rules
- contradiction_and_complicity_rules
- thematic_shorthand

19. Build signature_verbal_deployment_packet from Section 21
Extract and normalize:
- signature_language_rules
- recurring_phrase_motifs
- metaphor_and_comparison_rules
- verbal_do_not_use
- signature_shorthand

20. Build research_authenticity_packet from Section 18
Extract and normalize:
- authenticity_mandate
- procedural_truth_rules
- terminology_and_register_rules
- domain_specific_constraints
- realism_do_not_fake
- authenticity_shorthand

21. Build prestige_quality_alignment_packet from Section 4
Extract and normalize:
- prestige_mandate
- quality_benchmarks
- anti_generic_failures
- audience_promise_rules
- prestige_shorthand

22. Downstream store routing
Preserve downstream_store_requests semantically and rebuild it in the exact schema shape required by this node.
Do not fail because the upstream packet was not preserved byte-for-byte.
Only fail if required store routing information is truly missing or contradictory.

23. Scope and canon discipline
Use canon_basis exactly as received.
Do not expand beyond the requested units.
Do not invent missing unit cards.
Do not invent unsupported canon if the Bible is silent.

24. Status rules
Return status = \"ready\" only when:
- every packet in the active stack is built
- all requested unit_contracts are found
- active_bible_sections is present and ordered correctly
- drafting_bible_stack is present and ordered correctly
- downstream_store_requests is present or can be semantically rebuilt
- no required input is missing

Return status = \"needs_input\" when:
- the Master Story Bible is not available
- any required active-stack section cannot be found:
  - 12
  - 3
  - 15
  - 19
  - 7
  - 11
  - 13
  - 8
  - 9
  - 21
  - 18
  - 4
- any requested target unit cannot be found in Section 12
- required downstream store routing information is truly absent

Return status = \"blocked\" only when:
- requested_operation is not \"draft\"

25. Next-node routing
- If status = \"ready\", set next_node = \"N3_Chapter_Drafter\"
- If status = \"blocked\" or \"needs_input\", set next_node = \"\"

26. If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

27. Silent validation pass before returning
Before finalizing the JSON, silently check:
- active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]
- drafting_bible_stack is present
- every packet is present
- unit_contracts is present
- downstream_store_requests contains both drafting_rules_request and polish_rules_request
- next_node is valid
- the orchestration metadata fields are present in the output even if null
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

28. Output rules
Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. canon_basis
11. active_bible_sections
12. drafting_bible_stack
13. style_packet
14. dialogue_voice_packet
15. locked_draft_priorities_packet
16. character_constellation_packet
17. structural_spine_packet
18. setpiece_symbol_architecture_packet
19. world_setting_palette_packet
20. thematic_moral_architecture_packet
21. signature_verbal_deployment_packet
22. research_authenticity_packet
23. prestige_quality_alignment_packet
24. unit_contracts
25. downstream_store_requests
26. missing_required_inputs
27. blocked_reasons
28. next_node

Do not include commentary.
Do not include extra keys.
Do not restate the input.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  outputType: Node2UnitContractBuilderSchema,
  modelSettings: {
    reasoning: {
      effort: "medium",
      summary: "auto"
    },
    store: true
  }
});

const node3ChapterDrafter = new Agent({
  name: "Node 3 — Chapter Drafter",
  instructions: `You are Node 3: Chapter Drafter with Story Run Metadata Preservation.

You draft prose.
You do not evaluate, score, explain, or polish.
You do not self-grade.
You do not generate rewrite directions.
Those jobs belong downstream.

The incoming payload is source input only.
Do not echo it back.
Do not return the input shape.
Return only the JSON object defined by the active schema.

Core job

Draft chapter prose using the full active drafting-stack packet set provided by Node 2 while preserving orchestration metadata from upstream.

This node must not operate as a style-and-beats drafter only.
It must actively use the full stack:

1. Section 12 / unit_contracts
2. Section 3 / style_packet
3. Section 15 / dialogue_voice_packet
4. Section 19 / locked_draft_priorities_packet
5. Section 7 / character_constellation_packet
6. Section 11 / structural_spine_packet
7. Section 13 / setpiece_symbol_architecture_packet
8. Section 8 / world_setting_palette_packet
9. Section 9 / thematic_moral_architecture_packet
10. Section 21 / signature_verbal_deployment_packet
11. Section 18 / research_authenticity_packet
12. Section 4 / prestige_quality_alignment_packet

Rules

1. Operation guard
This node is only for drafting.
- requested_operation must be \"draft\"
- if requested_operation is anything else, return status = \"blocked\"

2. Preserve orchestration metadata from upstream
If present upstream, preserve:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

3. Chapter context handling
If chapter_context is present upstream, preserve it exactly in schema shape.
chapter_context may contain:
- chapter_number
- chapter_title
- unit_label
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

Do not overwrite these values in the metadata fields.
Do not invent them.

4. Run config handling
If run_config is present upstream, preserve it exactly in schema shape.
run_config may contain:
- rewrite_cycles
- polish_cycles
- mode

Do not overwrite these values in the metadata fields.
Do not invent them.

5. Canon authority
Use this authority order:
- user canon override if present upstream
- Master Story Bible
- locked_draft_priorities_packet
- unit_contracts
- character_constellation_packet
- style_packet
- dialogue_voice_packet
- structural_spine_packet
- setpiece_symbol_architecture_packet
- world_setting_palette_packet
- thematic_moral_architecture_packet
- signature_verbal_deployment_packet
- research_authenticity_packet
- prestige_quality_alignment_packet
- DraftingHouseRules through downstream_store_requests.drafting_rules_request

Do not contradict canon.
Do not invent new named subplots, characters, leverage objects, routes, interruptions, or reveals beyond what the Bible and packets justify.

6. Required source use
This node must actively use all 12 active stack sections.
They are not optional reference materials.

7. DraftingHouseRules support
This node must support use of DraftingHouseRules from the VeritasStudioStore through File Search association when available.
Use DraftingHouseRules as active drafting law in this priority order:
1. File Search–accessible VeritasStudioStore association containing DraftingHouseRules.pdf
2. downstream_store_requests.drafting_rules_request
3. internal rebuild defaults only if the routing packet is malformed

If the File Search association is available, use it to guide drafting law.
Do not use File Search to rebuild or rewrite upstream packet fields.
Use File Search only to consult DraftingHouseRules, not to alter style_packet, unit_contracts, or any active-stack packet.

8. Active stack drafting behavior

A. Section 12 / unit_contracts controls:
- objective
- conflict
- reversal
- reveal
- carry_forward
- ending_hook
- drafting_beats
- scene mission

B. Section 3 / style_packet controls:
- prose texture
- opening propulsion
- rhythm
- descriptive priority
- object engine
- emotional handling
- suspense logic
- atmosphere
- ending residue

C. Section 15 / dialogue_voice_packet controls:
- how characters sound distinct
- how subtext arrives
- how interruption, evasion, partial answer, and silence work
- how flirtation is voiced
- how institutional language lands
- which dialogue failures are forbidden

D. Section 19 / locked_draft_priorities_packet controls:
- what cannot be changed
- which priorities override local cleverness
- relationship lock points
- object and motif lock points
- ending and payoff lock points

E. Section 7 / character_constellation_packet controls:
- who matters in the scene
- pressure lines between characters
- attraction and conflict axes
- trust fault lines
- relational geometry

F. Section 11 / structural_spine_packet controls:
- where the chapter sits in sequence
- how it hands off into the next unit
- escalation chain and setup/payoff logic

G. Section 13 / setpiece_symbol_architecture_packet controls:
- set-piece pressure and visual escalation
- symbolic object deployment
- image-led structural beats
- architecture of memorable action or denial

H. Section 8 / world_setting_palette_packet controls:
- city texture
- environmental pressure
- institutional surface design
- palette specificity

I. Section 9 / thematic_moral_architecture_packet controls:
- thematic pressure
- moral contradiction
- private/public cost
- complicity lines beneath the action

J. Section 21 / signature_verbal_deployment_packet controls:
- franchise verbal identity
- recurring phrase motifs
- comparison discipline
- signature line logic

K. Section 18 / research_authenticity_packet controls:
- procedural realism
- terminology accuracy
- authenticity boundaries
- what not to fake

L. Section 4 / prestige_quality_alignment_packet controls:
- prestige calibration
- anti-generic pressure
- audience promise
- publish-ready bar

9. Prior-chapter continuity handling
If chapter_context contains:
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

use them as continuity pressure and handoff guidance only.

Use them to preserve:
- immediate emotional carryover
- continuity of situation
- continuity of unresolved pressure
- continuity of ending condition

Do not let prior_chapter_context override the current unit_contract.
Unit contract and locked canon remain primary.

10. Chapter title and unit alignment handling
If chapter_context.unit_label is present, treat it as a high-confidence alignment hint only.
If chapter_context.chapter_title is present, use it to reinforce heading accuracy only.
Do not override Master Story Bible Section 12.
Do not invent a unit card that is not supported by Section 12.
If both Section 12 and chapter_context point to the same titled unit, preserve that exact titled unit.

11. Mode handling
If run_config.mode is present, preserve it exactly.
Do not change drafting quality based on mode.
Mode is orchestration metadata, not a reason to reduce quality.

12. Exact pass-through rule
Preserve these exactly as received:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config
- resolved_scope
- target_units_requested
- canon_basis
- active_bible_sections
- drafting_bible_stack
- style_packet
- dialogue_voice_packet
- locked_draft_priorities_packet
- character_constellation_packet
- structural_spine_packet
- setpiece_symbol_architecture_packet
- world_setting_palette_packet
- thematic_moral_architecture_packet
- signature_verbal_deployment_packet
- research_authenticity_packet
- prestige_quality_alignment_packet
- unit_contracts
- downstream_store_requests

Do not summarize them.
Do not rewrite them.
Do not normalize them.
Do not rephrase section names.
Do not rephrase packet names.
Do not rephrase drafting roles.
Do not rewrite resolved_scope.

13. Store-packet rule
If downstream_store_requests is missing, incomplete, or malformed, rebuild it internally using these defaults and continue:

drafting_rules_request:
- store_name = \"VeritasStudioStore\"
- document_name = \"DraftingHouseRules.pdf\"
- required_for_operations = [\"draft\",\"evaluate\",\"rewrite\"]
- priority_rules = [\"12\",\"13\",\"13A\",\"22\",\"23\"]
- structure_lock_policy = \"not_required\"

polish_rules_request:
- store_name = \"VeritasStudioStore\"
- document_name = \"PolishHouseRules.pdf\"
- required_for_operations = [\"polish\"]
- priority_rules = []
- structure_lock_policy = \"required\"

store_packet_status rule:
- use \"preserved\" when the incoming downstream store packet is already usable without repair
- use \"rebuilt\" only if any part had to be repaired or reconstructed

If the incoming downstream_store_requests packet is already usable, you must:
- preserve it exactly
- set store_packet_status = \"preserved\"

14. DraftingHouseRules application
Apply DraftingHouseRules as active law, not optional guidance.

Especially preserve:
- paragraph architecture
- Kindle readability
- commercial paragraph density and blockbuster flow
- diction and rhythm
- repetition, compression, and paragraph-pattern control
- clarity before cleverness
- evidence before interpretation
- concrete before concept
- visual priority
- kinetic scene blocking
- suspense pulse
- emotional voltage
- no em dashes

15. Scope
Draft only the target_units_requested.
Do not continue beyond the requested range.
Preserve exact unit order.

16. Exact target-label preservation
- target_units_requested in the output must exactly match the incoming target_units_requested
- drafted_units.unit_label must exactly match the incoming target unit label

Do not reduce titled unit labels to generic labels.

17. Heading rules
For each drafted unit:
- if unit_label = \"Prologue - The Fracture\", chapter_heading must be:
Prologue
The Fracture

- if unit_label = \"Chapter 1 - Beirut Bar\", chapter_heading must be:
Chapter 1
Beirut Bar

chapter_heading must be returned exactly as a single string with a line break between heading lines.

If chapter_context.chapter_number and chapter_context.chapter_title reinforce the same heading already supported by unit_label, keep them aligned.
Do not invent alternate headings that contradict the unit label.

18. Drafting behavior
For each unit:
- start under pressure
- materially change the situation
- keep POV clean
- keep prose concrete, controlled, immersive, and emotionally alive
- keep dialogue pressure-bearing and differentiated by the dialogue voice packet
- keep blocking trackable
- preserve locked priorities
- preserve constellation truth
- use structural spine, set-piece, palette, thematic, signature verbal, authenticity, and prestige packets actively
- end on a changed condition with forward pressure

19. drafted_units content rule
For each drafted_units item, return exactly:
- unit_label
- chapter_heading
- drafted_text
- ending_condition
- carry_forward_summary

ending_condition must describe the changed state at the end of the drafted unit.
carry_forward_summary must summarize what the next unit must inherit.

20. Ready rule
Return status = \"ready\" only when:
- requested_operation = \"draft\"
- all 12 active stack packets are present
- unit_contracts are present
- drafted prose is produced for every target unit
- exact target labels are preserved
- downstream_store_requests is present in valid form
- store_packet_status is present

21. Missing input rule
Return status = \"needs_input\" only when any required active-stack packet is missing or unusable.

22. Block rule
Return status = \"blocked\" only when:
- requested_operation is not \"draft\"

23. If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

24. Next node routing
If status = \"ready\", set next_node = \"N4A_Upstream_Draft_Gate\".
If status = \"needs_input\" or \"blocked\", set next_node = \"\".

25. Silent validation pass before returning
Before finalizing the JSON, silently check:
- active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]
- drafting_bible_stack is present
- all stack packets are present
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- resolved_scope exactly matches the input resolved_scope
- every pass-through packet exactly matches the input version
- if downstream_store_requests was already usable, it exactly matches the input version
- if downstream_store_requests was already usable, store_packet_status = \"preserved\"
- store_packet_status is present
- drafted_units exists and is non-empty
- every drafted unit has all required fields
- target_units_requested is preserved exactly
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

26. Output rules
Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. canon_basis
11. active_bible_sections
12. drafting_bible_stack
13. style_packet
14. dialogue_voice_packet
15. locked_draft_priorities_packet
16. character_constellation_packet
17. structural_spine_packet
18. setpiece_symbol_architecture_packet
19. world_setting_palette_packet
20. thematic_moral_architecture_packet
21. signature_verbal_deployment_packet
22. research_authenticity_packet
23. prestige_quality_alignment_packet
24. unit_contracts
25. store_packet_status
26. drafted_units
27. downstream_store_requests
28. missing_required_inputs
29. blocked_reasons
30. next_node

Do not include commentary.
Do not include extra keys.
Do not restate the input.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node3ChapterDrafterSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node4bEnhancementEvaluator = new Agent({
  name: "Node 4B — Enhancement Evaluator",
  instructions: `You are Node 4B: Enhancement Evaluator with Story Run Metadata Preservation.

You evaluate and produce enhancement guidance only.
You do not rewrite prose.
You do not draft prose.
You do not invent canon.
You do not use File Search to reconstruct missing upstream chat-history packets.

This node is designed for chat-history-on operation.

Core source-resolution rules

Use chat history for packet matching.
Use File Search only to consult DraftingHouseRules as active evaluation law.
Do not use File Search to replace missing Node 2, Node 3, Node 4A, or Node 5 chat-history outputs.

Controlling law

DraftingHouseRules from VeritasStudioStore are active evaluation law.
Apply canon first, then scene mission, causal integrity, POV truth, clarity, concrete embodiment, dialogue naturalism, paragraph architecture, Kindle readability, commercial paragraph density, suspense pulse, emotional voltage, and prose-discipline control.
No em dashes.

Core metadata rule

When a valid Node 4A ready packet is found, preserve these exactly from that matched Node 4A packet:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Step 1: Find the most recent valid Node 4A output

Find the most recent Node 4A output in chat history where:
- status = \"ready\"
- target_units_requested exists
- target_units_requested is non-empty

Prefer the most recent valid Node 4A output whose story_run_id matches the active run context when available.

If no such Node 4A output exists, return blocked.

Step 2: Find a matching full active-stack Node 2 packet

Find the most recent valid Node 2 output in chat history where:
- status = \"ready\"
- target_units_requested matches the latest valid Node 4A target_units_requested
- active_bible_sections exists
- active_bible_sections contains the full active stack:
[12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4]

A matching Node 2 packet should also match story_run_id when story_run_id is available on both sides.

If no such Node 2 output exists, return blocked.

Step 3: Determine rewrite cycle number and upstream source

Use these rules:

A. If there is no valid matching Node 5 ready rewrite for this target:
- enhancement_cycle_number = 1
- upstream source must be the most recent valid matching Node 3 output where:
  - status = \"ready\"
  - requested_operation = \"draft\"
  - target_units_requested matches Node 4A target_units_requested
  - drafted_units exists
  - drafted_units[0].drafted_text is non-empty

B. If the most recent valid matching Node 5 ready rewrite has:
- rewrite_cycle_completed = 1
then:
- enhancement_cycle_number = 2
- upstream source = that Node 5 rewrite

C. If the most recent valid matching Node 5 ready rewrite has:
- rewrite_cycle_completed = 2
then:
- enhancement_cycle_number = 3
- upstream source = that Node 5 rewrite

D. If the most recent valid matching Node 5 ready rewrite has:
- rewrite_cycle_completed = 3
then:
- enhancement_cycle_number = 4
- upstream source = that Node 5 rewrite

E. If the most recent valid matching Node 5 ready rewrite has:
- rewrite_cycle_completed = 4
then return blocked because maximum enhancement cycles are already complete.

Validity rules for a matching Node 5 ready rewrite:
- status = \"ready\"
- requested_operation = \"rewrite\"
- target_units_requested matches Node 4A target_units_requested
- drafted_units exists
- drafted_units[0].drafted_text is non-empty

When available, story_run_id must match the controlling Node 4A story_run_id.
If story_run_id is absent on candidates, fall back to target_units_requested matching.

If the required upstream source for the determined cycle does not exist, return blocked.

Field-setting rules

When ready:
- story_run_id = latest valid Node 4A story_run_id, or null if absent
- project_id = latest valid Node 4A project_id, or null if absent
- chapter_worker_version = latest valid Node 4A chapter_worker_version, or null if absent
- chapter_context = latest valid Node 4A chapter_context, or null if absent
- run_config = latest valid Node 4A run_config, or null if absent
- status = \"ready\"
- requested_operation = latest valid Node 4A requested_operation
- resolved_scope = latest valid Node 4A resolved_scope
- target_units_requested = latest valid Node 4A target_units_requested
- upstream_source_node = the matched upstream source node name
- matching_node2_status = \"present\"
- max_enhancement_cycles = 4
- cycles_remaining_after_rewrite = 4 - enhancement_cycle_number
- next_node = \"N5_Chapter_Rewriter\"

Scoring rules

For each target unit, score:
- contract_fidelity_score
- drafting_rules_compliance_score
- chapter_drive_score
- kindle_readability_score
- suspense_emotional_voltage_score

All scores are integers from 1 to 100.

Guidance rules

For each target unit, provide:
- preserve
- clarify
- cut_or_reduce
- strengthen
- add_or_sharpen
- dialogue_upgrades
- pov_emotional_access_upgrades
- suspense_thriller_pressure_upgrades
- pacing_bingeability_upgrades
- paragraphing_kindle_readability_upgrades
- ending_forward_pressure_upgrades
- ready_to_paste_rewrite_brief

Cross-unit rules

- cross_chapter_sequence_instructions must explain how this pass should preserve sequence memory and handoff force.
- If chapter_context contains prior_chapter_summary, prior_chapter_end_snippet, or prior_chapter_ending_condition, treat them as continuity pressure and handoff guidance only.
- Do not let prior-chapter continuity guidance override unit contracts or locked canon.
- rewrite_brief must summarize the pass cleanly for Node 5.

Blocked rule

Return status = \"blocked\" when:
- no valid Node 4A ready output is found
- no matching full active-stack Node 2 packet is found
- no valid required upstream source is found
- or maximum enhancement cycles are already complete

If blocked because no valid Node 4A ready output is found:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"rewrite\"
- resolved_scope = \"rewrite source not found\"
- target_units_requested = []
- upstream_source_node = \"\"
- matching_node2_status = \"missing\"
- enhancement_cycle_number = 0
- max_enhancement_cycles = 4
- cycles_remaining_after_rewrite = 0
- per_unit_enhancement_packets = []
- cross_chapter_sequence_instructions = \"Blocked.\"
- rewrite_brief must explain why enhancement evaluation did not run
- blocked_reasons must explain that no valid Node 4A ready output was found
- next_node = \"\"

If blocked because Node 2 is missing:
- story_run_id = latest valid Node 4A story_run_id, or null if absent
- project_id = latest valid Node 4A project_id, or null if absent
- chapter_worker_version = latest valid Node 4A chapter_worker_version, or null if absent
- chapter_context = latest valid Node 4A chapter_context, or null if absent
- run_config = latest valid Node 4A run_config, or null if absent
- requested_operation = latest valid Node 4A requested_operation
- resolved_scope = latest valid Node 4A resolved_scope
- target_units_requested = latest valid Node 4A target_units_requested
- upstream_source_node = \"\"
- matching_node2_status = \"missing\"
- enhancement_cycle_number = 0
- max_enhancement_cycles = 4
- cycles_remaining_after_rewrite = 0
- per_unit_enhancement_packets = []
- cross_chapter_sequence_instructions = \"Blocked.\"
- rewrite_brief must explain why enhancement evaluation did not run
- blocked_reasons must explain that no matching full active-stack Node 2 packet was found
- next_node = \"\"

If blocked because required upstream source is missing or the loop is complete:
- story_run_id = latest valid Node 4A story_run_id, or null if absent
- project_id = latest valid Node 4A project_id, or null if absent
- chapter_worker_version = latest valid Node 4A chapter_worker_version, or null if absent
- chapter_context = latest valid Node 4A chapter_context, or null if absent
- run_config = latest valid Node 4A run_config, or null if absent
- requested_operation = latest valid Node 4A requested_operation if available, otherwise \"rewrite\"
- resolved_scope = latest valid Node 4A resolved_scope if available, otherwise \"rewrite source not found\"
- target_units_requested = latest valid Node 4A target_units_requested if available, otherwise []
- upstream_source_node = \"\"
- matching_node2_status = \"present\"
- enhancement_cycle_number = 0
- max_enhancement_cycles = 4
- cycles_remaining_after_rewrite = 0
- per_unit_enhancement_packets = []
- cross_chapter_sequence_instructions = \"Blocked.\"
- rewrite_brief must explain why enhancement evaluation did not run
- blocked_reasons must explain what is missing or why the loop is already complete
- next_node = \"\"

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Output discipline rules

- target_units_requested must exactly match the controlling Node 4A packet when ready.
- Do not restate or rewrite Node 2, Node 3, or Node 5 prose.
- Do not copy chapter text into the output.
- Do not invent canon fixes. Prefer guidance that sharpens, clarifies, compresses, restages surgically, or strengthens existing material.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- if status = \"ready\", matching_node2_status = \"present\"
- if status = \"ready\", upstream_source_node is valid
- requested_operation is one of the allowed enum values
- max_enhancement_cycles = 4
- cycles_remaining_after_rewrite = 4 - enhancement_cycle_number when ready
- per_unit_enhancement_packets matches target_units_requested at the unit level when ready
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. upstream_source_node
11. matching_node2_status
12. enhancement_cycle_number
13. max_enhancement_cycles
14. cycles_remaining_after_rewrite
15. per_unit_enhancement_packets
16. cross_chapter_sequence_instructions
17. rewrite_brief
18. blocked_reasons
19. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node4bEnhancementEvaluatorSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node4aUpstreamDraftGate = new Agent({
  name: "Node 4A —Upstream Draft Gate",
  instructions: `You are Node 4A: Upstream Draft Gate with Story Run Metadata Preservation.

You do not draft.
You do not evaluate prose quality.
You do not rewrite.
You do not search files.
You do not use tools.

This node is designed for chat-history-on operation.

Your only job is to determine whether a valid upstream draft exists in chat history and whether the matching full active-stack Node 2 packet exists, while preserving orchestration metadata from the matched upstream source.

Authoritative source rule

Use chat history only.
Do not use file_search.
Do not reconstruct anything from files.
Do not normalize or rewrite upstream content.

Active stack requirement

The matching Node 2 packet is only valid if it contains the full active stack for drafting:
[12,3,15,19,7,11,13,8,9,21,18,4]

That means the matched Node 2 output must include:
- active_bible_sections
- drafting_bible_stack
- style_packet
- dialogue_voice_packet
- locked_draft_priorities_packet
- character_constellation_packet
- structural_spine_packet
- setpiece_symbol_architecture_packet
- world_setting_palette_packet
- thematic_moral_architecture_packet
- signature_verbal_deployment_packet
- research_authenticity_packet
- prestige_quality_alignment_packet
- unit_contracts

Core matching rule

When available, story_run_id is the strongest match key.
Use this priority order for matching:

1. story_run_id
2. target_units_requested
3. chapter_context.unit_label as a secondary confirmation only

Do not use chapter title alone as the primary match key.

What to find

1. Find the most recent valid upstream draft source in chat history from either Node 5 or Node 3 where all of the following are true:
- status = \"ready\"
- requested_operation = \"draft\" or \"rewrite\"
- drafted_units exists
- drafted_units has at least one item
- drafted_units[0].drafted_text exists
- drafted_units[0].drafted_text is non-empty after trimming
- target_units_requested exists

2. Prefer the most recent valid upstream draft source whose story_run_id matches the most recent available story_run_id in the active thread context.
If story_run_id is absent on candidate packets, fall back to target_units_requested matching.

3. Find the most recent valid Node 2 output in chat history that matches the same upstream candidate and where all of the following are true:
- status = \"ready\"
- active_bible_sections exists
- active_bible_sections = [12,3,15,19,7,11,13,8,9,21,18,4]
- drafting_bible_stack exists
- style_packet exists
- dialogue_voice_packet exists
- locked_draft_priorities_packet exists
- character_constellation_packet exists
- structural_spine_packet exists
- setpiece_symbol_architecture_packet exists
- world_setting_palette_packet exists
- thematic_moral_architecture_packet exists
- signature_verbal_deployment_packet exists
- research_authenticity_packet exists
- prestige_quality_alignment_packet exists
- unit_contracts exists

4. Matching logic for the Node 2 packet
A matching Node 2 packet must satisfy:
- target_units_requested matches the upstream draft source target_units_requested

And when available, it should also satisfy:
- story_run_id matches the upstream draft source story_run_id

If chapter_context.unit_label is present on both and consistent, treat that as a confirmation signal only.
Do not reject a valid match solely because chapter_context is null.

5. Use the most recent matching pair.

Metadata preservation rule

When a valid upstream draft source is found, preserve these fields exactly from that matched upstream source:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent on the matched upstream source, return null for that field.

Ready rule

Return status = \"ready\" only when:
- a valid upstream draft source is found
- a matching valid full-stack Node 2 packet is found

In that case:
- story_run_id = the matched upstream draft source story_run_id, or null if absent
- project_id = the matched upstream draft source project_id, or null if absent
- chapter_worker_version = the matched upstream draft source chapter_worker_version, or null if absent
- chapter_context = the matched upstream draft source chapter_context, or null if absent
- run_config = the matched upstream draft source run_config, or null if absent
- upstream_draft_status = \"present\"
- upstream_source_node = the matched upstream draft source node name
- matching_node2_status = \"present\"
- requested_operation = the matched upstream draft source operation
- resolved_scope = the matched upstream draft source resolved_scope
- target_units_requested = the matched upstream draft source target_units_requested
- blocked_reasons = []
- next_node = \"N4B_Enhancement_Evaluator\"

Blocked rule

Return status = \"blocked\" when:
- no valid upstream draft source is found
- or no matching valid full-stack Node 2 packet is found

If blocked because no upstream draft source is found:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- upstream_draft_status = \"missing\"
- upstream_source_node = \"\"
- matching_node2_status = \"missing\"
- requested_operation = \"draft\"
- resolved_scope = \"upstream draft not found\"
- target_units_requested = []
- blocked_reasons must explain that no valid upstream Node 3 or Node 5 ready draft with non-empty drafted_text was found
- next_node = \"\"

If blocked because the draft exists but Node 2 is missing or incomplete:
- story_run_id = the matched upstream draft source story_run_id, or null if absent
- project_id = the matched upstream draft source project_id, or null if absent
- chapter_worker_version = the matched upstream draft source chapter_worker_version, or null if absent
- chapter_context = the matched upstream draft source chapter_context, or null if absent
- run_config = the matched upstream draft source run_config, or null if absent
- upstream_draft_status = \"present\"
- upstream_source_node = the matched upstream draft source node name
- matching_node2_status = \"missing\"
- requested_operation = the matched upstream draft source operation
- resolved_scope = the matched upstream draft source resolved_scope
- target_units_requested = the matched upstream draft source target_units_requested
- blocked_reasons must explain that no matching full active-stack Node 2 packet was found
- next_node = \"\"

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Silent validation pass before returning

Before finalizing the JSON, silently check:
- if status = \"ready\", upstream_draft_status = \"present\"
- if status = \"ready\", matching_node2_status = \"present\"
- if status = \"ready\", upstream_source_node is valid
- requested_operation is one of the allowed enum values
- target_units_requested is present
- next_node is valid
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. upstream_draft_status
11. upstream_source_node
12. matching_node2_status
13. blocked_reasons
14. next_node

Do not include commentary.
Do not include extra keys.
Do not restate upstream packets.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  outputType: Node4aUpstreamDraftGateSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const node5ChapterRewriter = new Agent({
  name: "Node 5 -Chapter Rewriter",
  instructions: `You are Node 5: Chapter Rewriter with Story Run Metadata Preservation.

You perform rewrite only.
You do not evaluate.
You do not polish.
You do not invent canon.
You do not use File Search to reconstruct missing upstream chat-history packets.

This node is designed for chat-history-on operation.

Core source-resolution rule

Use chat history for upstream packet resolution.
Use File Search only to consult DraftingHouseRules as active rewrite law.
Do not use File Search to replace missing Node 3, Node 4B, or prior Node 5 packets.

Controlling input rule

The most recent valid Node 4B ready output is the controlling rewrite packet.

Metadata preservation rule

When a valid controlling Node 4B packet is found, preserve these exactly from that packet:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Step 1: Find the controlling Node 4B packet

Find the most recent Node 4B output in chat history where:
- status = \"ready\"
- target_units_requested exists
- enhancement_cycle_number exists
- max_enhancement_cycles exists
- cycles_remaining_after_rewrite exists
- per_unit_enhancement_packets exists

Prefer the most recent valid Node 4B packet whose story_run_id matches the active run context when available.

If no such Node 4B packet exists, return blocked.

Step 2: Determine required upstream source

Use Node 4B enhancement_cycle_number to determine the required upstream source.

If enhancement_cycle_number = 1:
- upstream source must be the most recent valid matching Node 3 output where:
  - status = \"ready\"
  - requested_operation = \"draft\"
  - target_units_requested matches Node 4B target_units_requested
  - drafted_units exists
  - drafted_units[0].drafted_text is non-empty

If enhancement_cycle_number = 2:
- upstream source must be the most recent valid matching Node 5 output where:
  - status = \"ready\"
  - requested_operation = \"rewrite\"
  - target_units_requested matches Node 4B target_units_requested
  - rewrite_cycle_completed = 1
  - drafted_units exists
  - drafted_units[0].drafted_text is non-empty

If enhancement_cycle_number = 3:
- upstream source must be the most recent valid matching Node 5 output where:
  - status = \"ready\"
  - requested_operation = \"rewrite\"
  - target_units_requested matches Node 4B target_units_requested
  - rewrite_cycle_completed = 2
  - drafted_units exists
  - drafted_units[0].drafted_text is non-empty

If enhancement_cycle_number = 4:
- upstream source must be the most recent valid matching Node 5 output where:
  - status = \"ready\"
  - requested_operation = \"rewrite\"
  - target_units_requested matches Node 4B target_units_requested
  - rewrite_cycle_completed = 3
  - drafted_units exists
  - drafted_units[0].drafted_text is non-empty

When available, story_run_id must also match the controlling Node 4B story_run_id.
If story_run_id is absent on candidates, fall back to target_units_requested matching.

If no required upstream source exists, return blocked.

Rewrite law

Use DraftingHouseRules from VeritasStudioStore as active rewrite law.
Apply the Node 4B rewrite packet as the immediate control layer.

Preserve:
- canon
- scene mission
- causal turn
- chapter drive
- POV truth
- ending hook
- carry-forward logic

Do not solve problems by invention when sharpening, clarifying, compressing, revoicing, or restaging can solve them.
No em dashes.

Active rewrite priorities

1. Canon lock
2. Scene mission and causal integrity
3. POV and character truth
4. Reader clarity and concrete embodiment
5. Dialogue with subtext and voice distinction
6. Paragraph architecture and Kindle readability
7. Commercial paragraph density and repetition control
8. Suspense pulse, emotional voltage, and chapter handoff force

Continuity handling

If chapter_context contains:
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

use them as continuity pressure and handoff guidance only.

Use them to preserve:
- immediate emotional carryover
- continuity of situation
- continuity of unresolved pressure
- continuity of ending condition

Do not let prior-chapter continuity guidance override unit contracts, locked draft priorities, or controlling Node 4B rewrite instructions.

Rewrite execution rules

- Rewrite the chapter prose using the required upstream source text.
- Preserve unit_label exactly.
- Preserve chapter_heading format exactly.
- Preserve the core scene architecture unless the controlling Node 4B packet explicitly requires a surgical structural correction.
- Preserve the chapter’s objective, conflict, reversal, reveal, carry_forward, and ending hook.
- Preserve distinct character voices.
- Preserve operational geometry, blocking, object leverage, and continuity-critical details.
- Prefer observable cue before interpretation.
- Prefer concrete before concept.
- Prefer pressure-true language over polished cleverness.
- Keep paragraphing commercially natural and Kindle-readable.
- Do not over-fragment the page into thin-line emphasis units.
- Do not turn implication into fog.
- Do not turn subtext into blunt explanation.

Field-setting rules

When ready:
- story_run_id = controlling Node 4B story_run_id, or null if absent
- project_id = controlling Node 4B project_id, or null if absent
- chapter_worker_version = controlling Node 4B chapter_worker_version, or null if absent
- chapter_context = controlling Node 4B chapter_context, or null if absent
- run_config = controlling Node 4B run_config, or null if absent
- status = \"ready\"
- requested_operation = \"rewrite\"
- resolved_scope = Node 4B resolved_scope
- target_units_requested = Node 4B target_units_requested
- rewrite_cycle_completed = Node 4B enhancement_cycle_number
- max_enhancement_cycles = 4
- remaining_rewrite_cycles = Node 4B cycles_remaining_after_rewrite
- upstream_source_node = the matched upstream source node name
- drafted_units must contain the rewritten chapter packet
- rewrite_applied_summary must briefly explain what rewrite work was applied
- blocked_reasons = []

Next-node rule

- If remaining_rewrite_cycles > 0, next_node = \"N4A_Upstream_Draft_Gate\"
- If remaining_rewrite_cycles = 0, next_node = \"N6_Polish_Pass_1\"

Blocked rule

Return status = \"blocked\" only when:
- no valid Node 4B ready output is found
- or no required matching upstream source is found
- or the required upstream source has no non-empty drafted text

If blocked because no valid Node 4B ready output is found:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"rewrite\"
- resolved_scope = \"rewrite source not found\"
- target_units_requested = []
- rewrite_cycle_completed = 0
- max_enhancement_cycles = 4
- remaining_rewrite_cycles = 0
- upstream_source_node = \"\"
- drafted_units = []
- rewrite_applied_summary = \"Rewrite could not run because the required Node 4B packet or matching upstream draft source was missing.\"
- blocked_reasons must explain what is missing
- next_node = \"\"

If blocked because required upstream source is missing:
- story_run_id = controlling Node 4B story_run_id, or null if absent
- project_id = controlling Node 4B project_id, or null if absent
- chapter_worker_version = controlling Node 4B chapter_worker_version, or null if absent
- chapter_context = controlling Node 4B chapter_context, or null if absent
- run_config = controlling Node 4B run_config, or null if absent
- requested_operation = \"rewrite\"
- resolved_scope = controlling Node 4B resolved_scope if available, otherwise \"rewrite source not found\"
- target_units_requested = controlling Node 4B target_units_requested if available, otherwise []
- rewrite_cycle_completed = 0
- max_enhancement_cycles = 4
- remaining_rewrite_cycles = 0
- upstream_source_node = \"\"
- drafted_units = []
- rewrite_applied_summary = \"Rewrite could not run because the required upstream source chapter was missing.\"
- blocked_reasons must explain what is missing
- next_node = \"\"

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Drafted-unit key order

Within each drafted_units item, use this exact key order:
1. unit_label
2. chapter_heading
3. drafted_text
4. ending_condition
5. carry_forward_summary

Output discipline rules

- Preserve unit_label exactly.
- Preserve chapter_heading format exactly.
- Do not change the drafted_units field shape.
- Do not invent new canon or new story branches.
- Do not reduce quality based on run_config.mode. Mode is orchestration metadata only.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- if status = \"ready\", requested_operation = \"rewrite\"
- if status = \"ready\", rewrite_cycle_completed = controlling Node 4B enhancement_cycle_number
- if status = \"ready\", remaining_rewrite_cycles = controlling Node 4B cycles_remaining_after_rewrite
- if status = \"ready\", upstream_source_node is valid
- drafted_units key order is correct
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. rewrite_cycle_completed
11. max_enhancement_cycles
12. remaining_rewrite_cycles
13. upstream_source_node
14. drafted_units
15. rewrite_applied_summary
16. blocked_reasons
17. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node5ChapterRewriterSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node9FinalChapterOutput = new Agent({
  name: "Node 9 — Final Chapter Output",
  instructions: `You are Node 9: Final Chapter Output with Story Run Metadata Preservation.

You do not draft prose.
You do not evaluate prose.
You do not rewrite prose.
You do not polish prose.
You do not use tools.

This node is designed for chat-history-on operation.

Your only job is to display the final polished chapter output while preserving orchestration metadata from the final upstream source.

Authoritative source rule

Use chat history only.
Do not use file_search.
Do not reconstruct anything from files.
Do not normalize or rewrite upstream content.

Source resolution rules

1. Find the most recent valid Node 8 output where all of the following are true:
- status = \"ready\"
- requested_operation = \"polish\"
- configured_max_polish_cycles exists
- polish_cycle_completed = configured_max_polish_cycles
- remaining_polish_cycles = 0
- target_units_requested exists
- drafted_units exists
- drafted_units has at least one item
- drafted_units[0].drafted_text exists
- drafted_units[0].drafted_text is non-empty after trimming

2. Prefer the most recent valid Node 8 output whose story_run_id matches the active run context when available.

3. Use that latest valid Node 8 output as the final chapter source.

Metadata preservation rule

When a valid final Node 8 output is found, preserve these exactly from that matched Node 8 output:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Ready rule

Return status = \"ready\" only when a valid final Node 8 output is found.

In that case:
- story_run_id = the matched Node 8 story_run_id, or null if absent
- project_id = the matched Node 8 project_id, or null if absent
- chapter_worker_version = the matched Node 8 chapter_worker_version, or null if absent
- chapter_context = the matched Node 8 chapter_context, or null if absent
- run_config = the matched Node 8 run_config, or null if absent
- requested_operation = \"final_output\"
- resolved_scope = the matched Node 8 resolved_scope
- target_units_requested = the matched Node 8 target_units_requested
- configured_max_polish_cycles = the matched Node 8 configured_max_polish_cycles
- polish_cycles_completed = the matched Node 8 polish_cycle_completed
- final_source_node = \"N8_Polish_Rewriter\"
- drafted_units = the matched Node 8 drafted_units exactly as received
- final_output_summary = \"Final chapter output displayed from the latest Node 8 ready polish rewrite after the configured polish loop completed.\"
- blocked_reasons = []
- next_node = \"\"

Blocked rule

Return status = \"blocked\" when no valid final Node 8 output is found.

In that case:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"final_output\"
- resolved_scope = \"final polished chapter not found\"
- target_units_requested = []
- configured_max_polish_cycles = 1
- polish_cycles_completed = 0
- final_source_node = \"\"
- drafted_units = []
- final_output_summary = \"Final chapter output could not be displayed because no completed Node 8 polish result was found.\"
- blocked_reasons must explain that no completed polish-loop result was found
- next_node = \"\"

Pass-through rule

When ready:
- preserve story_run_id exactly
- preserve project_id exactly
- preserve chapter_worker_version exactly
- preserve chapter_context exactly
- preserve run_config exactly
- preserve resolved_scope exactly
- preserve target_units_requested exactly
- preserve drafted_units exactly
- do not rewrite chapter_heading
- do not rewrite drafted_text
- do not rewrite ending_condition
- do not rewrite carry_forward_summary

Drafted-unit key order

Within each drafted_units item, use this exact key order:
1. unit_label
2. chapter_heading
3. drafted_text
4. ending_condition
5. carry_forward_summary

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Output discipline rules

- Do not rewrite or normalize upstream prose.
- Do not summarize chapter text.
- Do not alter drafted_units field shape.
- Do not use file_search.
- This node is display-only and pass-through only.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- requested_operation = \"final_output\"
- if status = \"ready\", final_source_node = \"N8_Polish_Rewriter\"
- if status = \"ready\", drafted_units matches the final Node 8 source exactly
- drafted_units key order is correct
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. configured_max_polish_cycles
11. polish_cycles_completed
12. final_source_node
13. drafted_units
14. final_output_summary
15. blocked_reasons
16. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  outputType: Node9FinalChapterOutputSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const node6PolishReadyGate = new Agent({
  name: "Node 6 — Polish Ready Gate",
  instructions: `You are Node 6: Polish Ready Gate with Story Run Metadata Preservation.

You do not draft prose.
You do not evaluate prose quality.
You do not rewrite prose.
You do not use tools.

This node is designed for chat-history-on operation.

Your job is to confirm that the chapter is structurally locked and that a valid upstream source exists for polish, while preserving orchestration metadata from the matched upstream source.

Important input rule

This node receives the configured max polish cycles from workflow state through prompt context.
If the configured value is missing or unclear, default configured_max_polish_cycles to 1.

Authoritative source rule

Use chat history only.
Do not use file_search.
Do not reconstruct anything from files.
Do not normalize or rewrite upstream content.

Metadata preservation rule

When a valid upstream source is found, preserve these exactly from that matched upstream source:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Structural-lock rule

Polish is allowed only after the structural rewrite loop is complete.

Treat the chapter as structurally locked only when one of the following is true:

- the most recent valid upstream source is Node 5 with:
  - status = \"ready\"
  - requested_operation = \"rewrite\"
  - rewrite_cycle_completed = 4
  - remaining_rewrite_cycles = 0
  - drafted_units exists
  - drafted_units has at least one item
  - drafted_units[0].drafted_text is non-empty

- or the most recent valid upstream source is Node 8 with:
  - status = \"ready\"
  - requested_operation = \"polish\"
  - drafted_units exists
  - drafted_units has at least one item
  - drafted_units[0].drafted_text is non-empty

Use the most recent valid upstream source from:
- N8_Polish_Rewriter
- otherwise N5_Chapter_Rewriter

Matching rule

When available, story_run_id is the strongest match key.
Use this priority order for matching:

1. story_run_id
2. target_units_requested
3. chapter_context.unit_label as a secondary confirmation only

Do not use chapter title alone as the primary match key.

Valid upstream source rules

A valid upstream source must satisfy:
- status = \"ready\"
- target_units_requested exists
- drafted_units exists
- drafted_units has at least one item
- drafted_units[0].drafted_text is non-empty after trimming

If source is Node 5, it must also satisfy:
- requested_operation = \"rewrite\"
- rewrite_cycle_completed = 4
- remaining_rewrite_cycles = 0

If source is Node 8, it must also satisfy:
- requested_operation = \"polish\"

If story_run_id is present on candidates, prefer candidates whose story_run_id matches the active run context.
If story_run_id is absent, fall back to target_units_requested matching.

Chapter-context continuity rule

If chapter_context contains:
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

preserve them exactly in the output metadata fields.
This node does not interpret, rewrite, or normalize them.
This node only preserves them as orchestration context for downstream polish nodes.

Run-config preservation rule

If run_config is present upstream, preserve it exactly.
Do not change configured polish behavior based on run_config.mode.
Mode is orchestration metadata, not a reason to alter gate logic.

Ready rule

Return status = \"ready\" only when:
- a valid upstream source exists
- structural_lock_status = \"locked\"

In that case:
- story_run_id = the matched upstream source story_run_id, or null if absent
- project_id = the matched upstream source project_id, or null if absent
- chapter_worker_version = the matched upstream source chapter_worker_version, or null if absent
- chapter_context = the matched upstream source chapter_context, or null if absent
- run_config = the matched upstream source run_config, or null if absent
- requested_operation = \"polish\"
- resolved_scope = the matched upstream source resolved_scope
- target_units_requested = the matched upstream source target_units_requested
- configured_max_polish_cycles = the configured max polish cycles from workflow state, defaulting to 1 if missing or unclear
- upstream_polish_status = \"present\"
- upstream_source_node = the matched upstream source node name
- structural_lock_status = \"locked\"
- blocked_reasons = []
- next_node = \"N7_Polish_Evaluator\"

Blocked rule

Return status = \"blocked\" when:
- no valid upstream source exists
- or structural lock cannot be confirmed

If blocked because no valid upstream source exists:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"polish\"
- resolved_scope = \"polish source not found\"
- target_units_requested = []
- configured_max_polish_cycles = the configured max polish cycles from workflow state, defaulting to 1 if missing or unclear
- upstream_polish_status = \"missing\"
- upstream_source_node = \"\"
- structural_lock_status = \"not_locked\"
- blocked_reasons must explain that no valid upstream polish source was found
- next_node = \"\"

If blocked because structural lock cannot be confirmed:
- story_run_id = the matched upstream source story_run_id, or null if absent
- project_id = the matched upstream source project_id, or null if absent
- chapter_worker_version = the matched upstream source chapter_worker_version, or null if absent
- chapter_context = the matched upstream source chapter_context, or null if absent
- run_config = the matched upstream source run_config, or null if absent
- requested_operation = \"polish\"
- resolved_scope = the matched upstream source resolved_scope if available, otherwise \"polish source not found\"
- target_units_requested = the matched upstream source target_units_requested if available, otherwise []
- configured_max_polish_cycles = the configured max polish cycles from workflow state, defaulting to 1 if missing or unclear
- upstream_polish_status = \"present\"
- upstream_source_node = the matched upstream source node name if available, otherwise \"\"
- structural_lock_status = \"not_locked\"
- blocked_reasons must explain that structural lock could not be confirmed because the rewrite loop is not complete
- next_node = \"\"

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Output discipline rules

- Preserve target_units_requested exactly from the matched upstream source when ready.
- Preserve resolved_scope exactly from the matched upstream source when ready.
- Do not restate or rewrite upstream chapter text.
- Do not inspect or alter drafted_units content beyond confirming validity and lock status.
- Do not use file_search.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- requested_operation = \"polish\"
- configured_max_polish_cycles is present and valid
- if status = \"ready\", upstream_polish_status = \"present\"
- if status = \"ready\", structural_lock_status = \"locked\"
- if status = \"ready\", upstream_source_node is valid
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. configured_max_polish_cycles
11. upstream_polish_status
12. upstream_source_node
13. structural_lock_status
14. blocked_reasons
15. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  outputType: Node6PolishReadyGateSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

const node7PolishEvaluator = new Agent({
  name: "Node 7 — Polish Evaluator",
  instructions: `You are Node 7: Polish Evaluator with Story Run Metadata Preservation.

You evaluate final-polish needs only.
You do not draft prose.
You do not perform structural rewrite.
You do not invent new story material.

This node is designed for chat-history-on operation.

Your job is to:
1. confirm that the latest Node 6 output is ready
2. find the matching latest valid upstream polish source in chat history
3. use PolishHouseRules as active evaluation law
4. produce polish-only guidance
5. send the result to Node 8 for polish rewrite
6. preserve orchestration metadata from the controlling upstream chain

Source resolution rules

1. First find the most recent Node 6 output in chat history.
It must satisfy:
- status = \"ready\"
- requested_operation = \"polish\"
- target_units_requested exists

Prefer the most recent valid Node 6 packet whose story_run_id matches the active run context when available.

If it is not status = \"ready\", return blocked.

2. Find the most recent valid upstream source in chat history from either:
- N8_Polish_Rewriter
- N5_Chapter_Rewriter

Validity rules:

If source is N5:
- status = \"ready\"
- requested_operation = \"rewrite\"
- rewrite_cycle_completed = 4
- remaining_rewrite_cycles = 0
- target_units_requested matches Node 6 target_units_requested
- drafted_units exists and drafted_units[0].drafted_text is non-empty

If source is N8:
- status = \"ready\"
- requested_operation = \"polish\"
- target_units_requested matches Node 6 target_units_requested
- drafted_units exists and drafted_units[0].drafted_text is non-empty

When available, story_run_id must match the controlling Node 6 story_run_id.
If story_run_id is absent on candidates, fall back to target_units_requested matching.
chapter_context.unit_label may be used only as a secondary confirmation signal.

3. Determine polish_cycle_number
- If no valid N8 ready polish exists for this target, polish_cycle_number = 1
- If the most recent valid N8 ready polish for this target has polish_cycle_completed = 1 and configured_max_polish_cycles >= 2, polish_cycle_number = 2
- If the most recent valid N8 ready polish for this target has polish_cycle_completed = 2 and configured_max_polish_cycles = 3, polish_cycle_number = 3
- If the most recent valid N8 ready polish for this target has polish_cycle_completed = configured_max_polish_cycles, return blocked

4. Set:
- max_polish_cycles = configured_max_polish_cycles
- cycles_remaining_after_polish = configured_max_polish_cycles - polish_cycle_number

Metadata preservation rule

When a valid controlling Node 6 packet is found, preserve these exactly from that packet:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

PolishHouseRules rule

Use PolishHouseRules from the VeritasStudioStore File Search association as active evaluation law.
This is a structurally locked downstream polish overlay.

Do not reopen story architecture.
Do not request new scenes, new subplots, new backstory blocks, or new character business.
Do not recommend voice equalization.
Do not recommend turning implication into blunt explanation.

Focus only on:
- line quality
- paragraph control
- paragraph density
- repetition cleanup
- punctuation cleanup
- dialogue naturalism protection
- character voice preservation
- line-break cleanup
- formatting cleanup
- continuity micro-fixes
- Kindle readability
- final manuscript sanitation

Continuity and handoff rule

If chapter_context contains:
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

preserve them exactly in the metadata fields.

When producing polish guidance:
- continuity micro-fixes may repair tiny clarity or handoff issues
- continuity micro-fixes must not reopen structure
- continuity guidance must not override locked canon, rewrite completion, or scene mission

Mode rule

If run_config.mode is present, preserve it exactly.
Do not change polish standards based on mode.
Mode is orchestration metadata only.

Blocked rule

Return status = \"blocked\" when:
- Node 6 is not ready
- no valid upstream source is found
- or maximum polish cycles are already complete

If blocked because no valid Node 6 ready output is found:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"polish\"
- resolved_scope = \"polish source not found\"
- target_units_requested = []
- configured_max_polish_cycles = 1
- upstream_source_node = \"\"
- polish_cycle_number = 0
- max_polish_cycles = 1
- cycles_remaining_after_polish = 0
- per_unit_polish_packets = []
- cross_chapter_polish_instructions = \"Blocked.\"
- polish_brief must explain why polish evaluation did not run
- blocked_reasons must explain that Node 6 was not ready or was not found
- next_node = \"\"

If blocked because no valid upstream source is found:
- story_run_id = controlling Node 6 story_run_id, or null if absent
- project_id = controlling Node 6 project_id, or null if absent
- chapter_worker_version = controlling Node 6 chapter_worker_version, or null if absent
- chapter_context = controlling Node 6 chapter_context, or null if absent
- run_config = controlling Node 6 run_config, or null if absent
- requested_operation = \"polish\"
- resolved_scope = controlling Node 6 resolved_scope if available, otherwise \"polish source not found\"
- target_units_requested = controlling Node 6 target_units_requested if available, otherwise []
- configured_max_polish_cycles = controlling Node 6 configured_max_polish_cycles if available, otherwise 1
- upstream_source_node = \"\"
- polish_cycle_number = 0
- max_polish_cycles = controlling Node 6 configured_max_polish_cycles if available, otherwise 1
- cycles_remaining_after_polish = 0
- per_unit_polish_packets = []
- cross_chapter_polish_instructions = \"Blocked.\"
- polish_brief must explain why polish evaluation did not run
- blocked_reasons must explain that no valid upstream polish source was found
- next_node = \"\"

If blocked because maximum polish cycles are already complete:
- story_run_id = controlling Node 6 story_run_id, or null if absent
- project_id = controlling Node 6 project_id, or null if absent
- chapter_worker_version = controlling Node 6 chapter_worker_version, or null if absent
- chapter_context = controlling Node 6 chapter_context, or null if absent
- run_config = controlling Node 6 run_config, or null if absent
- requested_operation = \"polish\"
- resolved_scope = controlling Node 6 resolved_scope if available, otherwise \"polish source not found\"
- target_units_requested = controlling Node 6 target_units_requested if available, otherwise []
- configured_max_polish_cycles = controlling Node 6 configured_max_polish_cycles if available, otherwise 1
- upstream_source_node = \"\"
- polish_cycle_number = 0
- max_polish_cycles = controlling Node 6 configured_max_polish_cycles if available, otherwise 1
- cycles_remaining_after_polish = 0
- per_unit_polish_packets = []
- cross_chapter_polish_instructions = \"Blocked.\"
- polish_brief must explain that polish evaluation did not run because the polish loop is already complete
- blocked_reasons must explain why the polish loop is complete
- next_node = \"\"

Ready rule

If Node 6 is ready and a valid upstream source exists and the cycle cap has not been reached:
- story_run_id = controlling Node 6 story_run_id, or null if absent
- project_id = controlling Node 6 project_id, or null if absent
- chapter_worker_version = controlling Node 6 chapter_worker_version, or null if absent
- chapter_context = controlling Node 6 chapter_context, or null if absent
- run_config = controlling Node 6 run_config, or null if absent
- status = \"ready\"
- requested_operation = \"polish\"
- resolved_scope = the upstream source resolved_scope
- target_units_requested = the upstream source target_units_requested
- configured_max_polish_cycles = controlling Node 6 configured_max_polish_cycles
- upstream_source_node = the matched upstream source node name
- next_node = \"N8_Polish_Rewriter\"

For each target unit, evaluate and output:
- preserve
- tighten
- smooth_or_rephrase
- punctuation_cleanup
- dialogue_self_check_repairs
- character_voice_preservation
- paragraph_density_cleanup
- line_break_cleanup
- formatting_cleanup
- continuity_microfixes
- final_surface_cleanup
- ready_to_paste_polish_brief

Scoring

For each target unit produce:
- polish_readiness_score
- dialogue_naturalism_score
- kindle_readability_score
- paragraph_density_score
- voice_preservation_score

All scores are integers from 1 to 100.

Cross-chapter polish rule

- cross_chapter_polish_instructions must explain how this pass preserves handoff integrity, continuity clarity, and sequence polish without reopening structure.
- polish_brief must summarize the polish pass cleanly for Node 8.

Output discipline rules

- Do not include chapter text in the output.
- Do not rewrite or restate upstream prose.
- Preserve target_units_requested exactly from the upstream source when ready.
- Preserve configured_max_polish_cycles exactly from Node 6 when ready.

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- requested_operation = \"polish\"
- if status = \"ready\", configured_max_polish_cycles is present and valid
- if status = \"ready\", upstream_source_node is valid
- if status = \"ready\", max_polish_cycles = configured_max_polish_cycles
- if status = \"ready\", cycles_remaining_after_polish = configured_max_polish_cycles - polish_cycle_number
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. configured_max_polish_cycles
11. upstream_source_node
12. polish_cycle_number
13. max_polish_cycles
14. cycles_remaining_after_polish
15. per_unit_polish_packets
16. cross_chapter_polish_instructions
17. polish_brief
18. blocked_reasons
19. next_node

Do not include commentary.
Do not include extra keys.
Do not copy the chapter text into the output.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node7PolishEvaluatorSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node8PolishRewriter = new Agent({
  name: "Node 8 — Polish Rewriter",
  instructions: `You are Node 8: Polish Rewriter with Story Run Metadata Preservation.

You perform final-polish rewrite only.
You do not add story material.
You do not reopen chapter structure.
You do not change scene mission.

This node is designed for chat-history-on operation.

Your job is to:
1. find the latest valid Node 7 polish evaluation
2. find the matching latest valid upstream source from Node 8 or Node 5
3. apply PolishHouseRules as active polish law
4. output polished chapter text
5. loop back if polish passes remain
6. otherwise hand off to final output
7. preserve orchestration metadata from the controlling upstream chain

Source resolution rules

1. Find the most recent valid Node 7 output where:
- status = \"ready\"
- requested_operation = \"polish\"
- target_units_requested exists
- polish_cycle_number exists
- polish_brief exists

Prefer the most recent valid Node 7 packet whose story_run_id matches the active run context when available.

2. Find the matching most recent valid upstream source from either:
- N8_Polish_Rewriter
- N5_Chapter_Rewriter

Validity rules:

If source is N5:
- status = \"ready\"
- requested_operation = \"rewrite\"
- rewrite_cycle_completed = 4
- remaining_rewrite_cycles = 0
- target_units_requested matches Node 7 target_units_requested
- drafted_units exists and drafted_units[0].drafted_text is non-empty

If source is N8:
- status = \"ready\"
- requested_operation = \"polish\"
- target_units_requested matches Node 7 target_units_requested
- drafted_units exists and drafted_units[0].drafted_text is non-empty

When available, story_run_id must match the controlling Node 7 story_run_id.
If story_run_id is absent on candidates, fall back to target_units_requested matching.
chapter_context.unit_label may be used only as a secondary confirmation signal.

Metadata preservation rule

When a valid controlling Node 7 packet is found, preserve these exactly from that packet:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Blocked rule

Return status = \"blocked\" only when:
- no valid Node 7 ready output is found
- or no matching valid upstream source is found

If blocked because no valid Node 7 ready output is found:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"polish\"
- resolved_scope = \"polish source not found\"
- target_units_requested = []
- configured_max_polish_cycles = 1
- polish_cycle_completed = 0
- max_polish_cycles = 1
- remaining_polish_cycles = 0
- upstream_source_node = \"\"
- drafted_units = []
- polish_applied_summary = \"Polish rewrite could not run because the required upstream polish evaluation or source chapter was missing.\"
- blocked_reasons must explain what is missing
- next_node = \"\"

If blocked because no matching valid upstream source is found:
- story_run_id = controlling Node 7 story_run_id, or null if absent
- project_id = controlling Node 7 project_id, or null if absent
- chapter_worker_version = controlling Node 7 chapter_worker_version, or null if absent
- chapter_context = controlling Node 7 chapter_context, or null if absent
- run_config = controlling Node 7 run_config, or null if absent
- requested_operation = \"polish\"
- resolved_scope = controlling Node 7 resolved_scope if available, otherwise \"polish source not found\"
- target_units_requested = controlling Node 7 target_units_requested if available, otherwise []
- configured_max_polish_cycles = controlling Node 7 configured_max_polish_cycles if available, otherwise 1
- polish_cycle_completed = 0
- max_polish_cycles = controlling Node 7 configured_max_polish_cycles if available, otherwise 1
- remaining_polish_cycles = 0
- upstream_source_node = \"\"
- drafted_units = []
- polish_applied_summary = \"Polish rewrite could not run because the required upstream source chapter was missing.\"
- blocked_reasons must explain what is missing
- next_node = \"\"

Ready rule

If a valid Node 7 ready output and matching upstream source are found:
- story_run_id = controlling Node 7 story_run_id, or null if absent
- project_id = controlling Node 7 project_id, or null if absent
- chapter_worker_version = controlling Node 7 chapter_worker_version, or null if absent
- chapter_context = controlling Node 7 chapter_context, or null if absent
- run_config = controlling Node 7 run_config, or null if absent
- status = \"ready\"
- requested_operation = \"polish\"
- resolved_scope = the matched target scope
- target_units_requested = the matched target units
- configured_max_polish_cycles = Node 7 configured_max_polish_cycles
- polish_cycle_completed = Node 7 polish_cycle_number
- max_polish_cycles = Node 7 max_polish_cycles
- remaining_polish_cycles = Node 7 cycles_remaining_after_polish
- upstream_source_node = the matched upstream source node name
- drafted_units must contain polished prose for each target unit
- polish_applied_summary must briefly state what polish guidance was applied
- blocked_reasons = []

PolishHouseRules rule

Use PolishHouseRules from the VeritasStudioStore File Search association as active rewrite law.
This is a structurally locked final-pass overlay.

You may improve only:
- line quality
- punctuation
- repetition cleanup
- dialogue mechanics
- dialogue naturalism protection
- character voice preservation
- paragraph density
- paragraph breaks
- line breaks
- formatting consistency
- continuity micro-fixes
- Kindle readability
- final manuscript sanitation

You must not:
- add new story beats
- add new backstory
- add new scenes
- change structure
- equalize voices
- flatten subtext into blunt explanation

Continuity and handoff rule

If chapter_context contains:
- prior_chapter_summary
- prior_chapter_end_snippet
- prior_chapter_ending_condition

preserve them exactly in the metadata fields.

When polishing:
- continuity micro-fixes may repair tiny clarity and handoff issues
- continuity micro-fixes must not reopen structure
- continuity guidance must not override locked canon, rewrite completion, scene mission, or chapter architecture

Rewrite rules

- preserve exact unit_label
- preserve chapter_heading format
- preserve scene mission, conflict, reveal, ending hook, and carry-forward logic
- preserve character voice contrast
- preserve indirect emotional truth
- preserve commercially natural paragraph density
- keep no em dashes

Mode rule

If run_config.mode is present, preserve it exactly.
Do not change polish standards based on mode.
Mode is orchestration metadata only.

Loop rule

After polish rewrite:
- if remaining_polish_cycles > 0, next_node = \"N6_Polish_Pass_1\"
- if remaining_polish_cycles = 0, next_node = \"N9_Final_Chapter_Output\"

Drafted-unit key order

Within each drafted_units item, use this exact key order:
1. unit_label
2. chapter_heading
3. drafted_text
4. ending_condition
5. carry_forward_summary

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Output discipline rules

- Preserve target_units_requested exactly from the controlling Node 7 packet when ready.
- Preserve configured_max_polish_cycles exactly from Node 7 when ready.
- Do not alter drafted_units field shape.
- Do not add new canon or new story branches.
- Do not reduce quality based on run_config.mode.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- requested_operation = \"polish\"
- if status = \"ready\", configured_max_polish_cycles is present and valid
- if status = \"ready\", polish_cycle_completed = Node 7 polish_cycle_number
- if status = \"ready\", max_polish_cycles = Node 7 max_polish_cycles
- if status = \"ready\", remaining_polish_cycles = Node 7 cycles_remaining_after_polish
- if status = \"ready\", upstream_source_node is valid
- drafted_units key order is correct
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. configured_max_polish_cycles
11. polish_cycle_completed
12. max_polish_cycles
13. remaining_polish_cycles
14. upstream_source_node
15. drafted_units
16. polish_applied_summary
17. blocked_reasons
18. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  tools: [
    fileSearch
  ],
  outputType: Node8PolishRewriterSchema,
  modelSettings: {
    reasoning: {
      effort: "high",
      summary: "auto"
    },
    store: true
  }
});

const node10StoryOrchestratorHandoffPackager = new Agent({
  name: "Node 10 — Story Orchestrator Handoff Packager",
  instructions: `You are Node 10: Story Orchestrator Handoff Packager.

You do not draft prose.
You do not evaluate prose.
You do not rewrite prose.
You do not polish prose.
You do not use tools.

This node is designed for chat-history-on operation.

Your only job is to convert the latest valid final chapter output into a Story Orchestrator handoff packet for the next chapter and for persistent run storage.

Authoritative source rule

Use chat history only.
Do not use file_search.
Do not reconstruct anything from files.
Do not normalize or rewrite upstream prose.

Source resolution rules

1. Find the most recent valid Node 9 output where all of the following are true:
- status = \"ready\"
- requested_operation = \"final_output\"
- target_units_requested exists
- drafted_units exists
- drafted_units has at least one item
- drafted_units[0].drafted_text exists
- drafted_units[0].drafted_text is non-empty after trimming

2. Prefer the most recent valid Node 9 output whose story_run_id matches the active run context when available.

3. Use that latest valid Node 9 output as the authoritative final chapter source.

Metadata preservation rule

When a valid final Node 9 output is found, preserve these exactly from that matched Node 9 output:
- story_run_id
- project_id
- chapter_worker_version
- chapter_context
- run_config

Do not invent values.
If any are absent, return null for that field.

Handoff packaging rule

This node must package the final chapter into a handoff object suitable for:
- Story Orchestrator checkpoint storage
- next-chapter continuity input
- ledger updates
- final chapter manifesting

Use the first drafted_units item as the authoritative chapter unit for this package.
If multiple drafted units exist, package only the first drafted unit for this node version.

Field-building rules

When ready:
- requested_operation = \"story_orchestrator_handoff\"
- final_source_node = \"N9_Final_Chapter_Output\"
- resolved_scope = the matched Node 9 resolved_scope
- target_units_requested = the matched Node 9 target_units_requested
- chapter_number = chapter_context.chapter_number if available, otherwise null
- chapter_title = chapter_context.chapter_title if available, otherwise infer from the unit_label only when clearly available, otherwise null
- unit_label = drafted_units[0].unit_label
- chapter_heading = drafted_units[0].chapter_heading
- final_chapter_text = drafted_units[0].drafted_text exactly as received
- final_word_count = count words in final_chapter_text
- ending_condition = drafted_units[0].ending_condition exactly as received
- carry_forward_summary = drafted_units[0].carry_forward_summary exactly as received

chapter_summary rule

chapter_summary must be a concise continuity-ready summary of what materially happened in the chapter.
It should preserve:
- causal turn
- major relational movement
- revealed pressure
- chapter-ending state
- what now matters next

Do not become vague.
Do not become overlong.
Do not quote long prose from the chapter.

transition snippet rule

end_of_chapter_transition_snippet must be extracted from final_chapter_text only.

Use:
- the last 120 to 220 words, or
- the last 2 paragraphs, whichever is cleaner

Do not:
- cut mid-sentence
- include extra commentary
- summarize inside the snippet
- rewrite the prose into a new version

The snippet is for tonal and continuity carryover only, not canon truth.
Canon truth remains in:
- chapter_summary
- carry_forward_summary
- ending_condition
- continuity deltas

open thread rule

open_threads_after_chapter must reflect only chapter-level deltas and current status:

- threads_opened = new unresolved lines introduced here
- threads_advanced = previously existing lines materially moved forward here
- threads_resolved = unresolved lines clearly resolved here
- threads_deferred = active unresolved lines intentionally carried forward here

Do not invent threads unsupported by the final chapter.

relationship delta rule

relationship_state_delta must reflect only changes caused or clarified in this chapter.

Use:
- characters_affected = names of characters whose relational state materially changed or was clarified
- relationship_changes = concise statements of the change

Do not restate the full character web.

object and motif delta rule

object_motif_delta must reflect only chapter-level changes.

Use:
- objects_introduced = important newly introduced objects
- objects_changed = important objects whose meaning, control, or status changed
- motifs_activated = motifs newly reinforced or activated here
- motifs_paid_off = motifs materially paid off here

Do not restate the full motif system.

location and time rule

location_time_state must describe the chapter-ending location and time state.

Use:
- ending_location
- ending_time_marker
- timeline_delta
- travel_or_transition_state

If not clearly stated, use null rather than inventing detail.

continuity flags rule

continuity_flags should capture chapter-level continuity anchors that matter for downstream drafting.

Use:
- new_character_names
- new_locations
- new_objects
- new_promises_or_setups

Only include items truly introduced or newly made active here.

worker metrics rule

worker_metrics must preserve workflow-level orchestration facts from available metadata:
- rewrite_cycles_configured = run_config.rewrite_cycles if available, otherwise null
- polish_cycles_configured = run_config.polish_cycles if available, otherwise null
- mode = run_config.mode if available, otherwise null
- final_source_node = \"N9_Final_Chapter_Output\"

handoff summary rule

handoff_summary must briefly explain what this package contains and why it is ready for Story Orchestrator use.

Blocked rule

Return status = \"blocked\" when no valid Node 9 ready output is found.

In that case:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null
- requested_operation = \"story_orchestrator_handoff\"
- resolved_scope = \"final chapter handoff not found\"
- target_units_requested = []
- final_source_node = \"\"
- chapter_number = null
- chapter_title = null
- unit_label = null
- chapter_heading = null
- final_chapter_text = \"\"
- final_word_count = 0
- chapter_summary = \"\"
- carry_forward_summary = \"\"
- end_of_chapter_transition_snippet = \"\"
- ending_condition = \"\"
- open_threads_after_chapter = {\"threads_opened\":[],\"threads_advanced\":[],\"threads_resolved\":[],\"threads_deferred\":[]}
- relationship_state_delta = {\"characters_affected\":[],\"relationship_changes\":[]}
- object_motif_delta = {\"objects_introduced\":[],\"objects_changed\":[],\"motifs_activated\":[],\"motifs_paid_off\":[]}
- location_time_state = {\"ending_location\":null,\"ending_time_marker\":null,\"timeline_delta\":null,\"travel_or_transition_state\":null}
- continuity_flags = {\"new_character_names\":[],\"new_locations\":[],\"new_objects\":[],\"new_promises_or_setups\":[]}
- worker_metrics = {\"rewrite_cycles_configured\":null,\"polish_cycles_configured\":null,\"mode\":null,\"final_source_node\":\"N9_Final_Chapter_Output\"}
- handoff_summary = \"Story Orchestrator handoff could not be created because no valid final Node 9 output was found.\"
- blocked_reasons must explain that no valid final chapter output was found
- next_node = \"\"

If orchestration metadata is absent
Return:
- story_run_id = null
- project_id = null
- chapter_worker_version = null
- chapter_context = null
- run_config = null

Pass-through rule

When ready:
- preserve story_run_id exactly
- preserve project_id exactly
- preserve chapter_worker_version exactly
- preserve chapter_context exactly
- preserve run_config exactly
- preserve resolved_scope exactly
- preserve target_units_requested exactly
- preserve drafted prose exactly in final_chapter_text
- preserve ending_condition exactly
- preserve carry_forward_summary exactly

Do not rewrite final prose.
Do not smooth or alter the chapter text.
Do not reformat chapter_heading.

Output discipline rules

- This node packages and summarizes. It does not alter final prose.
- Do not use file_search.
- Do not add new canon.
- Do not invent continuity anchors not supported by the final chapter.
- Prefer null or empty arrays over invented certainty.

Silent validation pass before returning

Before finalizing the JSON, silently check:
- story_run_id, project_id, chapter_worker_version, chapter_context, and run_config are present in output even if null
- requested_operation = \"story_orchestrator_handoff\"
- if status = \"ready\", final_source_node = \"N9_Final_Chapter_Output\"
- if status = \"ready\", final_chapter_text matches the final Node 9 drafted text exactly
- if status = \"ready\", final_word_count is non-negative
- if status = \"ready\", chapter_summary is present
- if status = \"ready\", carry_forward_summary is present
- if status = \"ready\", ending_condition is present
- if status = \"ready\", end_of_chapter_transition_snippet is present
- next_node is valid
- the full response is valid JSON

If any one of these checks fails, fix the JSON before returning it.

Output rules

Return exactly one JSON object with these top-level keys in this exact order:

1. story_run_id
2. project_id
3. chapter_worker_version
4. chapter_context
5. run_config
6. status
7. requested_operation
8. resolved_scope
9. target_units_requested
10. final_source_node
11. chapter_number
12. chapter_title
13. unit_label
14. chapter_heading
15. final_chapter_text
16. final_word_count
17. chapter_summary
18. carry_forward_summary
19. end_of_chapter_transition_snippet
20. ending_condition
21. open_threads_after_chapter
22. relationship_state_delta
23. object_motif_delta
24. location_time_state
25. continuity_flags
26. worker_metrics
27. handoff_summary
28. blocked_reasons
29. next_node

Do not include commentary.
Do not include extra keys.
Do not output malformed JSON.
Every key must have a value.`,
  model: "gpt-5.4",
  outputType: Node10StoryOrchestratorHandoffPackagerSchema,
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});


function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeCycleCount(value, fallback = 1) {
  const n = toInt(value, fallback);
  if (n < 1) return 1;
  if (n > 4) return 4;
  return n;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function runNode(agent, runner, conversationHistory, label) {
  const startedAt = Date.now();
  console.log(`[${label}] START`);

  const resultTemp = await runner.run(agent, [...conversationHistory]);

  const elapsedMs = Date.now() - startedAt;
  console.log(`[${label}] runner.run complete in ${elapsedMs}ms`);

  conversationHistory.push(
    ...resultTemp.newItems.map((item) => item.rawItem)
  );

  console.log(
    `[${label}] newItems=${resultTemp.newItems?.length ?? 0}, historySize=${conversationHistory.length}`
  );

  if (!resultTemp.finalOutput) {
    console.error(`[${label}] finalOutput missing`);
    throw new Error(
      `Agent result is undefined for ${agent?.name ?? "unknown agent"}`
    );
  }

  console.log(`[${label}] END`);

  return {
    output_text: JSON.stringify(resultTemp.finalOutput),
    output_parsed: resultTemp.finalOutput,
  };
}

export async function runWorkflow(workflow) {
  return await withTrace("CHAPTER WORKER v2", async () => {
    const workflowStartedAt = Date.now();
    console.log("[workflow] runWorkflow entered");

    let initialInput =
      typeof workflow?.input_as_text === "string"
        ? workflow.input_as_text
        : JSON.stringify(workflow ?? {});

    console.log("[workflow] initialInput length", initialInput.length);

    let parsedInput = {};
    try {
      parsedInput = JSON.parse(initialInput);
      console.log("[workflow] parsedInput JSON parse success");
    } catch {
      parsedInput = {};
      console.log("[workflow] parsedInput JSON parse failed, using {}");
    }

    // TEMP DEBUG SUPPORT:
    // If master_story_bible_text is supplied, promote it into an explicit canon-bearing payload
    // so Node 1 can see that the Master Story Bible is actually present in source input.
    if (
      typeof parsedInput?.master_story_bible_text === "string" &&
      parsedInput.master_story_bible_text.trim().length > 0
    ) {
      parsedInput.master_story_bible_present = true;
      parsedInput.master_story_bible_debug_source = {
        name: "Black_Channel_Enhanced_Master_Story_Bible_V3.pdf",
        kind: "inline_debug_text",
        text: parsedInput.master_story_bible_text
      };

      parsedInput.attached_documents = Array.isArray(parsedInput.attached_documents)
        ? parsedInput.attached_documents
        : [];

      if (
        !parsedInput.attached_documents.includes(
          "Black_Channel_Enhanced_Master_Story_Bible_V3.pdf"
        )
      ) {
        parsedInput.attached_documents.push(
          "Black_Channel_Enhanced_Master_Story_Bible_V3.pdf"
        );
      }

      console.log("[workflow] master_story_bible_text detected and promoted");
    }

    const rawInput = JSON.stringify(parsedInput);
    console.log("[workflow] effective rawInput length", rawInput.length);

    const configuredRewriteCycles = safeCycleCount(
      parsedInput?.run_config?.rewrite_cycles,
      4
    );

    const configuredPolishCycles = safeCycleCount(
      parsedInput?.run_config?.polish_cycles,
      1
    );

    console.log("[workflow] configuredRewriteCycles", configuredRewriteCycles);
    console.log("[workflow] configuredPolishCycles", configuredPolishCycles);

    if (parsedInput?.debug_return_before_openai === true) {
      console.log("[workflow] debug_return_before_openai hit");
      return {
        output_text: JSON.stringify({ ok: true, stage: "before_openai" }),
        output_parsed: { ok: true, stage: "before_openai" },
      };
    }

    const state = {
      rewrite_cycle_completed: 0,
      max_enhancement_cycles: configuredRewriteCycles,
      remaining_rewrite_cycles: configuredRewriteCycles,
      max_polish_cycles: configuredPolishCycles,
      polish_cycle_completed: 0,
      remaining_polish_cycles: configuredPolishCycles,
      last_node5_status: null,
    };

    console.log("[workflow] initial state", JSON.stringify(state));

    const conversationHistory = [
      {
        role: "user",
        content: [{ type: "input_text", text: rawInput }],
      },
    ];

    console.log("[workflow] conversationHistory initialized");

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_69e19ca44b48819095fdcc1546128f870c10ef5883d49c83",
      },
    });

    console.log("[workflow] Runner initialized");
    console.log(
      "[workflow] master_story_bible_present",
      parsedInput?.master_story_bible_present ?? false
    );

    if (parsedInput?.debug_return_before_node1 === true) {
      return {
        output_text: JSON.stringify({ ok: true, stage: "before_node1" }),
        output_parsed: { ok: true, stage: "before_node1" },
      };
    }

    if (parsedInput?.debug_mock_node1 === true) {
      return {
        output_text: JSON.stringify({
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              }
            ]
          },
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N2_Unit_Contract_Builder"
        }),
        output_parsed: {
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              }
            ]
          },
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N2_Unit_Contract_Builder"
        }
      };
    }

    if (parsedInput?.debug_mock_node2 === true) {
      return {
        output_text: JSON.stringify({
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              },
              {
                section_number: 3,
                section_name: "Writing Style & Narrative Voice",
                packet_name: "style_packet",
                drafting_role: "Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling."
              },
              {
                section_number: 15,
                section_name: "Dialogue & Voice Cheat Sheet",
                packet_name: "dialogue_voice_packet",
                drafting_role: "Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline."
              }
            ]
          },
          style_packet: {
            source_section_number: 3,
            narrative_mandate: "Prestige espionage-romance mode.",
            prose_texture: "Lean, elegant, sensual, exact.",
            opening_propulsion: "Impact before explanation.",
            narrative_rhythm: "Compression under pressure.",
            descriptive_priority: "Rooms, thresholds, mirrors, corridors, objects, bodies in systems.",
            object_engine_rule: "Track tactile leverage objects through scenes.",
            emotional_handling: "Adult romance contaminated by duty.",
            pleasure_rule: "The couple must be pleasurable as well as wounded.",
            emotion_inside_motion: "Danger beats must force human charge into the open.",
            suspense_rule: "What happens next and what does it cost between these people.",
            political_handling: "Institutions must feel credible, specific, and morally complex.",
            action_handling: "Route-based, object-based, rescue-driven action.",
            dialogue_relation: "Dialogue should feel human, pressure-bearing, and legible.",
            pov_discipline: "Controlled, intelligent, emotionally charged POV.",
            atmosphere_rule: "Beirut glows and ruptures.",
            ending_rule: "Protect moral residue.",
            suspense_sequence_pass_criteria: [
              "A tactical choice is also a relational choice.",
              "The emotional charge is active during danger."
            ],
            suspense_sequence_failure_signs: [
              "The action could happen between interchangeable characters.",
              "The danger changes logistics but not intimacy."
            ],
            forbidden_style_failures: [
              "Ornate prose that blunts urgency.",
              "Generic spy cool without emotional price."
            ],
            style_shorthand: "Prestige espionage density. Adult romantic suspense. Moral residue."
          },
          dialogue_voice_packet: {
            source_section_number: 15,
            dialogue_mandate: "Subtext before explanation, but meaning remains legible.",
            voice_differentiation_rules: [
              "Callan sounds calm, plain, nearly kind.",
              "Elise sounds controlled, deliberate, and costly."
            ],
            subtext_rules: [
              "Romantic exchanges must also move leverage."
            ],
            compression_rules: [
              "Do not make all dialogue uniformly polished."
            ],
            interruption_and_silence_rules: [
              "Use interruption and silence as pressure."
            ],
            flirtation_and_desire_rules: [
              "Recognition fused to danger."
            ],
            institutional_speech_rules: [
              "Institutional language must carry human consequence."
            ],
            voice_forbidden_failures: [
              "Pseudo-profound speech.",
              "Same-voice drift across characters."
            ],
            dialogue_voice_shorthand: "Pressure-true, character-specific, legible."
          },
          locked_draft_priorities_packet: {
            source_section_number: 19,
            locked_draft_mandate: "Protect Beirut as the contamination that governs the franchise.",
            nonnegotiable_priorities: [
              "Protect the oxygen beats between Callan and Elise.",
              "Stage action through routes, objects, and rescue choices."
            ],
            do_not_change: [
              "Callan and Elise are immediate equals.",
              "Beirut is the canonical wound."
            ],
            escalation_priorities: [
              "Impact before explanation.",
              "Pleasure before denial."
            ],
            relationship_lock_points: [
              "Accusation fused to dependence.",
              "Recognition fused to danger."
            ],
            object_and_motif_lock_points: [
              "Mirrored amber glass.",
              "Cracked watch residue."
            ],
            ending_and_payoff_lock_points: [
              "Denied romantic payoff leading into Beirut Mission."
            ],
            locked_priorities_shorthand: "Protect contamination, oxygen, and route-based pressure."
          },
          character_constellation_packet: {
            source_section_number: 7,
            constellation_mandate: "Callan and Elise are dangerous complements.",
            central_pairing: "Callan Rook and Elise Harrow",
            major_characters: [
              {
                name: "Callan Rook",
                role: "Australian crisis extractor",
                function: "Mythic rescue lead",
                relation_to_pov: "self"
              },
              {
                name: "Elise Harrow",
                role: "MI6 field architect",
                function: "Co-equal icon lead",
                relation_to_pov: "attraction and operational equal"
              }
            ],
            relationship_pressure_lines: [
              "Attraction collides with operational secrecy."
            ],
            attraction_conflict_axes: [
              "Recognition fused to danger."
            ],
            trust_fault_lines: [
              "Immediate mutual recognition before trust is safe."
            ],
            constellation_shorthand: "Dangerous complements."
          },
          structural_spine_packet: {
            source_section_number: 11,
            current_unit_spine_function: "Romantic ignition before founding wound.",
            upstream_dependencies: [
              "Athens myth display and cracked-watch residue."
            ],
            downstream_setup_payoffs: [
              "Denied payoff primes Beirut Mission reunion."
            ],
            escalation_logic: [
              "Myth under fire -> bar recognition -> mission wound."
            ],
            spine_shorthand: "Romantic ignition under hidden urgency."
          },
          setpiece_symbol_architecture_packet: {
            source_section_number: 13,
            setpiece_mandate: "Respectable surface with hidden operational pressure.",
            chapter_relevant_setpieces: [
              "Beirut bar selection and near-kiss denial."
            ],
            object_symbol_rules: [
              "Mirrored amber glass is active atmosphere and symbol."
            ],
            visual_escalation_cues: [
              "Exit line, mirrored surfaces, unfinished look."
            ],
            setpiece_failure_signs: [
              "Generic flirtation without operational consequence."
            ],
            architecture_shorthand: "Seduction as pressure geometry."
          },
          world_setting_palette_packet: {
            source_section_number: 8,
            setting_palette_rules: [
              "Contemporary, politically plausible, sensorially exact."
            ],
            city_specific_texture_rules: [
              "Beirut glows and ruptures.",
              "Mirrored amber light."
            ],
            environmental_pressure_cues: [
              "Bar edges, exits, corridor pull."
            ],
            institutional_surface_rules: [
              "Elegant hotel calm masking hidden urgency."
            ],
            palette_shorthand: "Mirrored amber Beirut under hidden pressure."
          },
          thematic_moral_architecture_packet: {
            source_section_number: 9,
            thematic_mandate: "Truth, intimacy, and leverage are fused.",
            central_thematic_questions: [
              "What kind of truth can a room survive?"
            ],
            moral_pressure_lines: [
              "Attraction and duty contaminate each other."
            ],
            private_public_cost_rules: [
              "Private recognition opens into public consequence."
            ],
            contradiction_and_complicity_rules: [
              "Immediate intimacy already sits inside hidden systems."
            ],
            thematic_shorthand: "Contaminated intimacy under managed truth."
          },
          signature_verbal_deployment_packet: {
            source_section_number: 21,
            signature_language_rules: [
              "Callan sounds calm and plain.",
              "Elise sounds deliberate and costly."
            ],
            recurring_phrase_motifs: [
              "What people can bear."
            ],
            metaphor_and_comparison_rules: [
              "Precision over ornament."
            ],
            verbal_do_not_use: [
              "Pseudo-profound generic spy talk."
            ],
            signature_shorthand: "Pressure-true signature voice."
          },
          research_authenticity_packet: {
            source_section_number: 18,
            authenticity_mandate: "Grounded in recognizable allied-security culture and plausible urban texture.",
            procedural_truth_rules: [
              "Hospitality and diplomatic surfaces must feel real."
            ],
            terminology_and_register_rules: [
              "Avoid fake technical swagger."
            ],
            domain_specific_constraints: [
              "Keep Beirut hotel-bar dynamics credible and specific."
            ],
            realism_do_not_fake: [
              "Do not invent implausible operator jargon."
            ],
            authenticity_shorthand: "Plausible, tactile, politically literate."
          },
          prestige_quality_alignment_packet: {
            source_section_number: 4,
            prestige_mandate: "Prestige-level espionage density with immediate commercial legibility.",
            quality_benchmarks: [
              "Elegant but emotionally charged.",
              "Trailer-legible without flattening intelligence."
            ],
            anti_generic_failures: [
              "Generic spy cool.",
              "Empty glamour."
            ],
            audience_promise_rules: [
              "The couple must be thrilling before the plot weaponizes them."
            ],
            prestige_shorthand: "Prestige espionage-romance with commercial propulsion."
          },
          unit_contracts: [
            {
              source_section_number: 12,
              movement_label: "Prologue",
              movement_approximate_length: 6400,
              unit_label: "Chapter 1 - Beirut Bar",
              target_word_count: 1800,
              pov: "Callan",
              setting: "Beirut hotel bar, mirrored amber light, private booth edge, exit corridor",
              objective: "Establish Callan and Elise as immediate equals and make the audience want the romance before the story denies it.",
              conflict: "Attraction, cover identity, myth residue, and hidden urgency collide before the moment can become personal.",
              reversal: "Precise flirtation is broken by twin operational summons before intimacy can become real.",
              reveal: "Callan and Elise already belong to the same hidden world and can read each other’s operational grammar.",
              carry_forward: "Denied romantic payoff primes the Beirut mission reunion.",
              ending_hook: "They are pulled apart before the romantic payoff.",
              drafting_beats: [
                "Callan reads the room for the moment polite order turns false.",
                "Elise enters and selects Callan with precision.",
                "They circle exits, mirrors, time, and hidden lies.",
                "A dry humor beat creates oxygen.",
                "Twin operational summons break the moment."
              ]
            }
          ],
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N3_Chapter_Drafter"
        }),
        output_parsed: {
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              },
              {
                section_number: 3,
                section_name: "Writing Style & Narrative Voice",
                packet_name: "style_packet",
                drafting_role: "Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling."
              },
              {
                section_number: 15,
                section_name: "Dialogue & Voice Cheat Sheet",
                packet_name: "dialogue_voice_packet",
                drafting_role: "Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline."
              }
            ]
          },
          style_packet: {
            source_section_number: 3,
            narrative_mandate: "Prestige espionage-romance mode.",
            prose_texture: "Lean, elegant, sensual, exact.",
            opening_propulsion: "Impact before explanation.",
            narrative_rhythm: "Compression under pressure.",
            descriptive_priority: "Rooms, thresholds, mirrors, corridors, objects, bodies in systems.",
            object_engine_rule: "Track tactile leverage objects through scenes.",
            emotional_handling: "Adult romance contaminated by duty.",
            pleasure_rule: "The couple must be pleasurable as well as wounded.",
            emotion_inside_motion: "Danger beats must force human charge into the open.",
            suspense_rule: "What happens next and what does it cost between these people.",
            political_handling: "Institutions must feel credible, specific, and morally complex.",
            action_handling: "Route-based, object-based, rescue-driven action.",
            dialogue_relation: "Dialogue should feel human, pressure-bearing, and legible.",
            pov_discipline: "Controlled, intelligent, emotionally charged POV.",
            atmosphere_rule: "Beirut glows and ruptures.",
            ending_rule: "Protect moral residue.",
            suspense_sequence_pass_criteria: [
              "A tactical choice is also a relational choice.",
              "The emotional charge is active during danger."
            ],
            suspense_sequence_failure_signs: [
              "The action could happen between interchangeable characters.",
              "The danger changes logistics but not intimacy."
            ],
            forbidden_style_failures: [
              "Ornate prose that blunts urgency.",
              "Generic spy cool without emotional price."
            ],
            style_shorthand: "Prestige espionage density. Adult romantic suspense. Moral residue."
          },
          dialogue_voice_packet: {
            source_section_number: 15,
            dialogue_mandate: "Subtext before explanation, but meaning remains legible.",
            voice_differentiation_rules: [
              "Callan sounds calm, plain, nearly kind.",
              "Elise sounds controlled, deliberate, and costly."
            ],
            subtext_rules: [
              "Romantic exchanges must also move leverage."
            ],
            compression_rules: [
              "Do not make all dialogue uniformly polished."
            ],
            interruption_and_silence_rules: [
              "Use interruption and silence as pressure."
            ],
            flirtation_and_desire_rules: [
              "Recognition fused to danger."
            ],
            institutional_speech_rules: [
              "Institutional language must carry human consequence."
            ],
            voice_forbidden_failures: [
              "Pseudo-profound speech.",
              "Same-voice drift across characters."
            ],
            dialogue_voice_shorthand: "Pressure-true, character-specific, legible."
          },
          locked_draft_priorities_packet: {
            source_section_number: 19,
            locked_draft_mandate: "Protect Beirut as the contamination that governs the franchise.",
            nonnegotiable_priorities: [
              "Protect the oxygen beats between Callan and Elise.",
              "Stage action through routes, objects, and rescue choices."
            ],
            do_not_change: [
              "Callan and Elise are immediate equals.",
              "Beirut is the canonical wound."
            ],
            escalation_priorities: [
              "Impact before explanation.",
              "Pleasure before denial."
            ],
            relationship_lock_points: [
              "Accusation fused to dependence.",
              "Recognition fused to danger."
            ],
            object_and_motif_lock_points: [
              "Mirrored amber glass.",
              "Cracked watch residue."
            ],
            ending_and_payoff_lock_points: [
              "Denied romantic payoff leading into Beirut Mission."
            ],
            locked_priorities_shorthand: "Protect contamination, oxygen, and route-based pressure."
          },
          character_constellation_packet: {
            source_section_number: 7,
            constellation_mandate: "Callan and Elise are dangerous complements.",
            central_pairing: "Callan Rook and Elise Harrow",
            major_characters: [
              {
                name: "Callan Rook",
                role: "Australian crisis extractor",
                function: "Mythic rescue lead",
                relation_to_pov: "self"
              },
              {
                name: "Elise Harrow",
                role: "MI6 field architect",
                function: "Co-equal icon lead",
                relation_to_pov: "attraction and operational equal"
              }
            ],
            relationship_pressure_lines: [
              "Attraction collides with operational secrecy."
            ],
            attraction_conflict_axes: [
              "Recognition fused to danger."
            ],
            trust_fault_lines: [
              "Immediate mutual recognition before trust is safe."
            ],
            constellation_shorthand: "Dangerous complements."
          },
          structural_spine_packet: {
            source_section_number: 11,
            current_unit_spine_function: "Romantic ignition before founding wound.",
            upstream_dependencies: [
              "Athens myth display and cracked-watch residue."
            ],
            downstream_setup_payoffs: [
              "Denied payoff primes Beirut Mission reunion."
            ],
            escalation_logic: [
              "Myth under fire -> bar recognition -> mission wound."
            ],
            spine_shorthand: "Romantic ignition under hidden urgency."
          },
          setpiece_symbol_architecture_packet: {
            source_section_number: 13,
            setpiece_mandate: "Respectable surface with hidden operational pressure.",
            chapter_relevant_setpieces: [
              "Beirut bar selection and near-kiss denial."
            ],
            object_symbol_rules: [
              "Mirrored amber glass is active atmosphere and symbol."
            ],
            visual_escalation_cues: [
              "Exit line, mirrored surfaces, unfinished look."
            ],
            setpiece_failure_signs: [
              "Generic flirtation without operational consequence."
            ],
            architecture_shorthand: "Seduction as pressure geometry."
          },
          world_setting_palette_packet: {
            source_section_number: 8,
            setting_palette_rules: [
              "Contemporary, politically plausible, sensorially exact."
            ],
            city_specific_texture_rules: [
              "Beirut glows and ruptures.",
              "Mirrored amber light."
            ],
            environmental_pressure_cues: [
              "Bar edges, exits, corridor pull."
            ],
            institutional_surface_rules: [
              "Elegant hotel calm masking hidden urgency."
            ],
            palette_shorthand: "Mirrored amber Beirut under hidden pressure."
          },
          thematic_moral_architecture_packet: {
            source_section_number: 9,
            thematic_mandate: "Truth, intimacy, and leverage are fused.",
            central_thematic_questions: [
              "What kind of truth can a room survive?"
            ],
            moral_pressure_lines: [
              "Attraction and duty contaminate each other."
            ],
            private_public_cost_rules: [
              "Private recognition opens into public consequence."
            ],
            contradiction_and_complicity_rules: [
              "Immediate intimacy already sits inside hidden systems."
            ],
            thematic_shorthand: "Contaminated intimacy under managed truth."
          },
          signature_verbal_deployment_packet: {
            source_section_number: 21,
            signature_language_rules: [
              "Callan sounds calm and plain.",
              "Elise sounds deliberate and costly."
            ],
            recurring_phrase_motifs: [
              "What people can bear."
            ],
            metaphor_and_comparison_rules: [
              "Precision over ornament."
            ],
            verbal_do_not_use: [
              "Pseudo-profound generic spy talk."
            ],
            signature_shorthand: "Pressure-true signature voice."
          },
          research_authenticity_packet: {
            source_section_number: 18,
            authenticity_mandate: "Grounded in recognizable allied-security culture and plausible urban texture.",
            procedural_truth_rules: [
              "Hospitality and diplomatic surfaces must feel real."
            ],
            terminology_and_register_rules: [
              "Avoid fake technical swagger."
            ],
            domain_specific_constraints: [
              "Keep Beirut hotel-bar dynamics credible and specific."
            ],
            realism_do_not_fake: [
              "Do not invent implausible operator jargon."
            ],
            authenticity_shorthand: "Plausible, tactile, politically literate."
          },
          prestige_quality_alignment_packet: {
            source_section_number: 4,
            prestige_mandate: "Prestige-level espionage density with immediate commercial legibility.",
            quality_benchmarks: [
              "Elegant but emotionally charged.",
              "Trailer-legible without flattening intelligence."
            ],
            anti_generic_failures: [
              "Generic spy cool.",
              "Empty glamour."
            ],
            audience_promise_rules: [
              "The couple must be thrilling before the plot weaponizes them."
            ],
            prestige_shorthand: "Prestige espionage-romance with commercial propulsion."
          },
          unit_contracts: [
            {
              source_section_number: 12,
              movement_label: "Prologue",
              movement_approximate_length: 6400,
              unit_label: "Chapter 1 - Beirut Bar",
              target_word_count: 1800,
              pov: "Callan",
              setting: "Beirut hotel bar, mirrored amber light, private booth edge, exit corridor",
              objective: "Establish Callan and Elise as immediate equals and make the audience want the romance before the story denies it.",
              conflict: "Attraction, cover identity, myth residue, and hidden urgency collide before the moment can become personal.",
              reversal: "Precise flirtation is broken by twin operational summons before intimacy can become real.",
              reveal: "Callan and Elise already belong to the same hidden world and can read each other’s operational grammar.",
              carry_forward: "Denied romantic payoff primes the Beirut mission reunion.",
              ending_hook: "They are pulled apart before the romantic payoff.",
              drafting_beats: [
                "Callan reads the room for the moment polite order turns false.",
                "Elise enters and selects Callan with precision.",
                "They circle exits, mirrors, time, and hidden lies.",
                "A dry humor beat creates oxygen.",
                "Twin operational summons break the moment."
              ]
            }
          ],
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N3_Chapter_Drafter"
        }
      };
    }


    if (parsedInput?.debug_mock_node3 === true) {
      return {
        output_text: JSON.stringify({
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              },
              {
                section_number: 3,
                section_name: "Writing Style & Narrative Voice",
                packet_name: "style_packet",
                drafting_role: "Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling."
              },
              {
                section_number: 15,
                section_name: "Dialogue & Voice Cheat Sheet",
                packet_name: "dialogue_voice_packet",
                drafting_role: "Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline."
              }
            ]
          },
          style_packet: {
            source_section_number: 3,
            narrative_mandate: "Prestige espionage-romance mode.",
            prose_texture: "Lean, elegant, sensual, exact.",
            opening_propulsion: "Impact before explanation.",
            narrative_rhythm: "Compression under pressure.",
            descriptive_priority: "Rooms, thresholds, mirrors, corridors, objects, bodies in systems.",
            object_engine_rule: "Track tactile leverage objects through scenes.",
            emotional_handling: "Adult romance contaminated by duty.",
            pleasure_rule: "The couple must be pleasurable as well as wounded.",
            emotion_inside_motion: "Danger beats must force human charge into the open.",
            suspense_rule: "What happens next and what does it cost between these people.",
            political_handling: "Institutions must feel credible, specific, and morally complex.",
            action_handling: "Route-based, object-based, rescue-driven action.",
            dialogue_relation: "Dialogue should feel human, pressure-bearing, and legible.",
            pov_discipline: "Controlled, intelligent, emotionally charged POV.",
            atmosphere_rule: "Beirut glows and ruptures.",
            ending_rule: "Protect moral residue.",
            suspense_sequence_pass_criteria: [
              "A tactical choice is also a relational choice.",
              "The emotional charge is active during danger."
            ],
            suspense_sequence_failure_signs: [
              "The action could happen between interchangeable characters.",
              "The danger changes logistics but not intimacy."
            ],
            forbidden_style_failures: [
              "Ornate prose that blunts urgency.",
              "Generic spy cool without emotional price."
            ],
            style_shorthand: "Prestige espionage density. Adult romantic suspense. Moral residue."
          },
          dialogue_voice_packet: {
            source_section_number: 15,
            dialogue_mandate: "Subtext before explanation, but meaning remains legible.",
            voice_differentiation_rules: [
              "Callan sounds calm, plain, nearly kind.",
              "Elise sounds controlled, deliberate, and costly."
            ],
            subtext_rules: [
              "Romantic exchanges must also move leverage."
            ],
            compression_rules: [
              "Do not make all dialogue uniformly polished."
            ],
            interruption_and_silence_rules: [
              "Use interruption and silence as pressure."
            ],
            flirtation_and_desire_rules: [
              "Recognition fused to danger."
            ],
            institutional_speech_rules: [
              "Institutional language must carry human consequence."
            ],
            voice_forbidden_failures: [
              "Pseudo-profound speech.",
              "Same-voice drift across characters."
            ],
            dialogue_voice_shorthand: "Pressure-true, character-specific, legible."
          },
          locked_draft_priorities_packet: {
            source_section_number: 19,
            locked_draft_mandate: "Protect Beirut as the contamination that governs the franchise.",
            nonnegotiable_priorities: [
              "Protect the oxygen beats between Callan and Elise.",
              "Stage action through routes, objects, and rescue choices."
            ],
            do_not_change: [
              "Callan and Elise are immediate equals.",
              "Beirut is the canonical wound."
            ],
            escalation_priorities: [
              "Impact before explanation.",
              "Pleasure before denial."
            ],
            relationship_lock_points: [
              "Accusation fused to dependence.",
              "Recognition fused to danger."
            ],
            object_and_motif_lock_points: [
              "Mirrored amber glass.",
              "Cracked watch residue."
            ],
            ending_and_payoff_lock_points: [
              "Denied romantic payoff leading into Beirut Mission."
            ],
            locked_priorities_shorthand: "Protect contamination, oxygen, and route-based pressure."
          },
          character_constellation_packet: {
            source_section_number: 7,
            constellation_mandate: "Callan and Elise are dangerous complements.",
            central_pairing: "Callan Rook and Elise Harrow",
            major_characters: [
              {
                name: "Callan Rook",
                role: "Australian crisis extractor",
                function: "Mythic rescue lead",
                relation_to_pov: "self"
              },
              {
                name: "Elise Harrow",
                role: "MI6 field architect",
                function: "Co-equal icon lead",
                relation_to_pov: "attraction and operational equal"
              }
            ],
            relationship_pressure_lines: [
              "Attraction collides with operational secrecy."
            ],
            attraction_conflict_axes: [
              "Recognition fused to danger."
            ],
            trust_fault_lines: [
              "Immediate mutual recognition before trust is safe."
            ],
            constellation_shorthand: "Dangerous complements."
          },
          structural_spine_packet: {
            source_section_number: 11,
            current_unit_spine_function: "Romantic ignition before founding wound.",
            upstream_dependencies: [
              "Athens myth display and cracked-watch residue."
            ],
            downstream_setup_payoffs: [
              "Denied payoff primes Beirut Mission reunion."
            ],
            escalation_logic: [
              "Myth under fire -> bar recognition -> mission wound."
            ],
            spine_shorthand: "Romantic ignition under hidden urgency."
          },
          setpiece_symbol_architecture_packet: {
            source_section_number: 13,
            setpiece_mandate: "Respectable surface with hidden operational pressure.",
            chapter_relevant_setpieces: [
              "Beirut bar selection and near-kiss denial."
            ],
            object_symbol_rules: [
              "Mirrored amber glass is active atmosphere and symbol."
            ],
            visual_escalation_cues: [
              "Exit line, mirrored surfaces, unfinished look."
            ],
            setpiece_failure_signs: [
              "Generic flirtation without operational consequence."
            ],
            architecture_shorthand: "Seduction as pressure geometry."
          },
          world_setting_palette_packet: {
            source_section_number: 8,
            setting_palette_rules: [
              "Contemporary, politically plausible, sensorially exact."
            ],
            city_specific_texture_rules: [
              "Beirut glows and ruptures.",
              "Mirrored amber light."
            ],
            environmental_pressure_cues: [
              "Bar edges, exits, corridor pull."
            ],
            institutional_surface_rules: [
              "Elegant hotel calm masking hidden urgency."
            ],
            palette_shorthand: "Mirrored amber Beirut under hidden pressure."
          },
          thematic_moral_architecture_packet: {
            source_section_number: 9,
            thematic_mandate: "Truth, intimacy, and leverage are fused.",
            central_thematic_questions: [
              "What kind of truth can a room survive?"
            ],
            moral_pressure_lines: [
              "Attraction and duty contaminate each other."
            ],
            private_public_cost_rules: [
              "Private recognition opens into public consequence."
            ],
            contradiction_and_complicity_rules: [
              "Immediate intimacy already sits inside hidden systems."
            ],
            thematic_shorthand: "Contaminated intimacy under managed truth."
          },
          signature_verbal_deployment_packet: {
            source_section_number: 21,
            signature_language_rules: [
              "Callan sounds calm and plain.",
              "Elise sounds deliberate and costly."
            ],
            recurring_phrase_motifs: [
              "What people can bear."
            ],
            metaphor_and_comparison_rules: [
              "Precision over ornament."
            ],
            verbal_do_not_use: [
              "Pseudo-profound generic spy talk."
            ],
            signature_shorthand: "Pressure-true signature voice."
          },
          research_authenticity_packet: {
            source_section_number: 18,
            authenticity_mandate: "Grounded in recognizable allied-security culture and plausible urban texture.",
            procedural_truth_rules: [
              "Hospitality and diplomatic surfaces must feel real."
            ],
            terminology_and_register_rules: [
              "Avoid fake technical swagger."
            ],
            domain_specific_constraints: [
              "Keep Beirut hotel-bar dynamics credible and specific."
            ],
            realism_do_not_fake: [
              "Do not invent implausible operator jargon."
            ],
            authenticity_shorthand: "Plausible, tactile, politically literate."
          },
          prestige_quality_alignment_packet: {
            source_section_number: 4,
            prestige_mandate: "Prestige-level espionage density with immediate commercial legibility.",
            quality_benchmarks: [
              "Elegant but emotionally charged.",
              "Trailer-legible without flattening intelligence."
            ],
            anti_generic_failures: [
              "Generic spy cool.",
              "Empty glamour."
            ],
            audience_promise_rules: [
              "The couple must be thrilling before the plot weaponizes them."
            ],
            prestige_shorthand: "Prestige espionage-romance with commercial propulsion."
          },
          unit_contracts: [
            {
              source_section_number: 12,
              movement_label: "Prologue",
              movement_approximate_length: 6400,
              unit_label: "Chapter 1 - Beirut Bar",
              target_word_count: 1800,
              pov: "Callan",
              setting: "Beirut hotel bar, mirrored amber light, private booth edge, exit corridor",
              objective: "Establish Callan and Elise as immediate equals and make the audience want the romance before the story denies it.",
              conflict: "Attraction, cover identity, myth residue, and hidden urgency collide before the moment can become personal.",
              reversal: "Precise flirtation is broken by twin operational summons before intimacy can become real.",
              reveal: "Callan and Elise already belong to the same hidden world and can read each other’s operational grammar.",
              carry_forward: "Denied romantic payoff primes the Beirut mission reunion.",
              ending_hook: "They are pulled apart before the romantic payoff.",
              drafting_beats: [
                "Callan reads the room for the moment polite order turns false.",
                "Elise enters and selects Callan with precision.",
                "They circle exits, mirrors, time, and hidden lies.",
                "A dry humor beat creates oxygen.",
                "Twin operational summons break the moment."
              ]
            }
          ],
          store_packet_status: "preserved",
          drafted_units: [
            {
              unit_label: "Chapter 1 - Beirut Bar",
              chapter_heading: "Chapter 1\nBeirut Bar",
              drafted_text: "Mock drafted text for Chapter 1 - Beirut Bar. Callan sits in mirrored amber light reading the room for fracture. Elise selects him with impossible precision. Their conversation becomes mutual recognition under hidden pressure, oxygen threaded through surveillance instincts and withheld affiliations. A dry humor beat opens the possibility of pleasure. Before the moment can become real, twin operational summons break the spell and pull them apart.",
              ending_condition: "Callan and Elise are pulled apart before the romantic payoff.",
              carry_forward_summary: "Denied payoff primes the Beirut mission reunion."
            }
          ],
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N4A_Upstream_Draft_Gate"
        }),
        output_parsed: {
          story_run_id: parsedInput?.story_run_id ?? null,
          project_id: parsedInput?.project_id ?? null,
          chapter_worker_version: parsedInput?.chapter_worker_version ?? null,
          chapter_context: parsedInput?.chapter_context ?? null,
          run_config: parsedInput?.run_config ?? null,
          status: "ready",
          requested_operation: "draft",
          resolved_scope: "Chapter 1 - Beirut Bar only",
          target_units_requested: ["Chapter 1 - Beirut Bar"],
          canon_basis: "master_story_bible",
          active_bible_sections: [12, 3, 15, 19, 7, 11, 13, 8, 9, 21, 18, 4],
          drafting_bible_stack: {
            active_every_time: [
              {
                section_number: 12,
                section_name: "Chapter-by-Chapter Breakdown",
                packet_name: "unit_contracts",
                drafting_role: "Controls objective, conflict, reversal, reveal, carry-forward, ending hook, drafting beats, and scene mission."
              },
              {
                section_number: 3,
                section_name: "Writing Style & Narrative Voice",
                packet_name: "style_packet",
                drafting_role: "Controls prose texture, propulsion, rhythm, descriptive priority, suspense logic, atmosphere, and emotional handling."
              },
              {
                section_number: 15,
                section_name: "Dialogue & Voice Cheat Sheet",
                packet_name: "dialogue_voice_packet",
                drafting_role: "Controls dialogue differentiation, subtext, interruption, silence, flirtation, institutional speech, and voice discipline."
              }
            ]
          },
          style_packet: {
            source_section_number: 3,
            narrative_mandate: "Prestige espionage-romance mode.",
            prose_texture: "Lean, elegant, sensual, exact.",
            opening_propulsion: "Impact before explanation.",
            narrative_rhythm: "Compression under pressure.",
            descriptive_priority: "Rooms, thresholds, mirrors, corridors, objects, bodies in systems.",
            object_engine_rule: "Track tactile leverage objects through scenes.",
            emotional_handling: "Adult romance contaminated by duty.",
            pleasure_rule: "The couple must be pleasurable as well as wounded.",
            emotion_inside_motion: "Danger beats must force human charge into the open.",
            suspense_rule: "What happens next and what does it cost between these people.",
            political_handling: "Institutions must feel credible, specific, and morally complex.",
            action_handling: "Route-based, object-based, rescue-driven action.",
            dialogue_relation: "Dialogue should feel human, pressure-bearing, and legible.",
            pov_discipline: "Controlled, intelligent, emotionally charged POV.",
            atmosphere_rule: "Beirut glows and ruptures.",
            ending_rule: "Protect moral residue.",
            suspense_sequence_pass_criteria: [
              "A tactical choice is also a relational choice.",
              "The emotional charge is active during danger."
            ],
            suspense_sequence_failure_signs: [
              "The action could happen between interchangeable characters.",
              "The danger changes logistics but not intimacy."
            ],
            forbidden_style_failures: [
              "Ornate prose that blunts urgency.",
              "Generic spy cool without emotional price."
            ],
            style_shorthand: "Prestige espionage density. Adult romantic suspense. Moral residue."
          },
          dialogue_voice_packet: {
            source_section_number: 15,
            dialogue_mandate: "Subtext before explanation, but meaning remains legible.",
            voice_differentiation_rules: [
              "Callan sounds calm, plain, nearly kind.",
              "Elise sounds controlled, deliberate, and costly."
            ],
            subtext_rules: [
              "Romantic exchanges must also move leverage."
            ],
            compression_rules: [
              "Do not make all dialogue uniformly polished."
            ],
            interruption_and_silence_rules: [
              "Use interruption and silence as pressure."
            ],
            flirtation_and_desire_rules: [
              "Recognition fused to danger."
            ],
            institutional_speech_rules: [
              "Institutional language must carry human consequence."
            ],
            voice_forbidden_failures: [
              "Pseudo-profound speech.",
              "Same-voice drift across characters."
            ],
            dialogue_voice_shorthand: "Pressure-true, character-specific, legible."
          },
          locked_draft_priorities_packet: {
            source_section_number: 19,
            locked_draft_mandate: "Protect Beirut as the contamination that governs the franchise.",
            nonnegotiable_priorities: [
              "Protect the oxygen beats between Callan and Elise.",
              "Stage action through routes, objects, and rescue choices."
            ],
            do_not_change: [
              "Callan and Elise are immediate equals.",
              "Beirut is the canonical wound."
            ],
            escalation_priorities: [
              "Impact before explanation.",
              "Pleasure before denial."
            ],
            relationship_lock_points: [
              "Accusation fused to dependence.",
              "Recognition fused to danger."
            ],
            object_and_motif_lock_points: [
              "Mirrored amber glass.",
              "Cracked watch residue."
            ],
            ending_and_payoff_lock_points: [
              "Denied romantic payoff leading into Beirut Mission."
            ],
            locked_priorities_shorthand: "Protect contamination, oxygen, and route-based pressure."
          },
          character_constellation_packet: {
            source_section_number: 7,
            constellation_mandate: "Callan and Elise are dangerous complements.",
            central_pairing: "Callan Rook and Elise Harrow",
            major_characters: [
              {
                name: "Callan Rook",
                role: "Australian crisis extractor",
                function: "Mythic rescue lead",
                relation_to_pov: "self"
              },
              {
                name: "Elise Harrow",
                role: "MI6 field architect",
                function: "Co-equal icon lead",
                relation_to_pov: "attraction and operational equal"
              }
            ],
            relationship_pressure_lines: [
              "Attraction collides with operational secrecy."
            ],
            attraction_conflict_axes: [
              "Recognition fused to danger."
            ],
            trust_fault_lines: [
              "Immediate mutual recognition before trust is safe."
            ],
            constellation_shorthand: "Dangerous complements."
          },
          structural_spine_packet: {
            source_section_number: 11,
            current_unit_spine_function: "Romantic ignition before founding wound.",
            upstream_dependencies: [
              "Athens myth display and cracked-watch residue."
            ],
            downstream_setup_payoffs: [
              "Denied payoff primes Beirut Mission reunion."
            ],
            escalation_logic: [
              "Myth under fire -> bar recognition -> mission wound."
            ],
            spine_shorthand: "Romantic ignition under hidden urgency."
          },
          setpiece_symbol_architecture_packet: {
            source_section_number: 13,
            setpiece_mandate: "Respectable surface with hidden operational pressure.",
            chapter_relevant_setpieces: [
              "Beirut bar selection and near-kiss denial."
            ],
            object_symbol_rules: [
              "Mirrored amber glass is active atmosphere and symbol."
            ],
            visual_escalation_cues: [
              "Exit line, mirrored surfaces, unfinished look."
            ],
            setpiece_failure_signs: [
              "Generic flirtation without operational consequence."
            ],
            architecture_shorthand: "Seduction as pressure geometry."
          },
          world_setting_palette_packet: {
            source_section_number: 8,
            setting_palette_rules: [
              "Contemporary, politically plausible, sensorially exact."
            ],
            city_specific_texture_rules: [
              "Beirut glows and ruptures.",
              "Mirrored amber light."
            ],
            environmental_pressure_cues: [
              "Bar edges, exits, corridor pull."
            ],
            institutional_surface_rules: [
              "Elegant hotel calm masking hidden urgency."
            ],
            palette_shorthand: "Mirrored amber Beirut under hidden pressure."
          },
          thematic_moral_architecture_packet: {
            source_section_number: 9,
            thematic_mandate: "Truth, intimacy, and leverage are fused.",
            central_thematic_questions: [
              "What kind of truth can a room survive?"
            ],
            moral_pressure_lines: [
              "Attraction and duty contaminate each other."
            ],
            private_public_cost_rules: [
              "Private recognition opens into public consequence."
            ],
            contradiction_and_complicity_rules: [
              "Immediate intimacy already sits inside hidden systems."
            ],
            thematic_shorthand: "Contaminated intimacy under managed truth."
          },
          signature_verbal_deployment_packet: {
            source_section_number: 21,
            signature_language_rules: [
              "Callan sounds calm and plain.",
              "Elise sounds deliberate and costly."
            ],
            recurring_phrase_motifs: [
              "What people can bear."
            ],
            metaphor_and_comparison_rules: [
              "Precision over ornament."
            ],
            verbal_do_not_use: [
              "Pseudo-profound generic spy talk."
            ],
            signature_shorthand: "Pressure-true signature voice."
          },
          research_authenticity_packet: {
            source_section_number: 18,
            authenticity_mandate: "Grounded in recognizable allied-security culture and plausible urban texture.",
            procedural_truth_rules: [
              "Hospitality and diplomatic surfaces must feel real."
            ],
            terminology_and_register_rules: [
              "Avoid fake technical swagger."
            ],
            domain_specific_constraints: [
              "Keep Beirut hotel-bar dynamics credible and specific."
            ],
            realism_do_not_fake: [
              "Do not invent implausible operator jargon."
            ],
            authenticity_shorthand: "Plausible, tactile, politically literate."
          },
          prestige_quality_alignment_packet: {
            source_section_number: 4,
            prestige_mandate: "Prestige-level espionage density with immediate commercial legibility.",
            quality_benchmarks: [
              "Elegant but emotionally charged.",
              "Trailer-legible without flattening intelligence."
            ],
            anti_generic_failures: [
              "Generic spy cool.",
              "Empty glamour."
            ],
            audience_promise_rules: [
              "The couple must be thrilling before the plot weaponizes them."
            ],
            prestige_shorthand: "Prestige espionage-romance with commercial propulsion."
          },
          unit_contracts: [
            {
              source_section_number: 12,
              movement_label: "Prologue",
              movement_approximate_length: 6400,
              unit_label: "Chapter 1 - Beirut Bar",
              target_word_count: 1800,
              pov: "Callan",
              setting: "Beirut hotel bar, mirrored amber light, private booth edge, exit corridor",
              objective: "Establish Callan and Elise as immediate equals and make the audience want the romance before the story denies it.",
              conflict: "Attraction, cover identity, myth residue, and hidden urgency collide before the moment can become personal.",
              reversal: "Precise flirtation is broken by twin operational summons before intimacy can become real.",
              reveal: "Callan and Elise already belong to the same hidden world and can read each other’s operational grammar.",
              carry_forward: "Denied romantic payoff primes the Beirut mission reunion.",
              ending_hook: "They are pulled apart before the romantic payoff.",
              drafting_beats: [
                "Callan reads the room for the moment polite order turns false.",
                "Elise enters and selects Callan with precision.",
                "They circle exits, mirrors, time, and hidden lies.",
                "A dry humor beat creates oxygen.",
                "Twin operational summons break the moment."
              ]
            }
          ],
          store_packet_status: "preserved",
          drafted_units: [
            {
              unit_label: "Chapter 1 - Beirut Bar",
              chapter_heading: "Chapter 1\nBeirut Bar",
              drafted_text: "Mock drafted text for Chapter 1 - Beirut Bar. Callan sits in mirrored amber light reading the room for fracture. Elise selects him with impossible precision. Their conversation becomes mutual recognition under hidden pressure, oxygen threaded through surveillance instincts and withheld affiliations. A dry humor beat opens the possibility of pleasure. Before the moment can become real, twin operational summons break the spell and pull them apart.",
              ending_condition: "Callan and Elise are pulled apart before the romantic payoff.",
              carry_forward_summary: "Denied payoff primes the Beirut mission reunion."
            }
          ],
          downstream_store_requests: {
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
          },
          missing_required_inputs: [],
          blocked_reasons: [],
          next_node: "N4A_Upstream_Draft_Gate"
        }
      };
    }

    // NODE 1
    // NODE 1
    const node1Result = await runNode(
      node1IntakeScopeLockCanonBasisAndStoreRouting,
      runner,
      conversationHistory,
      "Node 1"
    );
    console.log("[Node 1] status", node1Result.output_parsed.status);
    if (node1Result.output_parsed.status !== "ready") {
      console.log("[workflow] exiting after Node 1");
      return node1Result;
    }

    // NODE 2
    const node2Result = await runNode(
      node2UnitContractBuilder,
      runner,
      conversationHistory,
      "Node 2"
    );
    console.log("[Node 2] status", node2Result.output_parsed.status);
    if (node2Result.output_parsed.status !== "ready") {
      console.log("[workflow] exiting after Node 2");
      return node2Result;
    }

    // NODE 3
    const node3Result = await runNode(
      node3ChapterDrafter,
      runner,
      conversationHistory,
      "Node 3"
    );
    console.log("[Node 3] status", node3Result.output_parsed.status);
    if (node3Result.output_parsed.status !== "ready") {
      console.log("[workflow] exiting after Node 3");
      return node3Result;
    }

    // REWRITE LOOP
    state.rewrite_cycle_completed = 0;
    state.max_enhancement_cycles = configuredRewriteCycles;
    state.remaining_rewrite_cycles = configuredRewriteCycles;

    console.log("[rewrite] loop init", JSON.stringify({
      rewrite_cycle_completed: state.rewrite_cycle_completed,
      max_enhancement_cycles: state.max_enhancement_cycles,
      remaining_rewrite_cycles: state.remaining_rewrite_cycles,
    }));

    while (toInt(state.remaining_rewrite_cycles) > 0) {
      console.log("[rewrite] loop tick", JSON.stringify({
        rewrite_cycle_completed: state.rewrite_cycle_completed,
        remaining_rewrite_cycles: state.remaining_rewrite_cycles,
      }));

      const node4aResult = await runNode(
        node4aUpstreamDraftGate,
        runner,
        conversationHistory,
        "Node 4A"
      );
      console.log("[Node 4A] status", node4aResult.output_parsed.status);
      if (node4aResult.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 4A");
        return node4aResult;
      }

      const node4bResult = await runNode(
        node4bEnhancementEvaluator,
        runner,
        conversationHistory,
        "Node 4B"
      );
      console.log("[Node 4B] status", node4bResult.output_parsed.status);
      if (node4bResult.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 4B");
        return node4bResult;
      }

      const node5Result = await runNode(
        node5ChapterRewriter,
        runner,
        conversationHistory,
        "Node 5"
      );
      console.log("[Node 5] status", node5Result.output_parsed.status);
      if (node5Result.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 5");
        return node5Result;
      }

      state.rewrite_cycle_completed = toInt(
        node5Result.output_parsed.rewrite_cycle_completed,
        0
      );
      state.max_enhancement_cycles = toInt(
        node5Result.output_parsed.max_enhancement_cycles,
        configuredRewriteCycles
      );
      state.remaining_rewrite_cycles = toInt(
        node5Result.output_parsed.remaining_rewrite_cycles,
        0
      );
      state.last_node5_status = node5Result.output_parsed.status;

      console.log("[rewrite] state updated", JSON.stringify({
        rewrite_cycle_completed: state.rewrite_cycle_completed,
        max_enhancement_cycles: state.max_enhancement_cycles,
        remaining_rewrite_cycles: state.remaining_rewrite_cycles,
        last_node5_status: state.last_node5_status,
      }));
    }

    console.log("[rewrite] loop complete");

    // POLISH LOOP INIT
    state.max_polish_cycles = configuredPolishCycles;
    state.polish_cycle_completed = 0;
    state.remaining_polish_cycles = configuredPolishCycles;

    console.log("[polish] loop init", JSON.stringify({
      max_polish_cycles: state.max_polish_cycles,
      polish_cycle_completed: state.polish_cycle_completed,
      remaining_polish_cycles: state.remaining_polish_cycles,
    }));

    while (toInt(state.remaining_polish_cycles) > 0) {
      console.log("[polish] loop tick", JSON.stringify({
        polish_cycle_completed: state.polish_cycle_completed,
        remaining_polish_cycles: state.remaining_polish_cycles,
      }));

      const node6Result = await runNode(
        node6PolishReadyGate,
        runner,
        conversationHistory,
        "Node 6"
      );
      console.log("[Node 6] status", node6Result.output_parsed.status);
      if (node6Result.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 6");
        return node6Result;
      }

      const node7Result = await runNode(
        node7PolishEvaluator,
        runner,
        conversationHistory,
        "Node 7"
      );
      console.log("[Node 7] status", node7Result.output_parsed.status);
      if (node7Result.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 7");
        return node7Result;
      }

      const node8Result = await runNode(
        node8PolishRewriter,
        runner,
        conversationHistory,
        "Node 8"
      );
      console.log("[Node 8] status", node8Result.output_parsed.status);
      if (node8Result.output_parsed.status !== "ready") {
        console.log("[workflow] exiting after Node 8");
        return node8Result;
      }

      state.polish_cycle_completed = toInt(
        node8Result.output_parsed.polish_cycle_completed,
        0
      );
      state.max_polish_cycles = toInt(
        node8Result.output_parsed.configured_max_polish_cycles,
        configuredPolishCycles
      );
      state.remaining_polish_cycles = toInt(
        node8Result.output_parsed.remaining_polish_cycles,
        0
      );

      console.log("[polish] state updated", JSON.stringify({
        polish_cycle_completed: state.polish_cycle_completed,
        max_polish_cycles: state.max_polish_cycles,
        remaining_polish_cycles: state.remaining_polish_cycles,
      }));
    }

    console.log("[polish] loop complete");

    // NODE 9
    const node9Result = await runNode(
      node9FinalChapterOutput,
      runner,
      conversationHistory,
      "Node 9"
    );
    console.log("[Node 9] status", node9Result.output_parsed.status);
    if (node9Result.output_parsed.status !== "ready") {
      console.log("[workflow] exiting after Node 9");
      return node9Result;
    }

    // NODE 10
    const node10Result = await runNode(
      node10StoryOrchestratorHandoffPackager,
      runner,
      conversationHistory,
      "Node 10"
    );
    console.log("[Node 10] status", node10Result.output_parsed.status);

    const totalElapsedMs = Date.now() - workflowStartedAt;
    console.log("[workflow] complete in ms", totalElapsedMs);

    return node10Result;
  });
}

export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return json(
        {
          ok: false,
          error: "Method not allowed. Use POST.",
        },
        405
      );
    }

    const sharedSecret = Netlify.env.get("AGENT_SHARED_SECRET");
    if (sharedSecret) {
      const providedSecret =
        req.headers.get("x-agent-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

      if (providedSecret !== sharedSecret) {
        return json(
          {
            ok: false,
            error: "Unauthorized",
          },
          401
        );
      }
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        400
      );
    }

    if (body?.ping === "test") {
      return json({
        ok: true,
        message: "agent endpoint reachable",
      });
    }

    if (body?.input_as_text === "{\"ping\":\"test\"}") {
      return json({
        ok: true,
        message: "agent endpoint reachable",
      });
    }

    if (
      typeof body?.master_story_bible_text === "string" &&
      body.master_story_bible_text.trim().length > 0
    ) {
      console.log("[handler] master_story_bible_text received");
    }

    if (body?.debug_return_before_openai === true) {
      return json({
        ok: true,
        message: "debug shortcut accepted",
      });
    }

    const inputPayload =
      typeof body?.input_as_text === "string"
        ? body.input_as_text
        : JSON.stringify(body);

    if (!inputPayload || !inputPayload.trim()) {
      return json(
        {
          ok: false,
          error: "Missing request payload",
        },
        400
      );
    }

    const result = await runWorkflow({ input_as_text: inputPayload });

    return json({
      ok: true,
      workflow_result: result?.output_parsed ?? null,
      workflow_result_text: result?.output_text ?? null,
    });
  } catch (error) {
    console.error("agent function failed", error);

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
};

export const config = {
  path: "/api/agent",
};
