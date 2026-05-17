export async function handler(event) {
  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed. Use POST."
      })
    };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Invalid JSON body."
      })
    };
  }

  return {
    statusCode: 202,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      accepted: true,
      message: "Project Bible packet background worker reached.",
      packet_build_id: body.packet_build_id ?? null,
      project_id: body.project_id ?? null,
      build_mode: body.build_mode ?? null
    })
  };
}
