<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { API_BASE_URL } from '../utils/api.js'
import { generateId } from '../utils/id.js'

const router = useRouter()

const fileInput = ref(null)

const shotsRemaining = ref(25)
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const session = ref(null)
const captureFlash = ref(false)

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

async function uploadFile(file) {
  if (!session.value?.id) {
    throw new Error('No active session found')
  }

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
  await startSession()
})
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6 justify-between">
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
            class="flex h-full flex-col items-center pt-24 text-center"
          >
            <h1 class=" text-[30px] font-bold leading-[1.08] text-white">
              Your disposable is ready to capture
            </h1>

            <p class="mt-8 leading-[1.45] text-[#d4d4d4]">
              Tap the button below to get started
            </p>

            <p class="mt-2  leading-relaxed text-[#d4d4d4]">
              (Don't forget you only have <span class="font-semibold text-white">25 shots</span>)
            </p>
          </div>

          <div
            v-if="uploading"
            class="absolute inset-0 flex items-center justify-center bg-black/50"
          >
            <div class="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1a1a]">
              Uploading...
            </div>
          </div>

          <div
            v-if="captureFlash"
            class="pointer-events-none absolute inset-0 bg-white/90"
          ></div>
        </div>

        <div class="pt-8">
          <div class="flex justify-center">
            <div class="relative">
              <div
                v-if="previousShotNumber !== null"
                class="absolute left-[18px] top-0 text-[4.2rem] font-bold italic leading-none text-white/15"
              >
                {{ previousShotNumber }}
              </div>

              <div class="flex items-end gap-3">
                <span class="text-[60px] font-bold italic leading-none text-white">
                  {{ shotsRemaining }}
                </span>

                <div class="pb-2 text-left leading-[0.9] relative w-[110px] top-[-17px]">
                    <div class="text-[20px] font-bold italic uppercase text-white">
                      SHOTS
                    </div>
                    <div class="text-[20px] font-bold italic uppercase text-white absolute left-[-3px]">
                      REMAINING
                    </div>
                </div>
              </div>

              <div
                v-if="nextShotNumber !== null"
                class="absolute left-0 bottom-0 translate-y-[12px] text-[4.2rem] font-bold italic leading-none text-white/10"
              >
                {{ nextShotNumber }}
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
        class="mt-6 w-full flex gap-2 items-center justify-center rounded-full bg-white px-6 py-3 text-xl font-medium text-[16px] text-[#1a1a1a]"
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