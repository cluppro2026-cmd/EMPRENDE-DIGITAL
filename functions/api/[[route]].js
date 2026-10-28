export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Asegurar que exista la tabla settings
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `).run();

    if (path === "/api/data" && request.method === "GET") {
      const { results: services } = await env.DB.prepare("SELECT * FROM services ORDER BY created_at DESC").all();
      const { results: reviews } = await env.DB.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all();
      const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
      
      let profilePhoto = "";
      settings.forEach(s => {
        if (s.key === 'profile_photo') profilePhoto = s.value;
      });

      return Response.json({ services, reviews, profilePhoto }, { headers: corsHeaders });
    }

    if (path === "/api/settings" && request.method === "POST") {
      const pin = request.headers.get("X-Admin-Pin");
      if (pin !== "1234") {
        return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401, headers: corsHeaders });
      }

      const { key, value } = await request.json();
      await env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?"
      ).bind(key, value, value).run();

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/services" && request.method === "POST") {
      const pin = request.headers.get("X-Admin-Pin");
      if (pin !== "1234") {
        return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401, headers: corsHeaders });
      }

      const { title, description, icon } = await request.json();
      const id = Date.now().toString();
      await env.DB.prepare(
        "INSERT INTO services (id, title, description, icon, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, title, description, icon || "fa-code", Date.now()).run();

      return Response.json({ success: true, id }, { headers: corsHeaders });
    }

    if (path.startsWith("/api/services/") && request.method === "DELETE") {
      const pin = request.headers.get("X-Admin-Pin");
      if (pin !== "1234") {
        return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401, headers: corsHeaders });
      }

      const id = path.split("/").pop();
      await env.DB.prepare("DELETE FROM services WHERE id = ?").bind(id).run();

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (path === "/api/reviews" && request.method === "POST") {
      const { name, rating, text } = await request.json();
      const id = Date.now().toString();
      await env.DB.prepare(
        "INSERT INTO reviews (id, name, rating, text, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, name, rating, text, Date.now()).run();

      return Response.json({ success: true, id }, { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
