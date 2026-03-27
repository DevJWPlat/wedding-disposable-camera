<script setup>
import coupleImage from '@/assets/images/couple.png'
</script>

<template>
    <main class=" bg-[#1a1a1a] text-white overflow-hidden">
        <div class="container mx-auto flex w-full max-w-md flex-col justify-end relative height-[100vh]" >
            <img :src="coupleImage" alt="Couple image" class="w-full h-full object-cover absolute top-0 left-0">
            <div class="overlay absolute bottom-0 left-0 w-full"></div>
            <div class="text-container px-6 pb-12 fixed bottom-2 left-0 z-10 w-full min-w-0 max-w-full">
                <div class="mb-8 border-b border-white/20 pb-8">
                    <h1 class="">Abbey & Nat</h1>
                    <p class="text-[#d4d4d4] text-center">04.04.2026</p>
                </div>
        
                <RouterLink
                to="/welcome"
                class="button flex items-center justify-center rounded-full bg-white px-6 py-3 text-xl font-medium text-[16px] text-[#1a1a1a] "
                >
                Take Photos →
                </RouterLink>
            </div>
        </div>
    </main>
</template>

<style scoped lang="scss">
    h1 {
        font-size: 32px;
        font-weight: 700;
        text-align: center;
    }
    .container {
        height: 100vh;
    }
    .button {
        width: 100%;
    }
    .overlay {
        height: 350px;
        background: linear-gradient(180deg,rgba(255, 255, 255, 0) 0%, rgba(26, 26, 26, 0.55) 22%, rgba(26, 26, 26, 1) 61%);
    }

</style>