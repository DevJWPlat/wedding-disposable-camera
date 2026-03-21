<script setup>
</script>

<template>
    <main class=" bg-[#1a1a1a] text-white">
        <div class="mx-auto flex w-full max-w-md flex-col justify-between px-6 py-8">
            <div class="mb-6 aspect-[3/4] w-full overflow-hidden rounded-[2rem] bg-neutral-800">
                <div class="flex h-full items-center justify-center text-center text-[#d4d4d4]">
                    Couple image
                </div>
            </div>
            
            <div class="text-container">
                <div class="mb-8 border-b border-white/20 pb-8">
                    <h1 class="">Abbie & Natt</h1>
                    <p class="text-[#d4d4d4] text-center">04.04.2026</p>
                </div>
        
                <RouterLink
                to="/welcome"
                class="flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-xl font-medium text-[16px] text-[#1a1a1a] transition active:scale-95"
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

</style>