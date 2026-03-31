function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  })
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      ...corsHeaders(),
    },
  })
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  })
}

const ADMIN_USERNAME = 'a-n'
const ADMIN_PASSWORD = '4-4-26'

/**
 * Single source of truth for admin unlock time.
 * This is set in UK time, and all maths/display derive from it.
 *
 * Example:
 * ceremony starts at 3:30pm on 05.04.2026
 * Change this before launch!! x
 */
const UNLOCK_SCHEDULE = {
  year: 2026,
  month: 3,
  day: 22,
  hour: 14,
  minute: 30,
  second: 0,
  timeZone: 'Europe/London',
}

function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th'

  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/**
 * Converts a date/time that should be interpreted in a specific timezone
 * into a real UTC Date object.
 */
function zonedDateTimeToUtc({ year, month, day, hour, minute, second = 0 }, timeZone) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(utcGuess)
  const map = {}

  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value
    }
  }

  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )

  const offset = asIfUtc - utcGuess.getTime()

  return new Date(utcGuess.getTime() - offset)
}

function getUnlockDate() {
  return zonedDateTimeToUtc(UNLOCK_SCHEDULE, UNLOCK_SCHEDULE.timeZone)
}

function formatUnlockDate(date) {
  const timeZone = UNLOCK_SCHEDULE.timeZone

  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone,
  }).format(date)

  const month = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    timeZone,
  }).format(date)

  const day = Number(
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      timeZone,
    }).format(date),
  )

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date)

  return `${weekday} ${day}${getOrdinalSuffix(day)} ${month} at ${time}`
}

function getUnlockState() {
  const now = new Date()
  const unlockAt = getUnlockDate()
  const remainingMs = Math.max(unlockAt.getTime() - now.getTime(), 0)

  return {
    unlockAt: unlockAt.toISOString(),
    unlockAtFormatted: formatUnlockDate(unlockAt),
    now: now.toISOString(),
    unlocked: remainingMs <= 0,
    remainingMs,
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return corsPreflight()
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({
        ok: true,
        hasDb: !!env.DB,
        hasPhotosBucket: !!env.PHOTOS,
      })
    }

    if (url.pathname === '/api/session/start' && request.method === 'POST') {
      try {
        const body = await request.json()
        const deviceToken = body?.deviceToken
        const requestedMaxShots = Number(body?.maxShots || 25)
        const maxShots = requestedMaxShots === 100 ? 100 : 25
    
        if (!deviceToken) {
          return json({ ok: false, error: 'Missing deviceToken' }, 400)
        }
    
        const existingSession = await env.DB.prepare(
          `
            SELECT
              id,
              event_id,
              device_token,
              guest_name,
              shots_taken,
              shots_remaining,
              status,
              created_at,
              updated_at
            FROM sessions
            WHERE device_token = ?
            LIMIT 1
          `,
        )
          .bind(deviceToken)
          .first()
    
        if (existingSession) {
          return json({
            ok: true,
            session: existingSession,
          })
        }
    
        const event = await env.DB.prepare(
          `
            SELECT id, max_shots
            FROM events
            WHERE is_active = 1
            ORDER BY id DESC
            LIMIT 1
          `,
        ).first()
    
        if (!event) {
          return json({ ok: false, error: 'No active event found' }, 404)
        }
    
        const sessionId = crypto.randomUUID()
        const now = new Date().toISOString()
    
        await env.DB.prepare(
          `
            INSERT INTO sessions (
              id,
              event_id,
              device_token,
              guest_name,
              shots_taken,
              shots_remaining,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(sessionId, event.id, deviceToken, null, 0, maxShots, 'active', now, now)
          .run()
    
        const newSession = await env.DB.prepare(
          `
            SELECT
              id,
              event_id,
              device_token,
              guest_name,
              shots_taken,
              shots_remaining,
              status,
              created_at,
              updated_at
            FROM sessions
            WHERE id = ?
            LIMIT 1
          `,
        )
          .bind(sessionId)
          .first()
    
        return json({
          ok: true,
          session: newSession,
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/photo/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData()
        const sessionId = formData.get('sessionId')
        const file = formData.get('photo')
        const thumbnailFile = formData.get('thumbnail')

        if (!sessionId || typeof sessionId !== 'string') {
          return json({ ok: false, error: 'Missing sessionId' }, 400)
        }

        if (!(file instanceof File)) {
          return json({ ok: false, error: 'Missing photo file' }, 400)
        }

        const session = await env.DB.prepare(
          `
            SELECT
              id,
              event_id,
              shots_taken,
              shots_remaining,
              status
            FROM sessions
            WHERE id = ?
            LIMIT 1
          `,
        )
          .bind(sessionId)
          .first()

        if (!session) {
          return json({ ok: false, error: 'Session not found' }, 404)
        }

        if (session.shots_remaining <= 0 || session.status !== 'active') {
          return json({ ok: false, error: 'No shots remaining' }, 400)
        }

        const photoId = crypto.randomUUID()
        const now = new Date().toISOString()
        const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
        const safeExtension = extension || 'jpg'
        const r2Key = `event-${session.event_id}/session-${session.id}/${photoId}.${safeExtension}`

        await env.PHOTOS.put(r2Key, file.stream(), {
          httpMetadata: {
            contentType: file.type || 'image/jpeg',
          },
        })

        let thumbnailR2Key = null
        if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
          thumbnailR2Key = `thumb/event-${session.event_id}/session-${session.id}/${photoId}.jpg`
          await env.PHOTOS.put(thumbnailR2Key, thumbnailFile.stream(), {
            httpMetadata: {
              contentType: 'image/jpeg',
            },
          })
        }

        await env.DB.prepare(
          `
            INSERT INTO photos (
              id,
              event_id,
              session_id,
              r2_key,
              thumbnail_r2_key,
              uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(photoId, session.event_id, session.id, r2Key, thumbnailR2Key, now)
          .run()

        const newShotsTaken = session.shots_taken + 1
        const newShotsRemaining = Math.max(session.shots_remaining - 1, 0)
        const newStatus = newShotsRemaining === 0 ? 'completed' : 'active'

        await env.DB.prepare(
          `
            UPDATE sessions
            SET
              shots_taken = ?,
              shots_remaining = ?,
              status = ?,
              updated_at = ?
            WHERE id = ?
          `,
        )
          .bind(newShotsTaken, newShotsRemaining, newStatus, now, session.id)
          .run()

        const updatedSession = await env.DB.prepare(
          `
            SELECT
              id,
              event_id,
              device_token,
              guest_name,
              shots_taken,
              shots_remaining,
              status,
              created_at,
              updated_at
            FROM sessions
            WHERE id = ?
            LIMIT 1
          `,
        )
          .bind(session.id)
          .first()

        return json({
          ok: true,
          photo: {
            id: photoId,
            r2_key: r2Key,
          },
          session: updatedSession,
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      try {
        const body = await request.json()
        const username = body?.username
        const password = body?.password
        const devBypass = body?.devBypass === true
        const unlockState = getUnlockState()

        if (devBypass) {
          return json({
            ok: true,
            authenticated: true,
            unlocked: true,
            unlockAt: unlockState.unlockAt,
            unlockAtFormatted: unlockState.unlockAtFormatted,
            remainingMs: 0,
          })
        }

        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
          return json({ ok: false, error: 'Invalid login details' }, 401)
        }

        return json({
          ok: true,
          authenticated: true,
          unlocked: unlockState.unlocked,
          unlockAt: unlockState.unlockAt,
          unlockAtFormatted: unlockState.unlockAtFormatted,
          remainingMs: unlockState.remainingMs,
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/admin/status' && request.method === 'GET') {
      try {
        const devBypass = url.searchParams.get('dev') === '1'
        const unlockState = getUnlockState()
    
        return json({
          ok: true,
          authenticated: devBypass,
          unlocked: devBypass ? true : unlockState.unlocked,
          unlockAt: unlockState.unlockAt,
          unlockAtFormatted: unlockState.unlockAtFormatted,
          remainingMs: devBypass ? 0 : unlockState.remainingMs,
          now: unlockState.now,
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
      try {
        const participantsResult = await env.DB.prepare(
          `
            SELECT COUNT(*) as count
            FROM sessions
          `,
        ).first()

        const photosResult = await env.DB.prepare(
          `
            SELECT COUNT(*) as count
            FROM photos
          `,
        ).first()

        return json({
          ok: true,
          participants: Number(participantsResult?.count || 0),
          photos: Number(photosResult?.count || 0),
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/admin/photos' && request.method === 'GET') {
      try {
        const results = await env.DB.prepare(
          `
            SELECT
              id,
              event_id,
              session_id,
              r2_key,
              thumbnail_r2_key,
              uploaded_at
            FROM photos
            ORDER BY uploaded_at DESC
          `,
        ).all()

        const photos = (results.results || []).map((photo) => ({
          ...photo,
          imageUrl: `${url.origin}/api/admin/image?key=${encodeURIComponent(photo.r2_key)}`,
          thumbnailUrl: photo.thumbnail_r2_key
            ? `${url.origin}/api/admin/image?key=${encodeURIComponent(photo.thumbnail_r2_key)}`
            : null,
        }))

        return json({
          ok: true,
          photos,
        })
      } catch (error) {
        return json(
          {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          500,
        )
      }
    }

    if (url.pathname === '/api/admin/image' && request.method === 'GET') {
      try {
        const key = url.searchParams.get('key')

        if (!key) {
          return textResponse('Missing key', 400)
        }

        const object = await env.PHOTOS.get(key)

        if (!object) {
          return textResponse('Image not found', 404)
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Access-Control-Allow-Origin', '*')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')

        return new Response(object.body, {
          headers,
        })
      } catch {
        return textResponse('Image fetch failed', 500)
      }
    }

    return textResponse('Not found', 404)
  },
}