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

function getDeviceToken() {
  let token = localStorage.getItem('wedding_camera_device_token')

  if (!token) {
    token = generateId()
    localStorage.setItem('wedding_camera_device_token', token)
  }

  return token
}

async function startSession() {
  loading.value = true
  error.value = ''

  try {
    const deviceToken = getDeviceToken()

    const response = await fetch(`${API_BASE_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken }),
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(text || 'Failed to start session')
    }

    const data = JSON.parse(text)

    if (!data.ok) {
      throw new Error(data.error || 'Failed to start session')
    }

    session.value = data.session
    shotsRemaining.value = data.session.shots_remaining

    if (shotsRemaining.value <= 0) {
      router.push('/finished')
    }
  } catch (err) {
    error.value = err.message || 'Something went wrong'
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  startSession()
})

const previousShotNumber = computed(() => {
  return shotsRemaining.value < 25 ? shotsRemaining.value + 1 : null
})

const nextShotNumber = computed(() => {
  return shotsRemaining.value > 0 ? shotsRemaining.value - 1 : null
})

function openCamera() {
  if (shotsRemaining.value <= 0 || loading.value || uploading.value) return
  fileInput.value?.click()
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file || !session.value) return

  uploading.value = true
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('sessionId', session.value.id)
    formData.append('photo', file)

    const response = await fetch(`${API_BASE_URL}/api/photo/upload`, {
      method: 'POST',
      body: formData,
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(text || 'Failed to upload photo')
    }

    const data = JSON.parse(text)

    if (!data.ok) {
      throw new Error(data.error || 'Failed to upload photo')
    }

    session.value = data.session
    shotsRemaining.value = data.session.shots_remaining

    navigator.vibrate?.(60)

    if (shotsRemaining.value <= 0) {
      router.push('/finished')
    }
  } catch (err) {
    error.value = err.message || 'Upload failed'
    console.error(err)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      <div class="mb-6 flex items-center justify-between">
        <RouterLink to="/welcome" class="text-sm font-semibold text-[#d4d4d4]">
          ← Back
        </RouterLink>

        <button type="button" class="text-sm font-semibold text-[#d4d4d4]">
          ...
        </button>
      </div>

      <div class="flex-1 overflow-hidden rounded-[2rem] bg-neutral-700">
        <div
          v-if="loading"
          class="flex h-full items-center justify-center text-center text-xl font-semibold text-white"
        >
          Starting camera...
        </div>

        <div
          v-else-if="uploading"
          class="flex h-full items-center justify-center text-center text-xl font-semibold text-white"
        >
          Uploading photo...
        </div>

        <div
          v-else-if="error"
          class="flex h-full items-center justify-center px-6 text-center text-lg font-semibold text-red-300"
        >
          {{ error }}
        </div>

        <div
          v-else
          class="flex h-full items-center justify-center text-center text-2xl font-semibold text-white"
        >
          Camera screen
        </div>
      </div>

      <div class="pb-2 pt-6">
        <div class="flex items-end justify-between">
          <div class="relative h-[88px] w-[56px] overflow-hidden">
            <div
              v-if="nextShotNumber !== null"
              class="absolute top-0 left-0 text-4xl font-bold leading-none text-white/20"
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
              class="absolute left-0 bottom-0 text-4xl font-bold leading-none text-white/20"
            >
              {{ previousShotNumber }}
            </div>
          </div>

          <button
            type="button"
            aria-label="Take photo"
            @click="openCamera"
            :disabled="shotsRemaining <= 0 || loading || uploading || !!error"
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
    </div>
  </main>
</template>