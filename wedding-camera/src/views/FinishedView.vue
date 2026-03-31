<script setup>
const STORAGE_KEY = 'wedding_camera_shots_remaining'

function resetForTesting() {
  localStorage.removeItem(STORAGE_KEY)
  window.location.href = '/camera'
}
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div
      class="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-8 text-center"
    >
      <h1 class="text-4xl font-bold leading-tight sm:text-5xl">
        Thats it, you have
      </h1>

      <div class="mt-6 text-7xl font-extrabold italic leading-none sm:text-8xl">ZERO</div>

      <div class="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
        Shots remaining
      </div>

      <p class="mt-10 text-xl leading-relaxed text-[#d4d4d4] sm:text-2xl">
        Thank you for taking part. We'll share the photos with you soon.
      </p>

      <button
        type="button"
        @click="resetForTesting"
        class="mt-12 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-[#d4d4d4] transition active:scale-95"
      >
        Reset for testing
      </button>
    </div>
  </main>
</template>