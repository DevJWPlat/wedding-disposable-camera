<script setup>
</script>

<template>
    <main class="min-h-screen bg-[#1a1a1a] text-white px-5 py-6 flex flex-col">
        <div class="flex-1 rounded-4xl bg-neutral-700 flex items-center justify-center">
            <p class="text-2xl font-semibold text-white">Camera screen</p>
        </div>
    
        <div class="pt-6 pb-2 flex items-center justify-between">
            <div>
                <div class="text-3xl font-bold leading-none">25</div>
                <div class="text-sm font-bold uppercase tracking-wide text-[#d4d4d4]">
                    shots remaining
                </div>
            </div>
    
            <button class="h-24 w-24 rounded-full bg-white border-4 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]"></button>
    
            <div class="w-16"></div>
        </div>
    </main>
</template>

<style scoped>
</style>