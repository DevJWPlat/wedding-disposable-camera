<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { API_BASE_URL } from '../utils/api.js'
import { generateId } from '../utils/id.js'

const router = useRouter()

const fileInput = ref(null)

const shotsRemaining = ref(100)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const session = ref(null)
const captureFlash = ref(false)

const STORAGE_KEYS = {
  deviceToken: 'wedding_camera_an_100_device_token',
  sessionId: 'wedding_camera_an_100_session_id',
}

const previousShotNumber = computed(() => {
  return shotsRemaining.value < 100 ? shotsRemaining.value + 1 : null
})

const nextShotNumber = computed(() => {
  return shotsRemaining.value > 0 ? shotsRemaining.value - 1 : null
})

function createThumbnailBlob(file, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        const scale = Math.min(1, maxWidth / img.naturalWidth)
        const width = Math.max(1, Math.round(img.naturalWidth * scale))
        const height = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('No canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Thumbnail encode failed'))
          },
          'image/jpeg',
          quality,
        )
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Thumbnail failed'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image load failed'))
    }

    img.src = objectUrl
  })
}

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
    token = `an_${generateId()}`
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
      body: JSON.stringify({
        deviceToken,
        maxShots: 100,
        cameraType: 'an',
      }),
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

async function uploadFile(file) {
  if (!session.value?.id) {
    throw new Error('No active session found')
  }

  const formData = new FormData()
  formData.append('sessionId', session.value.id)
  formData.append('photo', file)

  try {
    const thumbBlob = await createThumbnailBlob(file)
    formData.append('thumbnail', thumbBlob, 'thumbnail.jpg')
  } catch (err) {
    console.warn('Thumbnail generation skipped:', err)
  }

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

function openCamera() {
  if (shotsRemaining.value <= 0 || loading.value || uploading.value) return
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]

  if (!file) return

  uploading.value = true
  error.value = ''

  try {
    captureFlash.value = true
    setTimeout(() => {
      captureFlash.value = false
    }, 180)

    await uploadFile(file)
  } catch (err) {
    error.value = err.message || 'Photo upload failed'
    console.error('handleFileChange failed:', err)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

onMounted(async () => {
  const isAuthed = sessionStorage.getItem('wedding_camera_an_auth') === 'true'
  if (!isAuthed) {
    router.push('/an')
    return
  }

  await startSession()
})
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div
      v-if="uploading"
      class="fixed inset-0 z-40 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div class="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div class="relative z-10 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1a1a]">
        Uploading...
      </div>
    </div>

    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-5 py-6">
      <div class="container">
        <div class="relative">
          <div
            v-if="loading"
            class="flex h-full items-center justify-center px-6 text-center text-xl font-semibold text-white"
          >
            Starting camera...
          </div>

          <div
            v-else-if="error && !uploading"
            class="flex h-full items-center justify-center px-6 text-center text-lg font-semibold text-red-300"
          >
            {{ error }}
          </div>

          <div
            v-else
            class="flex h-full flex-col items-center pt-10 text-center"
          >
            <h1 class="text-[30px] font-bold leading-[1.08] text-white">
              Peter's Personal Camera
            </h1>

            <p class="mt-8 leading-[1.45] text-[#d4d4d4]">
              Tap the button below to get started
            </p>

            <p class="mt-2 leading-relaxed text-[#d4d4d4]">
              (Don't forget you have <span class="font-semibold text-white">{{ shotsRemaining }} shots</span>)
            </p>
          </div>

          <div
            v-if="captureFlash"
            class="pointer-events-none absolute inset-0 bg-white/90"
          ></div>
        </div>

        <div class="pt-32">
          <div class="flex justify-center">
            <div class="relative">
              <div class="top-overlay"></div>

              <div
                v-if="nextShotNumber !== null"
                class="number next font-bold"
              >
                {{ nextShotNumber }}
              </div>

              <div class="flex items-end gap-3">
                <span class="text-[60px] font-bold leading-none text-white">
                  {{ shotsRemaining }}
                </span>

                <div class="relative top-[-17px] w-[110px] pb-2 text-left leading-[0.9]">
                  <div class="text-[20px] font-bold italic uppercase text-white">
                    SHOTS
                  </div>
                  <div class="absolute left-[-3px] text-[20px] font-bold italic uppercase text-white">
                    REMAINING
                  </div>
                </div>
              </div>

              <div class="bottom-overlay"></div>

              <div
                v-if="previousShotNumber !== null"
                class="number previous font-bold"
              >
                {{ previousShotNumber }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Take photo"
        @click="openCamera"
        :disabled="shotsRemaining <= 0 || loading || uploading"
        class="fixed bottom-4 left-1/2 z-10 mx-auto mt-6 flex w-[75%] max-w-md translate-x-[-50%] items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[16px] font-medium text-[#1a1a1a]"
      >
        <span>Take picture</span>
        <span class="text-[15px]">📷</span>
      </button>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        @change="handleFileChange"
      />
    </div>
  </main>
</template>

<style scoped lang="scss">
.number {
  font-size: 50px;
  position: absolute;

  &.next {
    top: -56px;
    left: 10px;
    font-style: italic;
  }

  &.previous {
    bottom: -56px;
    left: 10px;
  }
}

.top-overlay {
  position: absolute;
  top: -38px;
  left: 0;
  width: 100%;
  height: 74px;
  background: linear-gradient(360deg, rgba(255, 255, 255, 0) 0%, rgb(26, 26, 26) 75%);
  z-index: 1;
}

.bottom-overlay {
  position: absolute;
  bottom: -47px;
  left: 0;
  width: 100%;
  height: 74px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgb(26, 26, 26) 75%);
  z-index: 1;
}
</style>