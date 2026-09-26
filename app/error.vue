<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
</script>
<template>
  <main class="error-page">
    <span class="eyebrow">DOTA ҚАУЫМ · {{ error.statusCode }}</span>
    <h1>{{ error.statusCode === 404 ? 'Игрок вне карты' : 'Пауза в игре' }}</h1>
    <p>{{ error.statusCode === 404 ? 'Такой страницы нет. Вернёмся к нашим игрокам?' : 'Не удалось загрузить страницу. Попробуйте снова.' }}</p>
    <button class="button button-primary" @click="clearError({ redirect: '/' })">К списку игроков <AppIcon name="arrow-right" /></button>
  </main>
</template>
