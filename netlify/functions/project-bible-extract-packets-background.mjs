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
- Every packet must be story-specific and operational for downstream drafting.
- Do not invent irrelevant facts.
- Preserve mandates, rules, constraints, do-not-change items, relationship dynamics, tone, world palette, authenticity constraints, and quality benchmarks.
- Each packet must use exactly these fields: source_section_number, source_section_name, packet_summary, shorthand, rules, do_not, continuity_constraints, and drafting_guidance.
- Put detailed section-specific content into those arrays or strings.
- Do not add extra keys.
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

async function fetchPdfAsBase64(pdfUrl) {
  const response = await fetch(pdfUrl, {
    method: "GET",
    headers: {
      Accept: "application/pdf,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF URL: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error("Fetched PDF was empty.");
  }

  const firstBytes = buffer.slice(0, 5).toString("utf8");
  const appearsPdf = firstBytes === "%PDF-";

  if (!appearsPdf) {
    const preview = buffer.slice(0, 200).toString("utf8");
    throw new Error(
      `Fetched file does not appear to be a PDF. content-type=${contentType || "unknown"}; preview=${preview}`
    );
  }

  return {
    base64: buffer.toString("base64"),
    content_type: contentType,
    bytes: buffer.length
  };
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

  let pdfDebug = null;

  if (usePdfUrl) {
    const pdfUrl = cleanString(body.master_story_bible_pdf_url);
    if (!pdfUrl) {
      throw new Error("master_story_bible_pdf_url is required for pdf_url mode.");
    }

    const pdf = await fetchPdfAsBase64(pdfUrl);
    pdfDebug = {
      bytes: pdf.bytes,
      content_type: pdf.content_type
    };

    content.push({
      type: "input_file",
      filename: "master_story_bible.pdf",
      file_data: `data:application/pdf;base64,${pdf.base64}`
    });
  } else {
    const text = cleanString(body.master_story_bible_text);

    if (!text) {
      throw new Error("master_story_bible_text is required for text_extraction mode.");
    }

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
      raw_response_preview: rawText.slice(0, 2000),
      pdf_debug: pdfDebug
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
      output_text_preview: String(outputText ?? "").slice(0, 2000),
      pdf_debug: pdfDebug
    };
  }

  return {
    ok: true,
    status: response.status,
    elapsed_ms: Date.now() - startedAt,
    model,
    parsed,
    pdf_debug: pdfDebug
  };
}

async function postCallback(payload) {
  const callbackUrl =
    process.env.PROJECT_BIBLE_BUILD_CALLBACK_URL ||
    "https://5gb6hf.buildship.run/project-bible/build-packets/callback";

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw_text: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    preview: text.slice(0, 2000)
  };
}

async function runExtractionAndCallback(body) {
  const packetBuildId = cleanString(body.packet_build_id);
  const projectId = cleanString(body.project_id);
  const title = cleanString(body.title);
  const buildMode = cleanString(
    body.build_mode,
    body.master_story_bible_pdf_url ? "pdf_url" : "text_extraction"
  );

  if (!packetBuildId) {
    throw new Error("packet_build_id is required.");
  }

  if (!projectId) {
    throw new Error("project_id is required.");
  }

  try {
    let normalized;
    let extractionResult = null;

    if (buildMode === "packet_override") {
      normalized = normalizePacketSet({
        active_stack_override: body.active_stack_override,
        drafting_bible_stack: body.drafting_bible_stack,
        ...parseJsonMaybe(body.active_stack_override, {}),
        ...parseJsonMaybe(body.drafting_bible_stack, {})
      });
    } else if (buildMode === "text_extraction") {
      extractionResult = await callOpenAIForPackets({
        body,
        usePdfUrl: false
      });

      if (!extractionResult.ok) {
        throw new Error(extractionResult.error || "OpenAI text extraction failed.");
      }

      normalized = normalizePacketSet(extractionResult.parsed);
    } else if (buildMode === "pdf_url") {
      extractionResult = await callOpenAIForPackets({
        body,
        usePdfUrl: true
      });

      if (!extractionResult.ok) {
        throw new Error(extractionResult.error || "OpenAI PDF extraction failed.");
      }

      normalized = normalizePacketSet(extractionResult.parsed);
    } else {
      throw new Error(`Unsupported build_mode: ${buildMode}`);
    }

    const callbackPayload = {
      packet_build_id: packetBuildId,
      project_id: projectId,
      title,
      ok: true,
      build_mode: buildMode,
      bible_packets_ready: normalized.bible_packets_ready,
      missing_bible_packets: normalized.missing_bible_packets,
      active_stack_override: normalized.active_stack_override,
      drafting_bible_stack: normalized.drafting_bible_stack,
      extraction_result_json: {
        build_mode: buildMode,
        model: extractionResult?.model ?? null,
        elapsed_ms: extractionResult?.elapsed_ms ?? null,
        pdf_debug: extractionResult?.pdf_debug ?? null,
        bible_packets_ready: normalized.bible_packets_ready,
        missing_bible_packets: normalized.missing_bible_packets
      }
    };

    return await postCallback(callbackPayload);
  } catch (error) {
    const callbackPayload = {
      packet_build_id: packetBuildId,
      project_id: projectId,
      title,
      ok: false,
      build_mode: buildMode,
      bible_packets_ready: false,
      missing_bible_packets: PACKET_KEYS,
      error_message: error?.message ?? String(error),
      extraction_result_json: {
        error: error?.message ?? String(error),
        build_mode: buildMode,
        master_story_bible_pdf_url: body.master_story_bible_pdf_url ?? null
      }
    };

    return await postCallback(callbackPayload);
  }
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

  const packetBuildId = cleanString(body.packet_build_id);
  const projectId = cleanString(body.project_id);
  const title = cleanString(body.title);
  const buildMode = cleanString(
    body.build_mode,
    body.master_story_bible_pdf_url ? "pdf_url" : "text_extraction"
  );

  if (!packetBuildId || !projectId) {
    return json(400, {
      ok: false,
      error: "packet_build_id and project_id are required.",
      packet_build_id: packetBuildId,
      project_id: projectId
    });
  }

  const callbackResult = await runExtractionAndCallback(body);

  return json(callbackResult.ok ? 200 : 500, {
    ok: callbackResult.ok,
    accepted: true,
    packet_build_id: packetBuildId,
    project_id: projectId,
    title,
    build_mode: buildMode,
    callback_status: callbackResult.status,
    callback_preview: callbackResult.preview
  });
}
