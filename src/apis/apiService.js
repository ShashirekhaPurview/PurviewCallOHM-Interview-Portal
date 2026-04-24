const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL   || ''
const AGENT_BASE_URL = import.meta.env.VITE_AGENT_BASE_URL || ''
const AGENT_ID       = import.meta.env.VITE_AGENT_ID       || ''
const XI_API_KEY     = import.meta.env.VITE_XI_API_KEY     || ''

// ── Internal helper ───────────────────────────────────────────────────────────
async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'xi-api-key': XI_API_KEY,
      ...options.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || `Request failed with status ${res.status}`)
  }

  return res.json()
}

// ── Application ───────────────────────────────────────────────────────────────

/**
 * Validates the candidate's application ID.
 * POST /recruitment/agents/round2/validate/{applicationId}
 *
 * @param {string} applicationId
 * @returns {{ detail: string } | object}
 */
export async function validateApplication(applicationId) {
  return request(`${BACKEND_URL}/recruitment/agents/round2/validate/${applicationId}`, {
    method: 'POST',
  })
}

// ── Agent ─────────────────────────────────────────────────────────────────────

/**
 * Fetches a signed URL for the AI agent conversation iframe.
 * GET /redirect/v1/convai/conversation/get_signed_url?agent_id=AGENT_ID
 *
 * @returns {{ signed_url: string }}
 */
export async function getAgentSignedUrl() {
  const res = await fetch(
    `${AGENT_BASE_URL}/redirect/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': XI_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) throw new Error('Failed to fetch agent signed URL')
  return res.json()
}

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * Marks the session as started (one-time lock).
 *
 * @param {string} applicationId
 */
export async function startSession(applicationId) {
  return request(`${BACKEND_URL}/recruitment/agents/round2/session/start/${applicationId}`, {
    method: 'POST',
  })
}

/**
 * Records a violation event during the interview.
 *
 * @param {string} applicationId
 * @param {{ type: string, message: string, timestamp: string }} violation
 */
export async function reportViolation(applicationId, violation) {
  return request(`${BACKEND_URL}/recruitment/agents/round2/session/violation/${applicationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(violation),
  })
}

/**
 * Ends the interview session (manual exit or auto-termination).
 *
 * @param {string} applicationId
 * @param {'completed' | 'terminated' | 'exited'} reason
 */
export async function endSession(applicationId, reason) {
  return request(`${BACKEND_URL}/recruitment/agents/round2/session/end/${applicationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
}
