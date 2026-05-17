const PACKET_KEYS = [
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

const SECTION_MAP = {
  style_packet: 3,
  dialogue_voice_packet: 15,
  locked_draft_priorities_packet: 19,
  character_constellation_packet: 7,
  structural_spine_packet: 11,
  setpiece_symbol_architecture_packet: 13,
  world_setting_palette_packet: 8,
  thematic_moral_architecture_packet: 9,
  signature_verbal_deployment_packet: 21,
  research_authenticity_packet: 18,
  prestige_quality_alignment_packet: 4
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function cleanString(value, fallback = null) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

function parseJsonMaybe(value, fallback = null) {
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

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeObjects(...objects) {
  const merged = {};
  for (const obj of objects) {
    const parsed = parseJsonMaybe(obj, obj);
    if (isPlainObject(parsed)) Object.assign(merged, parsed);
  }
  return merged;
}

function packetIsValid(packet) {
  return isPlainObject(packet) && Object.keys(packet).length > 0;
}

function normalizePacketSet(raw) {
  const source = parseJsonMaybe(raw, raw) || {};

  const activeStackOverride = mergeObjects(
    source.active_stack_override,
    source.drafting_bible_stack,
    source
  );

  const draftingBibleStack = {};

  for (const key of PACKET_KEYS) {
    const packet =
      source[key] ??
      source.active_stack_override?.[key] ??
      source.drafting_bible_stack?.[key] ??
      activeStackOverride[key] ??
      null;

    draftingBibleStack[key] = packetIsValid(packet) ? packet : null;

    if (packetIsValid(packet)) {
      activeStackOverride[key] = packet;
    }
  }

  const missing = PACKET_KEYS.filter(
    (key) => !packetIsValid(draftingBibleStack[key])
  );

  return {
    active_stack_override: activeStackOverride,
    drafting_bible_stack: draftingBibleStack,
    missing_bible_packets: missing,
    bible_packets_ready: missing.length === 0
  };
}

function getBuildMode(body) {
  const active = parseJsonMaybe(body.active_stack_override, null);
  const drafting = parseJsonMaybe(body.drafting_bible_stack, null);

  if (isPlainObject(active) || isPlainObject(drafting)) return "packet_override";
  if (cleanString(body.master_story_bible_text)) return "text_extraction";
  if (cleanString(body.master_story_bible_pdf_url)) return "pdf_url";
  return "missing_source";
}

function buildPacketSchema() {
  const packetObjectSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "source_section_number",
      "source_section_name",
      "packet_summary",
      "shorthand",
      "rules",
      "do_not",
      "continuity_constraints",
      "drafting_guidance"
    ],
    properties: {
      source_section_number: {
        type: ["number", "null"]
      },
      source_section_name: {
        type: ["string", "null"]
      },
      packet_summary: {
        type: ["string", "null"]
      },
      shorthand: {
        type: ["string", "null"]
      },
      rules: {
        type: "array",
        items: {
          type: "string"
        }
      },
      do_not: {
        type: "array",
        items: {
          type: "string"
        }
      },
      continuity_constraints: {
        type: "array",
        items: {
          type: "string"
        }
      },
      drafting_guidance: {
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  };

  const properties = {};
  const required = [];

  for (const key of PACKET_KEYS) {
    properties[key] = packetObjectSchema;
    required.push(key);
  }

  return {
    type: "object",
    additionalProperties: false,
    required,
    properties
  };
}

function buildExtractionInstructions({ title, projectId }) {
  return `
You are extracting governing story Bible packets for a story-generation pipeline.

Project ID: ${projectId}
Title: ${title ?? "Untitled"}

Return ONLY the required JSON object matching the schema.

Create these exact 11 top-level packet keys:

1. style_packet — from Section 3, Writing Style & Narrative Voice.
2. dialogue_voice_packet — from Section 15, Dialogue & Voice Cheat Sheet.
3. locked_draft_priorities_packet — from Section 19, Locked Draft Priorities.
4. character_constellation_packet — from Section 7, Cast / Character Constellation.
5. structural_spine_packet — from Section 11, Structural Spine.
6. setpiece_symbol_architecture_packet — from Section 13, Set-Pieces & Symbol Architecture.
7. world_setting_palette_packet — from Section 8, World / Setting & Cinematic Palette.
8. thematic_moral_architecture_packet — from Section 9, Thematic Spine & Moral Architecture.
9. signature_verbal_deployment_packet — from Section 21, Signature Verbal Identity and Franchise Deployment.
10. research_authenticity_packet — from Section 18, Research & Authenticity Bible.
11. prestige_quality_alignment_packet — from Section 4, Prestige Quality Alignment.

Important:
- Section 12 is NOT one of the global packets. It belongs to chapter manifest/unit contracts.
- If a section is not explicitly labeled, infer from the closest matching heading/content.
- Each packet must be a useful object with story-specific rules, not a placeholder.
- Preserve concrete mandates, rules, constraints, do-not-change items, relationship dynamics, tone, world palette, authenticity constraints, and quality benchmarks.
- Do not invent irrelevant facts.
- Use concise but operational fields that downstream drafting can use.
- Every packet must include source_section_number.
- Each packet must use exactly these fields: source_section_number, source_section_name, packet_summary, shorthand, rules, do_not, continuity_constraints, and drafting_guidance. Put any detailed section-specific content into those arrays or strings. Do not add extra keys.
`;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textParts = [];

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (typeof part.text === "string") textParts.push(part.text);
          if (typeof part.output_text === "string") textParts.push(part.output_text);
        }
      }
    }
  }

  return textParts.join("\n").trim();
}

async function callOpenAIForPackets({ body, usePdfUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.PROJECT_BIBLE_EXTRACT_MODEL || "gpt-5.5";

  const projectId = cleanString(body.project_id);
  const title = cleanString(body.title);

  const instructions = buildExtractionInstructions({
    title,
    projectId
  });

  const content = [
    {
      type: "input_text",
      text: instructions
    }
  ];

  if (usePdfUrl) {
    content.push({
      type: "input_file",
      file_url: cleanString(body.master_story_bible_pdf_url)
    });
  } else {
    const text = cleanString(body.master_story_bible_text);

    content.push({
      type: "input_text",
      text: `MASTER STORY BIBLE TEXT:\n\n${text}`
    });
  }

  const requestBody = {
    model,
    input: [
      {
        role: "user",
        content
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "project_bible_packets",
        strict: true,
        schema: buildPacketSchema()
      }
    }
  };

  const startedAt = Date.now();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const rawText = await response.text();

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    data = { raw_text: rawText };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      elapsed_ms: Date.now() - startedAt,
      error: data.error?.message ?? rawText,
      raw_response_preview: rawText.slice(0, 2000)
    };
  }

  const outputText = extractOutputText(data);

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      status: response.status,
      elapsed_ms: Date.now() - startedAt,
      error: "OpenAI response did not parse into JSON.",
      output_text_preview: String(outputText ?? "").slice(0, 2000)
    };
  }

  return {
    ok: true,
    status: response.status,
    elapsed_ms: Date.now() - startedAt,
    model,
    parsed
  };
}

export async function handler(event) {
  if (event.httpMethod && event.httpMethod !== "POST") {
    return json(405, {
      ok: false,
      error: "Method not allowed. Use POST."
    });
  }

  let body;

  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, {
      ok: false,
      error: "Invalid JSON body."
    });
  }

  const projectId = cleanString(body.project_id);
  const title = cleanString(body.title);
  const buildMode = cleanString(body.build_mode, getBuildMode(body));

  if (!projectId) {
    return json(400, {
      ok: false,
      error: "project_id is required."
    });
  }

  try {
    if (buildMode === "packet_override") {
      const normalized = normalizePacketSet({
        active_stack_override: body.active_stack_override,
        drafting_bible_stack: body.drafting_bible_stack,
        ...parseJsonMaybe(body.active_stack_override, {}),
        ...parseJsonMaybe(body.drafting_bible_stack, {})
      });

      return json(200, {
        ok: true,
        project_id: projectId,
        title,
        build_mode: "packet_override",
        ...normalized
      });
    }

    if (buildMode === "missing_source") {
      return json(400, {
        ok: false,
        project_id: projectId,
        title,
        build_mode: buildMode,
        error:
          "No master_story_bible_text, master_story_bible_pdf_url, or packet override was provided."
      });
    }

    if (buildMode === "text_extraction") {
      const result = await callOpenAIForPackets({
        body,
        usePdfUrl: false
      });

      if (!result.ok) {
        return json(500, {
          ok: false,
          project_id: projectId,
          title,
          build_mode: buildMode,
          error: result.error,
          debug_openai_status: result.status,
          debug_openai_elapsed_ms: result.elapsed_ms,
          debug_output_text_preview: result.output_text_preview ?? null,
          debug_raw_response_preview: result.raw_response_preview ?? null
        });
      }

      const normalized = normalizePacketSet(result.parsed);

      return json(200, {
        ok: true,
        project_id: projectId,
        title,
        build_mode: buildMode,
        model: result.model,
        elapsed_ms: result.elapsed_ms,
        ...normalized
      });
    }

    if (buildMode === "pdf_url") {
      const pdfUrl = cleanString(body.master_story_bible_pdf_url);

      if (!pdfUrl) {
        return json(400, {
          ok: false,
          project_id: projectId,
          title,
          build_mode: buildMode,
          error: "master_story_bible_pdf_url is required for pdf_url mode."
        });
      }

      const result = await callOpenAIForPackets({
        body,
        usePdfUrl: true
      });

      if (!result.ok) {
        return json(500, {
          ok: false,
          project_id: projectId,
          title,
          build_mode: buildMode,
          error: result.error,
          debug_openai_status: result.status,
          debug_openai_elapsed_ms: result.elapsed_ms,
          debug_output_text_preview: result.output_text_preview ?? null,
          debug_raw_response_preview: result.raw_response_preview ?? null
        });
      }

      const normalized = normalizePacketSet(result.parsed);

      return json(200, {
        ok: true,
        project_id: projectId,
        title,
        build_mode: buildMode,
        model: result.model,
        elapsed_ms: result.elapsed_ms,
        ...normalized
      });
    }

    return json(400, {
      ok: false,
      project_id: projectId,
      title,
      build_mode: buildMode,
      error: `Unsupported build_mode: ${buildMode}`
    });
  } catch (error) {
    return json(500, {
      ok: false,
      project_id: projectId,
      title,
      build_mode: buildMode,
      error: error?.message ?? String(error)
    });
  }
}
