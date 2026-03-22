<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '../utils/api.js'

const router = useRouter()

const ADMIN_STORAGE_KEY = 'wedding_camera_admin_logged_in'

// auth / loading
const loading = ref(true)
const loggingIn = ref(false)
const downloading = ref(false)
const error = ref('')
const username = ref('')
const password = ref('')
const isLoggedIn = ref(false)
const showLogoutConfirm = ref(false)

// unlock state from API
const unlockAt = ref(null)
const unlockAtFormatted = ref('')
const remainingMs = ref(0)

// screen state
const authStage = ref('login') // login | locked | app
const stage = ref('stats') // stats | reveal | gallery

// admin stats / gallery
const participants = ref(0)
const photosCount = ref(0)
const columns = ref(3)
const activePhoto = ref(null)
const selectedPhotos = ref([])
const photos = ref([])

const refreshing = ref(false)
let autoRefreshInterval = null

const revealPhotos = computed(() => photos.value.slice(0, 4))

const loginButtonDisabled = computed(() => {
  return username.value.trim().length === 0 || password.value.trim().length === 0 || loggingIn.value
})

const columnClass = computed(() => {
  const map = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }

  return map[columns.value] || 'grid-cols-3'
})

const countdownText = ref('')
let countdownInterval = null

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response: ${text}`)
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

function formatCountdown(diffMs) {
  if (diffMs <= 0) return '0 days, 0 hours and 0 minutes'

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const dayLabel = days === 1 ? 'day' : 'days'
  const hourLabel = hours === 1 ? 'hour' : 'hours'
  const minuteLabel = minutes === 1 ? 'minute' : 'minutes'

  return `${days} ${dayLabel}, ${hours} ${hourLabel} and ${minutes} ${minuteLabel}`
}

async function updateCountdownText() {
  countdownText.value = formatCountdown(remainingMs.value)

  if (remainingMs.value <= 0 && authStage.value === 'locked') {
    authStage.value = 'app'
    stage.value = 'stats'
    stopCountdown()
    await loadAdminData()
  }
}

function startCountdown() {
  stopCountdown()
  updateCountdownText()

  countdownInterval = setInterval(async () => {
    remainingMs.value = Math.max(remainingMs.value - 30000, 0)
    await updateCountdownText()
  }, 30000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

async function refreshData() {
  if (refreshing.value) return

  refreshing.value = true
  error.value = ''

  try {
    await loadAdminData()
  } catch (err) {
    error.value = err.message || 'Failed to refresh'
  } finally {
    refreshing.value = false
  }
}

async function fetchAdminStatus() {
  const data = await fetchJson(`${API_BASE_URL}/api/admin/status`)

  unlockAt.value = data.unlockAt
  unlockAtFormatted.value = data.unlockAtFormatted
  remainingMs.value = Number(data.remainingMs || 0)
}

async function fetchStats() {
  const data = await fetchJson(`${API_BASE_URL}/api/admin/stats`)

  participants.value = Number(data.participants || 0)
  photosCount.value = Number(data.photos || 0)
}

async function fetchPhotos() {
  const data = await fetchJson(`${API_BASE_URL}/api/admin/photos`)
  photos.value = Array.isArray(data.photos) ? data.photos : []
}

async function loadAdminData() {
  await Promise.all([fetchStats(), fetchPhotos()])
}

async function restoreSession() {
  const storedLogin = localStorage.getItem(ADMIN_STORAGE_KEY)
  isLoggedIn.value = storedLogin === 'true'

  await fetchAdminStatus()

  if (!isLoggedIn.value) {
    authStage.value = 'login'
    return
  }

  if (remainingMs.value > 0) {
    authStage.value = 'locked'
    startCountdown()
  } else {
    authStage.value = 'app'
    stage.value = 'stats'
    await loadAdminData()
  }
}

async function login() {
  error.value = ''
  loggingIn.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 300))

    if (username.value !== 'a-n' || password.value !== '4-4-26') {
      throw new Error('Incorrect username or password')
    }

    localStorage.setItem(ADMIN_STORAGE_KEY, 'true')
    isLoggedIn.value = true
    password.value = ''

    await fetchAdminStatus()

    if (remainingMs.value > 0) {
      authStage.value = 'locked'
      startCountdown()
    } else {
      authStage.value = 'app'
      stage.value = 'stats'
      await loadAdminData()
    }
  } catch (err) {
    error.value = err.message || 'Something went wrong'
  } finally {
    loggingIn.value = false
  }
}

function promptLogout() {
  showLogoutConfirm.value = true
}

function cancelLogout() {
  showLogoutConfirm.value = false
}

function confirmLogout() {
  localStorage.removeItem(ADMIN_STORAGE_KEY)
  isLoggedIn.value = false
  showLogoutConfirm.value = false
  username.value = ''
  password.value = ''
  error.value = ''
  authStage.value = 'login'
  stage.value = 'stats'
  participants.value = 0
  photosCount.value = 0
  photos.value = []
  selectedPhotos.value = []
  activePhoto.value = null
  stopCountdown()
  router.push('/')
}

function startReveal() {
  if (photos.value.length === 0) return
  stage.value = 'reveal'
}

function showGallery() {
  stage.value = 'gallery'
}

function openPhoto(photo) {
  activePhoto.value = photo
}

function closePhoto() {
  activePhoto.value = null
}

function isSelected(photoId) {
  return selectedPhotos.value.includes(photoId)
}

function togglePhotoSelection(photoId) {
  if (selectedPhotos.value.includes(photoId)) {
    selectedPhotos.value = selectedPhotos.value.filter((id) => id !== photoId)
  } else {
    selectedPhotos.value = [...selectedPhotos.value, photoId]
  }
}

function getPhotoFilename(photo, index) {
  const uploaded = photo.uploaded_at ? new Date(photo.uploaded_at) : null
  const timestamp = uploaded && !Number.isNaN(uploaded.getTime())
    ? uploaded.toISOString().replace(/[:.]/g, '-')
    : `image-${index + 1}`

  return `wedding-photo-${timestamp}.jpg`
}

async function downloadPhoto(photo, index) {
  const response = await fetch(photo.imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download photo ${index + 1}`)
  }

  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = blobUrl
  link.download = getPhotoFilename(photo, index)
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

async function downloadAll() {
  if (photos.value.length === 0 || downloading.value) return

  downloading.value = true
  error.value = ''

  try {
    for (let i = 0; i < photos.value.length; i++) {
      await downloadPhoto(photos.value[i], i)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  } catch (err) {
    error.value = err.message || 'Failed to download all photos'
  } finally {
    downloading.value = false
  }
}

async function downloadSelected() {
  if (selectedPhotos.value.length === 0 || downloading.value) return

  downloading.value = true
  error.value = ''

  try {
    const selected = photos.value.filter((photo) => selectedPhotos.value.includes(photo.id))

    for (let i = 0; i < selected.length; i++) {
      await downloadPhoto(selected[i], i)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  } catch (err) {
    error.value = err.message || 'Failed to download selected photos'
  } finally {
    downloading.value = false
  }
}

onMounted(async () => {
  try {
    await restoreSession()

    autoRefreshInterval = setInterval(() => {
      if (authStage.value === 'app') {
        refreshData()
      }
    }, 15000)

  } catch (err) {
    error.value = err.message || 'Failed to load admin view'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopCountdown()

  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval)
  }
})
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <div
        v-if="loading"
        class="flex flex-1 items-center justify-center text-center text-xl font-semibold"
      >
        Loading admin view...
      </div>

      <div
        v-else-if="error && authStage !== 'login'"
        class="flex flex-1 items-center justify-center text-center text-lg font-semibold text-red-300"
      >
        {{ error }}
      </div>

      <div v-else class="flex flex-1 flex-col">
        <div
          v-if="authStage === 'login'"
          class="flex flex-1 flex-col justify-center"
        >
          <div class="mb-10 text-center">
            <h1 class="text-4xl font-bold">Private Gallery</h1>
            <p class="mt-4 text-lg text-[#d4d4d4]">
              Enter your details to access the wedding photos.
            </p>
          </div>

          <div class="space-y-4">
            <input
              v-model="username"
              type="text"
              placeholder="Username"
              class="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-white outline-none"
            />

            <input
              v-model="password"
              type="password"
              placeholder="Password"
              class="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-white outline-none"
              @keyup.enter="login"
            />

            <div
              v-if="error"
              class="text-center text-sm font-semibold text-red-300"
            >
              {{ error }}
            </div>

            <button
              type="button"
              @click="login"
              :disabled="loginButtonDisabled"
              class="w-full rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a] disabled:opacity-50"
            >
              {{ loggingIn ? 'Checking...' : 'Enter' }}
            </button>
          </div>
        </div>

        <div
          v-else-if="authStage === 'locked'"
          class="flex flex-1 flex-col items-center justify-center text-center"
        >
          <h1 class="text-4xl font-bold leading-tight">
            The suspense must be killing you...
          </h1>

          <p class="mt-8 text-xl leading-relaxed text-[#d4d4d4]">
            You can access your photos in
          </p>

          <div class="mt-6 text-3xl font-bold leading-tight">
            {{ countdownText }}
          </div>

          <p class="mt-8 text-base text-[#d4d4d4]">
            Unlocks on {{ unlockAtFormatted }}
          </p>

          <button
            type="button"
            @click="promptLogout"
            class="mt-10 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>

        <div v-else-if="authStage === 'app'" class="flex flex-1 flex-col">
            <div class="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 class="text-2xl font-bold">Wedding Camera</h1>
              <p class="mt-1 text-sm text-[#d4d4d4]">Admin dashboard</p>
              <p class="mt-1 text-sm text-[#d4d4d4]">
            {{ photos.length }} photo{{ photos.length === 1 ? '' : 's' }} loaded
            </p>
            </div>

            <div class="flex gap-2">
                <button
                    type="button"
                    @click="refreshData"
                    :disabled="refreshing"
                    class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {{ refreshing ? 'Refreshing...' : 'Refresh' }}
                </button>

                <button
                    type="button"
                    @click="promptLogout"
                    class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                >
                    Log out
                </button>
                </div>
          </div>

          <div
            v-if="stage === 'stats'"
            class="flex flex-1 flex-col justify-center text-center"
          >
            <div class="mb-14">
              <div class="text-7xl font-extrabold leading-none">{{ participants }}</div>
              <div class="mt-3 text-2xl font-bold uppercase tracking-[0.18em] text-[#d4d4d4]">
                Participants
              </div>
            </div>

            <div class="mb-14">
              <div class="text-7xl font-extrabold leading-none">{{ photosCount }}</div>
              <div class="mt-3 text-2xl font-bold uppercase tracking-[0.18em] text-[#d4d4d4]">
                Photos
              </div>
            </div>

            <button
              type="button"
              @click="startReveal"
              :disabled="photos.length === 0"
              class="mt-4 rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a] disabled:opacity-50"
            >
              {{ photos.length === 0 ? 'No photos yet' : 'See the moments' }}
            </button>
          </div>

          <div
            v-else-if="stage === 'reveal'"
            class="relative flex flex-1 flex-col items-center justify-center"
          >
            <div v-if="revealPhotos.length === 0" class="text-center">
              <p class="text-xl font-semibold">No photos yet</p>
              <p class="mt-2 text-[#d4d4d4]">
                Once guests start uploading, they’ll appear here.
              </p>
            </div>

            <template v-else>
              <div class="relative h-[400px] w-[300px]">
                <div
                  v-for="(photo, index) in revealPhotos"
                  :key="photo.id"
                  class="absolute left-1/2 top-1/2 w-[220px] rounded-xl bg-white p-2 shadow-xl transition duration-500"
                  :style="{
                    transform: `translate(-50%, -50%) rotate(${(index % 7 - 3) * 3}deg) translateY(${index * 4}px)`,
                    zIndex: index + 1,
                  }"
                >
                  <img
                    :src="photo.imageUrl"
                    alt="Wedding reveal photo"
                    class="h-[220px] w-full rounded-md object-cover"
                  />
                </div>
              </div>

              <button
                type="button"
                @click="showGallery"
                class="mt-8 rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a]"
              >
                Show Gallery
              </button>
            </template>
          </div>

          <div v-else-if="stage === 'gallery'" class="flex flex-1 flex-col">
            <div class="mb-6">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <button
                  v-for="count in 6"
                  :key="count"
                  type="button"
                  @click="columns = count"
                  class="rounded-full border border-white/20 px-3 py-2 text-sm"
                >
                  {{ count }}
                </button>
              </div>
                <div class="flex flex-wrap gap-3">
                    <button
                        type="button"
                        @click="downloadAll"
                        :disabled="photos.length === 0 || downloading"
                        class="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1a1a1a] disabled:opacity-50"
                    >
                        {{ downloading ? 'Downloading...' : 'Download All' }}
                    </button>

                    <button
                        type="button"
                        @click="downloadSelected"
                        :disabled="selectedPhotos.length === 0 || downloading"
                        class="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1a1a1a] disabled:opacity-50"
                    >
                        {{ downloading ? 'Downloading...' : `Download Selected (${selectedPhotos.length})` }}
                    </button>
                </div>
             
            </div>

            <div
              v-if="photos.length === 0"
              class="flex flex-1 items-center justify-center text-center text-[#d4d4d4]"
            >
              No photos uploaded yet.
            </div>

            <div v-else class="grid gap-3" :class="columnClass">
              <div
                v-for="photo in photos"
                :key="photo.id"
                class="relative overflow-hidden rounded-2xl bg-neutral-800"
              >
                <button
                  type="button"
                  @click="openPhoto(photo)"
                  class="block w-full"
                >
                  <img
                    :src="photo.imageUrl"
                    alt="Wedding photo"
                    class="h-full w-full object-cover"
                  />
                </button>

                <label class="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    :checked="isSelected(photo.id)"
                    @change="togglePhotoSelection(photo.id)"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showLogoutConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
    >
      <div class="w-full max-w-sm rounded-[2rem] bg-[#2a2a2a] p-6 text-center shadow-2xl">
        <h2 class="text-2xl font-bold">Log out?</h2>
        <p class="mt-3 text-base leading-relaxed text-[#d4d4d4]">
          You will need to enter the password again to access the dashboard.
        </p>

        <div class="mt-6 space-y-3">
          <button
            type="button"
            class="flex w-full items-center justify-center rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a]"
            @click="confirmLogout"
          >
            Yes, log out
          </button>

          <button
            type="button"
            class="flex w-full items-center justify-center rounded-full border border-white/20 px-6 py-4 text-lg font-semibold text-white"
            @click="cancelLogout"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="activePhoto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      @click="closePhoto"
    >
      <div class="max-h-full max-w-full">
        <img
          :src="activePhoto.imageUrl"
          alt="Large wedding photo"
          class="max-h-[90vh] max-w-[90vw] object-contain"
        />
      </div>
    </div>
  </main>
</template>