function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
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

        if (!deviceToken) {
          return json({ ok: false, error: 'Missing deviceToken' }, 400)
        }

        const existingSession = await env.DB
          .prepare(`
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
          `)
          .bind(deviceToken)
          .first()

        if (existingSession) {
          return json({
            ok: true,
            session: existingSession,
          })
        }

        const event = await env.DB
          .prepare(`
            SELECT id, max_shots
            FROM events
            WHERE is_active = 1
            ORDER BY id DESC
            LIMIT 1
          `)
          .first()

        if (!event) {
          return json({ ok: false, error: 'No active event found' }, 404)
        }

        const sessionId = crypto.randomUUID()
        const now = new Date().toISOString()

        await env.DB
          .prepare(`
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
          `)
          .bind(
            sessionId,
            event.id,
            deviceToken,
            null,
            0,
            event.max_shots,
            'active',
            now,
            now
          )
          .run()

        const newSession = await env.DB
          .prepare(`
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
          `)
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
          500
        )
      }
    }

    if (url.pathname === '/api/photo/upload' && request.method === 'POST') {
      try {
        const formData = await request.formData()
        const sessionId = formData.get('sessionId')
        const file = formData.get('photo')

        if (!sessionId || typeof sessionId !== 'string') {
          return json({ ok: false, error: 'Missing sessionId' }, 400)
        }

        if (!(file instanceof File)) {
          return json({ ok: false, error: 'Missing photo file' }, 400)
        }

        const session = await env.DB
          .prepare(`
            SELECT
              id,
              event_id,
              shots_taken,
              shots_remaining,
              status
            FROM sessions
            WHERE id = ?
            LIMIT 1
          `)
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

        await env.DB
          .prepare(`
            INSERT INTO photos (
              id,
              event_id,
              session_id,
              r2_key,
              uploaded_at
            )
            VALUES (?, ?, ?, ?, ?)
          `)
          .bind(photoId, session.event_id, session.id, r2Key, now)
          .run()

        const newShotsTaken = session.shots_taken + 1
        const newShotsRemaining = Math.max(session.shots_remaining - 1, 0)
        const newStatus = newShotsRemaining === 0 ? 'completed' : 'active'

        await env.DB
          .prepare(`
            UPDATE sessions
            SET
              shots_taken = ?,
              shots_remaining = ?,
              status = ?,
              updated_at = ?
            WHERE id = ?
          `)
          .bind(newShotsTaken, newShotsRemaining, newStatus, now, session.id)
          .run()

        const updatedSession = await env.DB
          .prepare(`
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
          `)
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
          500
        )
      }
    }

    if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
      try {
        const participantsResult = await env.DB
          .prepare(`
            SELECT COUNT(*) as count
            FROM sessions
          `)
          .first()

        const photosResult = await env.DB
          .prepare(`
            SELECT COUNT(*) as count
            FROM photos
          `)
          .first()

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
          500
        )
      }
    }

    if (url.pathname === '/api/admin/photos' && request.method === 'GET') {
      try {
        const results = await env.DB
          .prepare(`
            SELECT
              id,
              event_id,
              session_id,
              r2_key,
              uploaded_at
            FROM photos
            ORDER BY uploaded_at DESC
          `)
          .all()

        const photos = (results.results || []).map((photo) => ({
          ...photo,
          imageUrl: `${url.origin}/api/admin/image?key=${encodeURIComponent(photo.r2_key)}`,
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
          500
        )
      }
    }

    if (url.pathname === '/api/admin/image' && request.method === 'GET') {
      try {
        const key = url.searchParams.get('key')

        if (!key) {
          return new Response('Missing key', { status: 400 })
        }

        const object = await env.PHOTOS.get(key)

        if (!object) {
          return new Response('Image not found', { status: 404 })
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Access-Control-Allow-Origin', '*')

        return new Response(object.body, {
          headers,
        })
      } catch {
        return new Response('Image fetch failed', { status: 500 })
      }
    }

    return notFound()
  },
}