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
const stage = ref('stats') // stats | gallery

// admin stats / gallery
const participants = ref(0)
const photosCount = ref(0)
const displayParticipants = ref(0)
const displayPhotosCount = ref(0)
const columns = ref(3)
const activePhotoIndex = ref(null)
const selectedPhotos = ref([])
const photos = ref([])
const touchStartX = ref(0)

const refreshing = ref(false)
let autoRefreshInterval = null
let hasAnimatedStats = false

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

const activePhoto = computed(() => {
  if (activePhotoIndex.value === null) return null
  return photos.value[activePhotoIndex.value] || null
})

const canGoPrevPhoto = computed(() => {
  if (activePhotoIndex.value === null) return false
  return activePhotoIndex.value > 0
})

const canGoNextPhoto = computed(() => {
  if (activePhotoIndex.value === null) return false
  return activePhotoIndex.value < photos.value.length - 1
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

function animateValue(displayRef, target, duration = 800) {
  const start = 0
  const startTime = performance.now()

  function tick(now) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    displayRef.value = Math.round(start + (target - start) * eased)

    if (progress < 1) {
      requestAnimationFrame(tick)
    }
  }

  requestAnimationFrame(tick)
}

async function fetchStats() {
  const data = await fetchJson(`${API_BASE_URL}/api/admin/stats`)

  participants.value = Number(data.participants || 0)
  photosCount.value = Number(data.photos || 0)

  if (!hasAnimatedStats) {
    hasAnimatedStats = true
    animateValue(displayParticipants, participants.value)
    animateValue(displayPhotosCount, photosCount.value)
    return
  }

  displayParticipants.value = participants.value
  displayPhotosCount.value = photosCount.value
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
  displayParticipants.value = 0
  displayPhotosCount.value = 0
  hasAnimatedStats = false
  photos.value = []
  selectedPhotos.value = []
  activePhotoIndex.value = null
  stopCountdown()
  router.push('/')
}

function showGallery() {
  stage.value = 'gallery'
}

function openPhoto(photo) {
  const index = photos.value.findIndex((item) => item.id === photo.id)
  activePhotoIndex.value = index >= 0 ? index : null
}

function closePhoto() {
  activePhotoIndex.value = null
}

function goToNextPhoto() {
  if (canGoNextPhoto.value) {
    activePhotoIndex.value += 1
  }
}

function goToPrevPhoto() {
  if (canGoPrevPhoto.value) {
    activePhotoIndex.value -= 1
  }
}

function onPagerTouchStart(event) {
  touchStartX.value = event.touches[0]?.clientX ?? 0
}

function onPagerTouchEnd(event) {
  const endX = event.changedTouches[0]?.clientX ?? 0
  const deltaX = endX - touchStartX.value
  const swipeThreshold = 50

  if (deltaX <= -swipeThreshold) {
    goToNextPhoto()
    return
  }

  if (deltaX >= swipeThreshold) {
    goToPrevPhoto()
  }
}

function handlePagerKeydown(event) {
  if (!activePhoto.value) return

  if (event.key === 'Escape') {
    closePhoto()
    return
  }

  if (event.key === 'ArrowRight') {
    goToNextPhoto()
    return
  }

  if (event.key === 'ArrowLeft') {
    goToPrevPhoto()
  }
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
  window.addEventListener('keydown', handlePagerKeydown)

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
  window.removeEventListener('keydown', handlePagerKeydown)

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

          <div class="flex gap-2 justify-between">
            <button
                  type="button"
                  @click="promptLogout"
                  class="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
              >
                  Log out
              </button>
              <button
                  type="button"
                  aria-label="Refresh"
                  @click="refreshData"
                  :disabled="refreshing"
                  class="flex items-center justify-center rounded-full border border-white/20 p-2 text-white disabled:opacity-50 w-10"
              >
                  <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 640 640"
                      fill="currentColor"
                      class="h-5 w-5 shrink-0"
                      :class="{ 'animate-spin': refreshing }"
                      aria-hidden="true"
                  >
                      <path
                          d="M173 172.9C254.2 91.7 385.9 91.7 467.2 172.9L494.3 200L416.1 200C402.8 200 392.1 210.7 392.1 224C392.1 237.3 402.8 248 416.1 248L552.2 248C565.5 248 576.2 237.3 576.2 224L576.2 88C576.2 74.7 565.5 64 552.2 64C538.9 64 528.2 74.7 528.2 88L528.2 166.1L501.1 139C401.1 39 239 39 139.1 139C95.9 182.2 71.3 237.1 65.5 293.5C64.1 306.7 73.7 318.5 86.9 319.8C100.1 321.1 111.9 311.6 113.2 298.4C118 252.6 137.9 208.1 173 172.9zM574.7 346.5C576.1 333.3 566.5 321.5 553.3 320.2C540.1 318.9 528.3 328.4 527 341.6C522.3 387.4 502.3 432 467.2 467.1C386 548.3 254.3 548.3 173 467.1L145.9 440L224.1 440C237.4 440 248.1 429.3 248.1 416C248.1 402.7 237.4 392 224.1 392L88 392C74.7 392 64 402.7 64 416L64 552C64 565.3 74.7 576 88 576C101.3 576 112 565.3 112 552L112 473.9L139.1 501C239.1 601 401.2 601 501.1 501C544.3 457.8 568.9 402.9 574.7 346.5z"
                      />
                  </svg>
              </button>
          </div>

          <div
            v-if="stage === 'stats'"
            class="flex flex-1 flex-col justify-center text-center"
          >
            <div class="mb-14">
              <div class="text-7xl font-extrabold leading-none" style="text-shadow: 0 0 20px #2563eb, 0 0 40px #2563eb;">
                {{ displayParticipants }}
              </div>
              <div class="mt-3 text-2xl font-bold uppercase tracking-[0.18em] text-[#d4d4d4]">
                Participants
              </div>
            </div>

            <div class="mb-14">
              <div class="text-7xl font-extrabold leading-none" style="text-shadow: 0 0 20px #a855f7, 0 0 40px #a855f7;">
                {{ displayPhotosCount }}
              </div>
              <div class="mt-3 text-2xl font-bold uppercase tracking-[0.18em] text-[#d4d4d4]">
                Photos
              </div>
            </div>

            <button
              type="button"
              @click="showGallery"
              :disabled="photos.length === 0"
              class="mt-4 rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a] disabled:opacity-50"
            >
              {{ photos.length === 0 ? 'No photos yet' : 'See the moments' }}
            </button>
          </div>

          <div v-else-if="stage === 'gallery'" class="flex flex-1 flex-col">
            <div class="my-6">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <button
                  v-for="count in 6"
                  :key="count"
                  type="button"
                  @click="columns = count"
                  class="rounded-full border border-white/20 px-3 py-2 text-sm w-10 h-10"
                >
                  {{ count }}
                </button>
              </div>
                <div class="flex flex-wrap gap-3">
                    <button
                        type="button"
                        @click="downloadAll"
                        :disabled="photos.length === 0 || downloading"
                        class="download-btn rounded-full bg-white px-4 py-3 font-semibold text-[#1a1a1a] text-[12px] disabled:opacity-50"
                    >
                        {{ downloading ? 'Downloading...' : 'Download All' }}
                    </button>

                    <button
                        type="button"
                        @click="downloadSelected"
                        :disabled="selectedPhotos.length === 0 || downloading"
                        class="download-btn rounded-full bg-white px-4 py-3 font-semibold text-[#1a1a1a] text-[12px] disabled:opacity-50"
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
                    :src="photo.thumbnailUrl || photo.imageUrl"
                    alt="Wedding photo"
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                </button>

                <label
                  class="absolute right-2 top-2 flex cursor-pointer items-center rounded-full border border-white/25 bg-black/65 p-1.5 shadow-lg backdrop-blur-sm"
                  :aria-label="isSelected(photo.id) ? 'Remove photo from selection' : 'Select photo for download'"
                >
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    :checked="isSelected(photo.id)"
                    @change="togglePhotoSelection(photo.id)"
                  />
                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-black/40 text-transparent transition-all duration-150 peer-checked:border-white peer-checked:bg-white peer-checked:text-black"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      class="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.313a1 1 0 0 1-1.42 0L3.29 9.266a1 1 0 0 1 1.414-1.414l4.046 4.045 6.543-6.601a1 1 0 0 1 1.41-.006z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
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
      class="fixed inset-0 z-50 flex flex-col bg-black/95"
      @touchstart="onPagerTouchStart"
      @touchend="onPagerTouchEnd"
    >
      <div class="flex items-center justify-between px-4 py-4">
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          :class="isSelected(activePhoto.id) ? 'border-white bg-white text-black' : 'border-white/40 text-white'"
          @click="togglePhotoSelection(activePhoto.id)"
        >
          {{ isSelected(activePhoto.id) ? 'Selected for download' : 'Select for download' }}
        </button>

        <button
          type="button"
          aria-label="Close photo viewer"
          class="rounded-full border border-white/40 bg-black/50 px-3 py-1 text-2xl leading-none text-white"
          @click="closePhoto"
        >
          &times;
        </button>
      </div>

      <div
        class="relative flex flex-1 items-center justify-center px-4 pb-4"
        @click.self="closePhoto"
      >
        <button
          v-if="canGoPrevPhoto"
          type="button"
          aria-label="Previous photo"
          class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-purple-600/60 px-3 py-2 text-xl text-white w-10 h-10 flex items-center justify-center"
          @click.stop="goToPrevPhoto"
        >
          &#8249;
        </button>

        <button
          v-if="canGoNextPhoto"
          type="button"
          aria-label="Next photo"
          class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-purple-600/60 px-3 py-2 text-xl text-white w-10 h-10 flex items-center justify-center"
          @click.stop="goToNextPhoto"
        >
          &#8250;
        </button>

        <img
          :src="activePhoto.imageUrl"
          alt="Large wedding photo"
          class="max-h-[82vh] max-w-[92vw] object-contain"
        />
      </div>

      <div class="pb-4 text-center text-sm text-white/75">
        {{ activePhotoIndex + 1 }} / {{ photos.length }}
      </div>
    </div>
  </main>
</template>

<style scoped>
.download-btn {
  font-size: 12px;
}
</style>