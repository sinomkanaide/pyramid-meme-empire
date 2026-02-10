const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// ========== PKCE HELPERS ==========
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

async function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates) {
    if (now > val.expiresAt) oauthStates.delete(key);
  }
}, 600000);

// ========== TWITTER OAuth 2.0 with PKCE ==========

// GET /oauth/twitter/connect - Redirect user to Twitter authorization
router.get('/twitter/connect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const origin = req.query.origin || 'https://tapkamun.fun';

    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    oauthStates.set(state, {
      userId,
      codeVerifier,
      origin,
      platform: 'twitter',
      expiresAt: Date.now() + 600000
    });

    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_CALLBACK_URL;
    const scope = 'tweet.read users.read';

    // Build URL manually to ensure correct encoding (%20 not +)
    const url = `https://twitter.com/i/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    console.log(`[Twitter OAuth] User: ${userId}`);
    console.log(`[Twitter OAuth] Client ID: ${clientId?.slice(0, 8)}...`);
    console.log(`[Twitter OAuth] Redirect URI: ${redirectUri}`);
    console.log(`[Twitter OAuth] Scope: ${scope}`);
    console.log(`[Twitter OAuth] URL: ${url.slice(0, 120)}...`);

    res.json({ url });
  } catch (error) {
    console.error('[OAuth] Twitter connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Twitter connection' });
  }
});

// GET /oauth/twitter/callback - Handle Twitter callback
router.get('/twitter/callback', async (req, res) => {
  console.log(`[Twitter OAuth] Callback received:`, { code: req.query.code?.slice(0, 10), state: req.query.state?.slice(0, 10), error: req.query.error });
  const { code, state, error: oauthError } = req.query;

  const storedState = oauthStates.get(state);
  if (!storedState || storedState.platform !== 'twitter') {
    return res.redirect(`${storedState?.origin || 'https://tapkamun.fun'}?twitter=error&reason=invalid_state`);
  }

  const { userId, codeVerifier, origin } = storedState;
  oauthStates.delete(state);

  if (oauthError || !code) {
    console.log(`[OAuth] Twitter cancelled by user ${userId}`);
    return res.redirect(`${origin}?twitter=cancelled`);
  }

  try {
    // Exchange code for access token
    const credentials = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TWITTER_CALLBACK_URL,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.text();
      console.error('[OAuth] Twitter token exchange failed:', errData);
      return res.redirect(`${origin}?twitter=error&reason=token_exchange`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('[OAuth] Twitter user info failed');
      return res.redirect(`${origin}?twitter=error&reason=user_info`);
    }

    const userData = await userResponse.json();
    const twitterId = userData.data.id;
    const twitterUsername = userData.data.username;

    // Save to DB (only id + username, NOT access token)
    await db.query(
      `UPDATE users SET twitter_id = $1, twitter_username = $2, updated_at = NOW() WHERE id = $3`,
      [twitterId, twitterUsername, userId]
    );

    console.log(`[OAuth] Twitter connected: @${twitterUsername} for user ${userId}`);
    res.redirect(`${origin}?twitter=connected&username=${encodeURIComponent(twitterUsername)}`);
  } catch (error) {
    console.error('[OAuth] Twitter callback error:', error);
    res.redirect(`${origin}?twitter=error&reason=server_error`);
  }
});

// GET /oauth/twitter/status - Check if Twitter is connected
router.get('/twitter/status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT twitter_id, twitter_username FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    res.json({
      connected: !!user?.twitter_id,
      username: user?.twitter_username || null,
    });
  } catch (error) {
    console.error('[OAuth] Twitter status error:', error);
    res.status(500).json({ error: 'Failed to check Twitter status' });
  }
});

// POST /oauth/twitter/disconnect - Remove Twitter connection
router.post('/twitter/disconnect', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET twitter_id = NULL, twitter_username = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    console.log(`[OAuth] Twitter disconnected for user ${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[OAuth] Twitter disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Twitter' });
  }
});

// ========== DISCORD OAuth 2.0 ==========

// GET /oauth/discord/connect - Redirect user to Discord authorization
router.get('/discord/connect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const origin = req.query.origin || 'https://tapkamun.fun';

    const state = crypto.randomBytes(16).toString('hex');

    oauthStates.set(state, {
      userId,
      origin,
      platform: 'discord',
      expiresAt: Date.now() + 600000
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_CALLBACK_URL,
      scope: 'identify',
      state,
    });

    console.log(`[OAuth] Discord connect initiated for user ${userId}`);
    res.json({
      url: `https://discord.com/api/oauth2/authorize?${params.toString()}`
    });
  } catch (error) {
    console.error('[OAuth] Discord connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Discord connection' });
  }
});

// GET /oauth/discord/callback - Handle Discord callback
router.get('/discord/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  const storedState = oauthStates.get(state);
  if (!storedState || storedState.platform !== 'discord') {
    return res.redirect(`${storedState?.origin || 'https://tapkamun.fun'}?discord=error&reason=invalid_state`);
  }

  const { userId, origin } = storedState;
  oauthStates.delete(state);

  if (oauthError || !code) {
    console.log(`[OAuth] Discord cancelled by user ${userId}`);
    return res.redirect(`${origin}?discord=cancelled`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DISCORD_CALLBACK_URL,
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.text();
      console.error('[OAuth] Discord token exchange failed:', errData);
      return res.redirect(`${origin}?discord=error&reason=token_exchange`);
    }

    const tokenData = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('[OAuth] Discord user info failed');
      return res.redirect(`${origin}?discord=error&reason=user_info`);
    }

    const userData = await userResponse.json();
    const discordId = userData.id;
    const discordUsername = userData.global_name || userData.username;

    // Save to DB (only id + username, NOT access token)
    await db.query(
      `UPDATE users SET discord_id = $1, discord_username = $2, updated_at = NOW() WHERE id = $3`,
      [discordId, discordUsername, userId]
    );

    console.log(`[OAuth] Discord connected: ${discordUsername} for user ${userId}`);
    res.redirect(`${origin}?discord=connected&username=${encodeURIComponent(discordUsername)}`);
  } catch (error) {
    console.error('[OAuth] Discord callback error:', error);
    res.redirect(`${origin}?discord=error&reason=server_error`);
  }
});

// GET /oauth/discord/status - Check if Discord is connected
router.get('/discord/status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT discord_id, discord_username FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    res.json({
      connected: !!user?.discord_id,
      username: user?.discord_username || null,
    });
  } catch (error) {
    console.error('[OAuth] Discord status error:', error);
    res.status(500).json({ error: 'Failed to check Discord status' });
  }
});

// POST /oauth/discord/disconnect - Remove Discord connection
router.post('/discord/disconnect', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET discord_id = NULL, discord_username = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );
    console.log(`[OAuth] Discord disconnected for user ${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[OAuth] Discord disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Discord' });
  }
});

// ========== COMBINED STATUS ==========

// GET /oauth/status - Get all connected accounts at once
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT twitter_id, twitter_username, discord_id, discord_username FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    res.json({
      twitter: {
        connected: !!user?.twitter_id,
        username: user?.twitter_username || null,
      },
      discord: {
        connected: !!user?.discord_id,
        username: user?.discord_username || null,
      },
    });
  } catch (error) {
    console.error('[OAuth] Status error:', error);
    res.status(500).json({ error: 'Failed to check connected accounts' });
  }
});

module.exports = router;
