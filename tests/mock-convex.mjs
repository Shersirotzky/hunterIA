import { createServer } from "node:http";

let expiresAt = null;
const state = "e".repeat(64);
createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const { path, args } = JSON.parse(Buffer.concat(chunks).toString());
    let value;
    switch (path.replace(/\.js:/, ":")) {
      case "auth:isAuthenticated":
        value = Boolean(request.headers.authorization);
        break;
      case "linkedin:status":
        value = { expiresAt };
        break;
      case "linkedin:disconnect":
        expiresAt = null;
        value = null;
        break;
      case "linkedinOAuth:start": {
        const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
        url.search = new URLSearchParams({
          redirect_uri: `${args[0].origin}/api/auth/linkedin/callback`, scope: "openid", state,
        }).toString();
        value = { url: url.toString(), state };
        break;
      }
      case "linkedinOAuth:complete":
        if (args[0].state !== state) value = "invalid_state";
        else if (args[0].error === "access_denied") value = "cancelled";
        else if (args[0].code === "ok") {
          expiresAt = Date.now() + 60_000;
          value = "connected";
        } else value = "provider";
        break;
      default:
        response.writeHead(400).end();
        return;
    }
    response.writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ status: "success", value, logLines: [] }));
  } catch {
    response.writeHead(request.method === "GET" ? 200 : 400).end();
  }
}).listen(3210, "127.0.0.1");
