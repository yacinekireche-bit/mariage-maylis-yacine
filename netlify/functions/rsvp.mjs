const response = (statusCode, data) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
  body: JSON.stringify(data),
});

const limited = (value, max) =>
  typeof value === "string" && value.trim().length <= max;

export function validateRsvp(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "Réponse invalide.";
  if (
    typeof data.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)
  ) return "Veuillez recharger la page.";
  if (!limited(data.name, 150) || data.name.trim().length < 2) return "Indiquez votre prénom et votre nom.";
  if (!limited(data.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return "Indiquez une adresse e-mail valide.";
  if (!["yes", "no"].includes(data.attending)) return "Précisez votre présence.";
  for (const [key, max] of Object.entries({
    phone: 40,
    companion: 150,
    childrenNames: 500,
    dietary: 1500,
    accessibility: 1000,
    message: 2000,
    website: 200,
  })) {
    if (!limited(data[key] ?? "", max)) return "Un des champs dépasse la longueur autorisée.";
  }
  if (data.consent !== true) return "Votre accord est nécessaire pour enregistrer la réponse.";
  if (
    typeof data.plusOne !== "boolean" ||
    !Number.isInteger(data.children) ||
    data.children < 0 ||
    data.children > 10
  ) return "Vérifiez le nombre de personnes.";
  if (!Array.isArray(data.events) || data.events.length) return "Réponse invalide.";
  if (data.attending === "yes") {
    if (data.plusOne && !(data.companion ?? "").trim()) return "Indiquez le nom de la personne qui vous accompagne.";
    if (data.children > 0 && !(data.childrenNames ?? "").trim()) return "Indiquez le prénom et le nom des enfants.";
  }
  return null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return response(405, { error: "Méthode non autorisée." });
  if (!event.headers["content-type"]?.includes("application/json")) return response(415, { error: "Format invalide." });
  if (!process.env.GOOGLE_SCRIPT_URL || !process.env.RSVP_SECRET) {
    return response(503, { error: "Le formulaire n’est pas encore configuré." });
  }

  let data;
  try {
    if (!event.body || event.body.length > 18000) throw new Error("invalid");
    data = JSON.parse(event.body);
  } catch {
    return response(400, { error: "Réponse invalide." });
  }

  const error = validateRsvp(data);
  if (error) return response(400, { error });
  if (data.website?.trim()) return response(400, { error: "Votre réponse n’a pas pu être envoyée." });

  try {
    const googleResponse = await fetch(process.env.GOOGLE_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: process.env.RSVP_SECRET, data }),
    });
    const result = await googleResponse.json();
    if (!googleResponse.ok || result.ok !== true) throw new Error("Google Sheets refused the request");
    return response(200, { ok: true, id: data.id });
  } catch (error) {
    console.error("RSVP forwarding failed", error?.name);
    return response(503, {
      error: "L’enregistrement est momentanément indisponible. Votre saisie est conservée : veuillez réessayer.",
    });
  }
}

