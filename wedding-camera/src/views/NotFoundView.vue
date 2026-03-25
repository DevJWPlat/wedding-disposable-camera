<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <main class="min-h-screen bg-[#1a1a1a] text-white">
    <div class="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
      
      <h1 class="text-[80px] font-bold leading-none text-white">
        404
      </h1>

      <p class="mt-6 text-xl font-semibold text-white">
        Page not found
      </p>

      <p class="mt-4 text-[#d4d4d4]">
        Looks like this shot didn't make it into the album.
      </p>

      <button
        @click="goHome"
        class="mt-10 rounded-full bg-white px-6 py-3 text-[#1a1a1a] font-medium"
      >
        Back to home
      </button>

    </div>
  </main>
</template>