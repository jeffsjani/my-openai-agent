// netlify/functions/register-project-file.mjs

function getEnv(name) {
  try {
    if (typeof Netlify !== "undefined" && Netlify?.env?.get) {
      const value = Netlify.env.get(name);
      if (value) return value;
    }
  } catch {
    // Fall back to process.env.
  }

  return process.env?.[name] ?? null;
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

function cleanString(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeFilename(value, fallback = "uploaded-file.pdf") {
  const name = cleanString(value) || fallback;
  return name.replace(/[^\w.\- ()]/g, "_");
}

async function openaiFetch(path, options = {}) {
  const apiKey = getEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in Netlify environment variables.");
  }

  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `OpenAI API error ${response.status}: ${JSON.stringify(data).slice(0, 2000)}`
    );
  }

  return data;
}

async function createVectorStore({ project_id, project_title, file_role }) {
  return await openaiFetch("/vector_stores", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `${project_title || project_id || "Project"} — ${file_role || "Knowledge Base"}`,
      metadata: {
        project_id: project_id || "",
        project_title: project_title || "",
        file_role: file_role || ""
      }
    })
  });
}

async function uploadFileToOpenAI({ arrayBuffer, filename, contentType }) {
  const form = new FormData();

  const blob = new Blob([arrayBuffer], {
    type: contentType || "application/pdf"
  });

  form.append("purpose", "assistants");
  form.append("file", blob, filename);

  return await openaiFetch("/files", {
    method: "POST",
    body: form
  });
}

async function attachFileToVectorStore({ vector_store_id, openai_file_id, metadata }) {
  return await openaiFetch(`/vector_stores/${vector_store_id}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      file_id: openai_file_id,
      attributes: {
        project_id: metadata.project_id || "",
        project_title: metadata.project_title || "",
        file_role: metadata.file_role || "",
        original_file_name: metadata.original_file_name || "",
        content_version: metadata.content_version || "v1"
      }
    })
  });
}

async function pollVectorStoreFile({ vector_store_id, openai_file_id }) {
  const maxAttempts = 30;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const fileStatus = await openaiFetch(
      `/vector_stores/${vector_store_id}/files/${openai_file_id}`,
      { method: "GET" }
    );

    const status = fileStatus?.status;

    console.log("[register-project-file] vector store file status", {
      attempt,
      status
    });

    if (status === "completed") {
      return fileStatus;
    }

    if (status === "failed" || status === "cancelled") {
      throw new Error(
        `Vector store file processing ${status}: ${JSON.stringify(fileStatus).slice(0, 2000)}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Timed out waiting for vector store file processing.");
}

export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return json(
        {
          ok: false,
          error: "Method not allowed. Use POST."
        },
        405
      );
    }

    const body = await req.json();

    const project_id = cleanString(body.project_id);
    const project_title = cleanString(body.project_title) || cleanString(body.title);
    const file_role = cleanString(body.file_role) || "master_story_bible";
    const source_file_url = cleanString(body.source_file_url);
    const original_file_name = sanitizeFilename(
      body.original_file_name,
      `${project_title || project_id || "project"}-${file_role}.pdf`
    );
    const content_version = cleanString(body.content_version) || "v1";

    let vector_store_id =
      cleanString(body.vector_store_id) ||
      cleanString(body.existing_vector_store_id) ||
      cleanString(getEnv("DEFAULT_VECTOR_STORE_ID"));

    if (!project_id) {
      return json(
        {
          ok: false,
          error: "project_id is required"
        },
        400
      );
    }

    if (!source_file_url) {
      return json(
        {
          ok: false,
          error: "source_file_url is required"
        },
        400
      );
    }

    console.log("[register-project-file] downloading source file", {
      project_id,
      file_role,
      source_file_url,
      original_file_name
    });

    const sourceResponse = await fetch(source_file_url);

    if (!sourceResponse.ok) {
      return json(
        {
          ok: false,
          error: `Could not download source file. HTTP ${sourceResponse.status}`
        },
        400
      );
    }

    const contentType =
      sourceResponse.headers.get("content-type") || "application/pdf";

    const arrayBuffer = await sourceResponse.arrayBuffer();
    const file_size_bytes = arrayBuffer.byteLength;

    if (!vector_store_id) {
      console.log("[register-project-file] creating vector store");

      const vectorStore = await createVectorStore({
        project_id,
        project_title,
        file_role
      });

      vector_store_id = vectorStore.id;
    }

    console.log("[register-project-file] uploading file to OpenAI");

    const openaiFile = await uploadFileToOpenAI({
      arrayBuffer,
      filename: original_file_name,
      contentType
    });

    console.log("[register-project-file] attaching file to vector store", {
      vector_store_id,
      openai_file_id: openaiFile.id
    });

    const vectorStoreFile = await attachFileToVectorStore({
      vector_store_id,
      openai_file_id: openaiFile.id,
      metadata: {
        project_id,
        project_title,
        file_role,
        original_file_name,
        content_version
      }
    });

    const finalVectorStoreFile = await pollVectorStoreFile({
      vector_store_id,
      openai_file_id: openaiFile.id
    });

    return json({
      ok: true,
      project_id,
      project_title,
      file_role,
      source_file_url,
      original_file_name,
      openai_file_id: openaiFile.id,
      openai_file_name: openaiFile.filename,
      vector_store_id,
      vector_store_file_id: finalVectorStoreFile.id ?? vectorStoreFile.id ?? openaiFile.id,
      vector_store_file_status: finalVectorStoreFile.status,
      file_size_bytes,
      content_version,
      uploaded_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("[register-project-file] failed", error);

    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}
