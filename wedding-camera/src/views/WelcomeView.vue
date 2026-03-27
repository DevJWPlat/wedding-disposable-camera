<script setup>
import heartImage from '@/assets/images/heart.png'
</script>

<template>
    <main class="min-h-screen bg-[#1a1a1a] text-white">
        <div class="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
                <img :src="heartImage" alt="Heart image" class="w-full h-full object-cover">
        
                <h1 class="font-bold leading-tight">
                    Welcome to<br />
                    Abbey & Nat's<br />
                    Wedding!
                </h1>
        
                <p class="mt-8 text-l mb-8 leading-relaxed text-[#d4d4d4] sm:text-2xl text-center">
                    This is your disposable camera. You have
                    <span class="font-bold text-white">25 shots</span>
                    to capture your favourite moments, all of which will be added to the newlyweds wedding album.
                </p>

    
            <RouterLink
            to="/camera"
            class="w-full flex items-center justify-center rounded-full bg-white px-6 py-3 text-xl font-medium text-[16px] text-[#1a1a1a]"
            >
            Get Started →
            </RouterLink>
        </div>
    </main>
</template>

<style scoped>
    h1 {
        font-size: 38px;
        text-align: center;
        margin-top: 24px;
    }

</style>