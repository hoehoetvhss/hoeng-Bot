<template>
    <div
        class="flex min-h-screen items-center justify-center bg-bg"
        style="
            background-image:
                radial-gradient(ellipse at 20% 50%, rgba(88, 101, 242, 0.08) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 20%, rgba(88, 101, 242, 0.06) 0%, transparent 50%);
        "
    >
        <slot />
    </div>
</template>
