import express from "express";
import crypto from "crypto";
import { verifyUser } from "../middleware/auth.js";
import { db } from "../config/firebaseAdmin.js";
import { encryptSecret } from "../utils/crypto.js";
import { BUILTIN_CONNECTORS, listBuiltinConnectorsMeta } from "../services/connectorRegistry.js";

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// In-memory OAuth state store (short-lived, dev-friendly). For multi-instance
// deployments, move this to Firestore/Redis keyed by state.
const pendingStates = new Map();

/* ── GET /api/connectors — list built-ins + connection status + custom ── */
router.get("/", verifyUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    const [connectedSnap, customSnap] = await Promise.all([
      db.collection("users").doc(uid).collection("connectors").get(),
      db.collection("users").doc(uid).collection("customConnectors").get(),
    ]);

    const connectedIds = new Set(connectedSnap.docs.map((d) => d.id));

    const builtin = listBuiltinConnectorsMeta().map((c) => ({
      ...c,
      connected: connectedIds.has(c.id),
    }));

    const custom = customSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      description: d.data().description || "",
      baseUrl: d.data().baseUrl,
      authType: d.data().authType,
      createdAt: d.data().createdAt || null,
    }));

    res.json({ builtin, custom });
  } catch (err) {
    console.error("Failed to list connectors:", err);
    res.status(500).json({ error: "Failed to load connectors." });
  }
});

/* ── GET /api/connectors/oauth/:provider/start ── */
router.get("/oauth/:provider/start", verifyUser, (req, res) => {
  const provider = BUILTIN_CONNECTORS[req.params.provider];
  if (!provider) return res.status(404).json({ error: "Unknown connector." });
  if (!provider.configured()) {
    return res.status(400).json({
      error: `${provider.name} isn't configured yet. Add ${provider.id.toUpperCase()}_CLIENT_ID / _SECRET to backend/.env.`,
    });
  }

  const state = crypto.randomBytes(20).toString("hex");
  pendingStates.set(state, { uid: req.user.uid, provider: provider.id, ts: Date.now() });
  // expire stale states after 10 min
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: provider.clientId(),
    redirect_uri: provider.redirectUri,
    scope: provider.scopes.join(" "),
    state,
    response_type: "code",
    ...(provider.extraAuthParams || {}),
  });

  res.json({ url: `${provider.authUrl}?${params.toString()}` });
});

/* ── GET /api/connectors/oauth/:provider/callback ── */
router.get("/oauth/:provider/callback", async (req, res) => {
  const provider = BUILTIN_CONNECTORS[req.params.provider];
  const { code, state, error } = req.query;

  if (error) return res.redirect(`${FRONTEND_URL}/?connector_error=${encodeURIComponent(error)}`);

  const pending = pendingStates.get(state);
  if (!provider || !pending) {
    return res.redirect(`${FRONTEND_URL}/?connector_error=invalid_state`);
  }
  pendingStates.delete(state);

  try {
    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: provider.clientId(),
        client_secret: provider.clientSecret(),
        code,
        redirect_uri: provider.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    await db
      .collection("users")
      .doc(pending.uid)
      .collection("connectors")
      .doc(provider.id)
      .set({
        provider: provider.id,
        accessTokenEnc: encryptSecret(tokenData.access_token),
        refreshTokenEnc: tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : null,
        connectedAt: new Date().toISOString(),
      });

    res.redirect(`${FRONTEND_URL}/?connector_connected=${provider.id}`);
  } catch (err) {
    console.error(`${provider.id} OAuth callback failed:`, err);
    res.redirect(`${FRONTEND_URL}/?connector_error=${encodeURIComponent(err.message)}`);
  }
});

/* ── DELETE /api/connectors/:id — disconnect a built-in connector ── */
router.delete("/:id", verifyUser, async (req, res) => {
  try {
    await db.collection("users").doc(req.user.uid).collection("connectors").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to disconnect connector:", err);
    res.status(500).json({ error: "Failed to disconnect." });
  }
});

/* ── Custom connectors CRUD ── */
router.post("/custom", verifyUser, async (req, res) => {
  try {
    const { name, description, baseUrl, authType, headerName, secret } = req.body;
    if (!name || !baseUrl) return res.status(400).json({ error: "name and baseUrl are required." });
    if (!["none", "api_key", "bearer", "basic"].includes(authType)) {
      return res.status(400).json({ error: "Invalid authType." });
    }
    try {
      new URL(baseUrl);
    } catch {
      return res.status(400).json({ error: "baseUrl must be a valid URL." });
    }

    const ref = db.collection("users").doc(req.user.uid).collection("customConnectors").doc();
    await ref.set({
      name,
      description: description || "",
      baseUrl,
      authType,
      headerName: headerName || null,
      secretEnc: secret ? encryptSecret(secret) : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ id: ref.id });
  } catch (err) {
    console.error("Failed to create custom connector:", err);
    res.status(500).json({ error: "Failed to create connector." });
  }
});

router.put("/custom/:id", verifyUser, async (req, res) => {
  try {
    const { name, description, baseUrl, authType, headerName, secret } = req.body;
    const ref = db.collection("users").doc(req.user.uid).collection("customConnectors").doc(req.params.id);
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (baseUrl !== undefined) patch.baseUrl = baseUrl;
    if (authType !== undefined) patch.authType = authType;
    if (headerName !== undefined) patch.headerName = headerName;
    if (secret) patch.secretEnc = encryptSecret(secret);
    await ref.update(patch);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to update custom connector:", err);
    res.status(500).json({ error: "Failed to update connector." });
  }
});

router.delete("/custom/:id", verifyUser, async (req, res) => {
  try {
    await db.collection("users").doc(req.user.uid).collection("customConnectors").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete custom connector:", err);
    res.status(500).json({ error: "Failed to delete connector." });
  }
});

export default router;