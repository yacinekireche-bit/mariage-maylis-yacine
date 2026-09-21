import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { handler } from "../netlify/functions/rsvp.mjs";

const valid = () => ({
  id: crypto.randomUUID(),
  name: "Invité Test",
  email: "invite@example.com",
  phone: "",
  attending: "yes",
  plusOne: true,
  companion: "Accompagnant Test",
  children: 1,
  childrenNames: "Enfant Test",
  events: [],
  dietary: "Sans noix",
  accessibility: "",
  message: "À bientôt",
  website: "",
  consent: true,
});

test("rejects invalid payloads", async () => {
  process.env.GOOGLE_SCRIPT_URL = "http://127.0.0.1:1";
  process.env.RSVP_SECRET = "test";
  const result = await handler({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...valid(), email: "incorrect" }),
  });
  assert.equal(result.statusCode, 400);
});

test("forwards a valid RSVP with the server secret", async (context) => {
  let forwarded;
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    forwarded = JSON.parse(Buffer.concat(chunks).toString());
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  process.env.GOOGLE_SCRIPT_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.RSVP_SECRET = "server-only-secret";

  const data = valid();
  const result = await handler({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(forwarded.secret, "server-only-secret");
  assert.equal(forwarded.data.id, data.id);
});

