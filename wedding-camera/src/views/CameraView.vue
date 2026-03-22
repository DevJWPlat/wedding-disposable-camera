<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { API_BASE_URL } from '../utils/api.js'
import { generateId } from '../utils/id.js'

const router = useRouter()

const videoRef = ref(null)
const canvasRef = ref(null)
const fileInput = ref(null)

const shotsRemaining = ref(25)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const session = ref(null)

const cameraReady = ref(false)
const usingFallbackCapture = ref(false)
const previewMessage = ref('Starting camera preview...')
const streamRef = ref(null)

const STORAGE_KEYS = {
  deviceToken: 'wedding_camera_device_token',
  sessionId: 'wedding_camera_session_id',
}

const previousShotNumber = computed(() => {
  return shotsRemaining.value < 25 ? shotsRemaining.value + 1 : null
})

const nextShotNumber = computed(() => {
  return shotsRemaining.value > 0 ? shotsRemaining.value - 1 : null
})

async function parseJsonResponse(response) {
  const text = await response.text()

  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text || 'Invalid server response')
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`)
  }

  return data
}

function getDeviceToken() {
  let token = localStorage.getItem(STORAGE_KEYS.deviceToken)

  if (!token) {
    token = generateId()
    localStorage.setItem(STORAGE_KEYS.deviceToken, token)
  }

  return token
}

function storeSessionId(sessionId) {
  localStorage.setItem(STORAGE_KEYS.sessionId, sessionId)
}

async function startSession() {
  loading.value = true
  error.value = ''

  try {
    const deviceToken = getDeviceToken()

    const response = await fetch(`${API_BASE_URL}/api/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceToken }),
    })

    const data = await parseJsonResponse(response)

    if (!data?.ok || !data?.session) {
      throw new Error(data?.error || 'Failed to start session')
    }

    session.value = data.session
    shotsRemaining.value = Number(data.session.shots_remaining || 0)
    storeSessionId(data.session.id)

    if (shotsRemaining.value <= 0) {
      router.push('/finished')
    }
  } catch (err) {
    error.value = err.message || 'Something went wrong'
    console.error('startSession failed:', err)
  } finally {
    loading.value = false
  }
}

async function startLiveCamera() {
  previewMessage.value = 'Starting camera preview...'
  cameraReady.value = false
  usingFallbackCapture.value = false

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    previewMessage.value = 'Camera preview unavailable'
    usingFallbackCapture.value = true
    return
  }

  try {
    stopLiveCamera()

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
      },
      audio: false,
    })

    streamRef.value = stream

    if (!videoRef.value) {
      previewMessage.value = 'Camera preview unavailable'
      usingFallbackCapture.value = true
      return
    }

    videoRef.value.srcObject = stream
    videoRef.value.setAttribute('playsinline', 'true')
    videoRef.value.muted = true

    await videoRef.value.play()

    cameraReady.value = true
    usingFallbackCapture.value = false
    previewMessage.value = ''
  } catch (err) {
    console.error('Live camera failed, using fallback:', err)

    cameraReady.value = false
    usingFallbackCapture.value = true

    if (err?.name === 'NotAllowedError') {
      previewMessage.value = 'Camera permission was denied'
    } else {
      previewMessage.value = 'Camera preview unavailable'
    }
  }
}

function stopLiveCamera() {
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((track) => track.stop())
    streamRef.value = null
  }

  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

async function uploadBlob(blob, filename = 'capture.jpg') {
  if (!session.value?.id) {
    throw new Error('No active session found')
  }

  const file = new File([blob], filename, {
    type: blob.type || 'image/jpeg',
  })

  const formData = new FormData()
  formData.append('sessionId', session.value.id)
  formData.append('photo', file)

  const response = await fetch(`${API_BASE_URL}/api/photo/upload`, {
    method: 'POST',
    body: formData,
  })

  const data = await parseJsonResponse(response)

  if (!data?.ok || !data?.session) {
    throw new Error(data?.error || 'Upload failed')
  }

  session.value = data.session
  shotsRemaining.value = Number(data.session.shots_remaining || 0)

  if ('vibrate' in navigator) {
    navigator.vibrate(50)
  }

  if (shotsRemaining.value <= 0) {
    router.push('/finished')
  }
}

async function capturePhoto() {
  if (shotsRemaining.value <= 0 || loading.value || uploading.value) return

  if (usingFallbackCapture.value || !cameraReady.value) {
    fileInput.value?.click()
    return
  }

  if (!videoRef.value || !canvasRef.value) {
    error.value = 'Camera is not ready'
    return
  }

  uploading.value = true
  error.value = ''

  try {
    const video = videoRef.value
    const canvas = canvasRef.value
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not prepare image capture')
    }

    const width = video.videoWidth
    const height = video.videoHeight

    if (!width || !height) {
      throw new Error('Camera frame is not ready yet')
    }

    canvas.width = width
    canvas.height = height
    context.drawImage(video, 0, 0, width, height)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error('Failed to create image'))
        },
        'image/jpeg',
        0.9,
      )
    })

    await uploadBlob(blob, `capture-${Date.now()}.jpg`)
  } catch (err) {
    error.value = err.message || 'Photo capture failed'
    console.error('capturePhoto failed:', err)
  } finally {
    uploading.value = false
  }
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]

  if (!file) return

  uploading.value = true
  error.value = ''

  try {
    await uploadBlob(file, file.name || `capture-${Date.now()}.jpg`)
  } catch (err) {
    error.value = err.message || 'Photo upload failed'
    console.error('handleFileChange failed:', err)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

onMounted(async () => {
  await startSession()

  if (!error.value) {
    await startLiveCamera()
  }
})

onBeforeUnmount(() => {
  stopLiveCamera()
})
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      <div class="mb-6 flex items-center justify-between">
        <RouterLink to="/welcome" class="text-sm font-semibold text-[#d4d4d4]">
          ← Back
        </RouterLink>

        <button
          type="button"
          class="text-sm font-semibold text-[#d4d4d4]"
        >
          ...
        </button>
      </div>

      <div class="relative flex-1 overflow-hidden rounded-[2rem] bg-neutral-900">
        <div
          v-if="loading"
          class="flex h-full items-center justify-center text-center text-xl font-semibold text-white"
        >
          Starting camera...
        </div>

        <div
          v-else-if="error && !uploading"
          class="flex h-full items-center justify-center px-6 text-center text-lg font-semibold text-red-300"
        >
          {{ error }}
        </div>

        <div v-else class="relative h-full w-full">
          <video
            v-if="cameraReady && !usingFallbackCapture"
            ref="videoRef"
            autoplay
            playsinline
            muted
            class="h-full w-full object-cover"
          ></video>

          <div
            v-else
            class="flex h-full items-center justify-center px-6 text-center text-lg text-[#d4d4d4]"
          >
            <div>
              <p class="text-xl font-semibold text-white">
                {{ previewMessage === 'Camera permission was denied' ? 'Camera permission denied' : 'Camera preview unavailable' }}
              </p>
              <p class="mt-3">
                Tap the shutter button to use your phone camera instead.
              </p>
            </div>
          </div>

          <div
            v-if="uploading"
            class="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <div class="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1a1a]">
              Uploading...
            </div>
          </div>
        </div>
      </div>

      <div class="pb-2 pt-6">
        <div class="flex items-end justify-between">
          <div class="relative h-[88px] w-[56px] overflow-hidden">
            <div
              v-if="nextShotNumber !== null"
              class="absolute bottom-0 left-0 text-4xl font-bold leading-none text-white/20"
            >
              {{ nextShotNumber }}
            </div>

            <div
              class="absolute left-0 top-1/2 -translate-y-1/2 text-5xl font-bold leading-none text-white"
            >
              {{ shotsRemaining }}
            </div>

            <div
              v-if="previousShotNumber !== null"
              class="absolute left-0 top-0 text-4xl font-bold leading-none text-white/20"
            >
              {{ previousShotNumber }}
            </div>
          </div>

          <button
            type="button"
            aria-label="Take photo"
            @click="capturePhoto"
            :disabled="shotsRemaining <= 0 || loading || uploading"
            class="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.15)] transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            <span class="block h-16 w-16 rounded-full border-[6px] border-[#1a1a1a]"></span>
          </button>

          <div class="w-[72px]"></div>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        @change="handleFileChange"
      />

      <canvas ref="canvasRef" class="hidden"></canvas>
    </div>
  </main>
</template>