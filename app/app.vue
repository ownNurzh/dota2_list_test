<script setup lang="ts">
const tab = useDirectoryTab()
const { favorites } = useFavorites()
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Перейти к содержимому</a>
    <header class="site-header">
      <div class="page-container header-inner">
        <NuxtLink to="/" class="brand" aria-label="DOTA қауым — главная">
          <svg class="brand-mark" width="37" height="37" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="currentColor"/><path d="m10 8 22 23-4 3L7 13zm10 0 12 2-1 11zM8 21l12 12-13-2z" fill="#17131f"/></svg>
          <span>DOTA<span class="brand-community">қауым<span class="brand-dot">.</span></span></span>
        </NuxtLink>
        <nav class="main-nav" aria-label="Основная навигация">
          <NuxtLink to="/" :class="{ active: tab === 'players' }"><AppIcon name="users" :size="17" />Наш стак</NuxtLink>
          <NuxtLink to="/?tab=ranking" :class="{ active: tab === 'ranking' }"><AppIcon name="trophy" :size="17" />Рейтинг</NuxtLink>
          <NuxtLink to="/?tab=favorites" :class="{ active: tab === 'favorites' }"><AppIcon name="star" :size="17" />Избранное<span v-if="favorites.length" class="nav-count">{{ favorites.length }}</span></NuxtLink>
        </nav>
        <div class="community-label"><AppIcon name="swords" :size="13" /> ВЕЧЕРОМ — В ДОТУ <span class="country-label">KZ</span></div>
      </div>
    </header>
    <main id="main-content"><NuxtPage /></main>
    <footer class="site-footer page-container">
      <div><strong>DOTA қауым<span>.</span></strong><p>Наш вечер. Наша пати.</p></div>
      <span class="footer-note">Для друзей, с которыми каждый вечер в Доте.<br>И ради которых играем «ещё одну».</span>
      <span class="footer-year">GG, WP <AppIcon name="sparkles" :size="15" /> <span>© 2026</span></span>
    </footer>
  </div>
</template>
