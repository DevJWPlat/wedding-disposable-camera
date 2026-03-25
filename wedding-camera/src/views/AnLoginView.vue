<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref('')

function handleLogin() {
  error.value = ''

  if (username.value === 'Josh' && password.value === 'Peter') {
    sessionStorage.setItem('wedding_camera_an_auth', 'true')
    router.push('/an/camera')
    return
  }

  error.value = 'Incorrect username or password'
}
</script>

<template>
    <main class="min-h-screen bg-[#1a1a1a] text-white">
        <div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-6">
            <div class="text-center">
                <h1 class="text-[30px] font-bold leading-[1.08] text-white">
                Private camera access
                </h1>

                <p class="mt-4 leading-[1.45] text-[#d4d4d4]">
                Sign in to access the 50-shot camera.
                </p>
            </div>

            <form class="mt-10 flex flex-col gap-4" @submit.prevent="handleLogin">
                <input
                v-model="username"
                type="text"
                placeholder="Username"
                class="w-full rounded-full border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-[#d4d4d4]"
                />

                <input
                v-model="password"
                type="password"
                placeholder="Password"
                class="w-full rounded-full border border-white/10 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-[#d4d4d4]"
                />

                <p v-if="error" class="text-center text-sm font-semibold text-red-300">
                {{ error }}
                </p>

                <button
                type="submit"
                class="mt-2 w-full rounded-full bg-white px-6 py-3 text-[16px] font-medium text-[#1a1a1a]"
                >
                Login
                </button>
            </form>
        </div>
    </main>
</template>