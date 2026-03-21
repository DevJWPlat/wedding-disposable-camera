<script setup>
import { computed, onMounted, ref } from 'vue'
import { API_BASE_URL } from '../utils/api.js'

const loading = ref(true)
const error = ref('')
const participants = ref(0)
const photosCount = ref(0)
const photos = ref([])
const columns = ref(2)
const selectedPhotos = ref([])
const activePhoto = ref(null)

const stage = ref('stats') // stats | reveal | gallery
const revealPhotos = ref([])
const revealIndex = ref(0)

const columnClass = computed(() => {
  const map = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }

  return map[columns.value] || 'grid-cols-2'
})

async function loadAdminData() {
  loading.value = true
  error.value = ''

  try {
    const [statsResponse, photosResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/admin/stats`),
      fetch(`${API_BASE_URL}/api/admin/photos`),
    ])

    const statsText = await statsResponse.text()
    const photosText = await photosResponse.text()

    if (!statsResponse.ok) {
      throw new Error(statsText || 'Failed to load stats')
    }

    if (!photosResponse.ok) {
      throw new Error(photosText || 'Failed to load photos')
    }

    const statsData = JSON.parse(statsText)
    const photosData = JSON.parse(photosText)

    if (!statsData.ok) {
      throw new Error(statsData.error || 'Failed to load stats')
    }

    if (!photosData.ok) {
      throw new Error(photosData.error || 'Failed to load photos')
    }

    participants.value = statsData.participants
    photosCount.value = statsData.photos
    photos.value = photosData.photos
  } catch (err) {
    error.value = err.message || 'Something went wrong'
    console.error(err)
  } finally {
    loading.value = false
  }
}

function startReveal() {
  stage.value = 'reveal'
  revealPhotos.value = []
  revealIndex.value = 0

  const interval = setInterval(() => {
    if (revealIndex.value >= photos.value.length) {
      clearInterval(interval)

      setTimeout(() => {
        stage.value = 'gallery'
      }, 1000)

      return
    }

    revealPhotos.value.push(photos.value[revealIndex.value])
    revealIndex.value++
  }, 80)
}

function togglePhotoSelection(photoId) {
  if (selectedPhotos.value.includes(photoId)) {
    selectedPhotos.value = selectedPhotos.value.filter((id) => id !== photoId)
  } else {
    selectedPhotos.value.push(photoId)
  }
}

function isSelected(photoId) {
  return selectedPhotos.value.includes(photoId)
}

function openPhoto(photo) {
  activePhoto.value = photo
}

function closePhoto() {
  activePhoto.value = null
}

function downloadImage(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadAll() {
  photos.value.forEach((photo, index) => {
    downloadImage(photo.imageUrl, `wedding-photo-${index + 1}.jpg`)
  })
}

function downloadSelected() {
  const chosen = photos.value.filter((photo) => selectedPhotos.value.includes(photo.id))

  chosen.forEach((photo, index) => {
    downloadImage(photo.imageUrl, `wedding-photo-selected-${index + 1}.jpg`)
  })
}

onMounted(() => {
  loadAdminData()
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
        v-else-if="error"
        class="flex flex-1 items-center justify-center text-center text-lg font-semibold text-red-300"
      >
        {{ error }}
      </div>

      <div v-else class="flex flex-1 flex-col">
        <div v-if="stage === 'stats'" class="flex flex-1 flex-col justify-center text-center">
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
            class="mt-4 rounded-full bg-white px-6 py-4 text-lg font-semibold text-[#1a1a1a]"
          >
            See the moments
          </button>
        </div>

        <div
          v-else-if="stage === 'reveal'"
          class="relative flex flex-1 items-center justify-center"
        >
          <div class="relative h-[400px] w-[300px]">
            <div
              v-for="(photo, index) in revealPhotos"
              :key="photo.id"
              class="absolute left-1/2 top-1/2 w-[220px] rounded-xl bg-white p-2 shadow-xl"
              :style="{
                transform: `translate(-50%, -50%) rotate(${(index % 7 - 3) * 3}deg)`,
                zIndex: index,
              }"
            >
              <img
                :src="photo.imageUrl"
                alt="Wedding reveal photo"
                class="h-[220px] w-full rounded-md object-cover"
              />
            </div>
          </div>
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
                class="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1a1a1a]"
              >
                Download All
              </button>

              <button
                type="button"
                @click="downloadSelected"
                :disabled="selectedPhotos.length === 0"
                class="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1a1a1a] disabled:opacity-50"
              >
                Download Selected
              </button>
            </div>
          </div>

          <div class="grid gap-3" :class="columnClass">
            <div
              v-for="photo in photos"
              :key="photo.id"
              class="relative overflow-hidden rounded-2xl bg-neutral-800"
            >
              <button type="button" @click="openPhoto(photo)" class="block w-full">
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