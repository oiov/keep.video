<template>
  <div class="flex-1 bg-surface overflow-y-auto">
    <div class="max-w-2xl mx-auto px-6 py-8">
      <component :is="isWeb ? 'h2' : 'h1'" class="font-headline text-2xl font-bold text-on-surface mb-6">{{ t('about.title') }}</component>
      <div class="flex items-center gap-4 mb-6">
        <img src="@/assets/logo.png" alt="" class="size-12 object-contain" />
        <div class="flex-1">
          <h3 class="font-headline text-xl font-bold text-on-surface">Keep Video</h3>
          <p v-if="!isWeb" class="text-sm text-on-surface-variant">v{{ appVersion }}</p>
        </div>
        <button v-if="!isWeb" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm" @click="showUpdateDrawer = true">
          {{ t('about.checkUpdate') }}
        </button>
      </div>
      <p class="text-sm text-on-surface-variant leading-relaxed mb-8">{{ isWeb ? t('web.about') : t('about.intro') }}</p>
      <h3 class="font-headline text-base font-semibold text-on-surface mb-2">{{ t('web.support') }}</h3>
      <p class="text-sm text-on-surface-variant mb-4">{{ t('web.supportHint') }}</p>
      <div class="flex flex-wrap gap-5 text-sm text-primary mb-8">
        <a :href="guideUrl" target="_blank" rel="noopener noreferrer">{{ t('web.guides') }}</a>
        <a href="mailto:support@keep.video">support@keep.video</a>
      </div>
      <!-- 保留组件许可名称；版权和完整许可仍随软件分发。 -->
      <details class="border-t border-outline-variant/20 pt-4">
        <summary class="text-sm text-on-surface-variant cursor-pointer">{{ t('about.openSource') }}</summary>
        <dl class="mt-4 space-y-2">
          <div v-for="item in ossCredits" :key="item.name" class="flex justify-between gap-4 text-xs text-on-surface-variant">
            <dt>{{ item.name }}</dt><dd>{{ item.license }}</dd>
          </div>
        </dl>
      </details>
      <p class="mt-8 text-xs text-on-surface-variant">© 2026 Keep Video · MIT License</p>
    </div>
    <UpdateModal v-if="!isWeb" :visible="showUpdateDrawer" @close="showUpdateDrawer = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { t } from '../i18n'
import { isWeb } from '../runtime-mode'
import { webLocale } from '../../shared/web-routes'
import UpdateModal from './UpdateModal.vue'

const guideUrl = computed(() => {
  const prefix = isWeb ? webLocale(location.pathname)?.prefix : ''
  return (isWeb ? '/' : 'https://keep.video/') + (prefix ? prefix + '/' : '') + 'guides/'
})
const ossCredits = [
  { name: 'Material Symbols', license: 'Apache-2.0' },
  { name: 'yt-dlp', license: 'Unlicense' },
  { name: 'FFmpeg', license: 'GPL-3.0' },
  ...(!isWeb ? [{ name: 'Electron', license: 'MIT' }] : []),
  { name: 'Vue', license: 'MIT' },
]
const appVersion = ref('')
const showUpdateDrawer = ref(false)
onMounted(async () => {
  if (isWeb) return
  try { appVersion.value = await window.electronAPI?.app?.getVersion?.() || '' } catch {}
})
</script>
