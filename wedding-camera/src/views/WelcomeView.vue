<script setup>
</script>

<template>
    <main class="min-h-screen bg-[#1a1a1a] text-white px-6 py-10 flex flex-col">
        <div class="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
            <div class="mb-8 h-44 w-44 rounded-full border-4 border-white overflow-hidden bg-neutral-700"></div>
    
            <h1 class="text-5xl font-bold leading-tight">
            Welcome to<br />
            Abbie & Natt's<br />
            Wedding!
            </h1>
    
            <p class="mt-8 text-2xl leading-relaxed text-[#d4d4d4]">
                Here is your disposable camera, you have
                <span class="font-bold text-white">25 shots</span>
                and just like a normal disposable you won't be able to see the photo you’ve taken straight away.
            </p>
        </div>
    
        <RouterLink
            to="/camera"
            class="mx-auto flex w-full max-w-md items-center justify-center rounded-full bg-white px-6 py-5 text-xl font-semibold text-[#1a1a1a]"
        >
            Get Started →
        </RouterLink>
    </main>
</template>

<style scoped>
</style>