<template>
  <div class="flex flex-col gap-3" :class="{ 'web-url-input': isWeb }">
    <div v-if="isWeb" class="url-label-row"><label for="video-url">{{ t('web.inputLabel') }}</label><button type="button" @click="useExample">{{ t('web.example') }}</button></div>
    <div class="relative">
      <textarea
        ref="urlInput"
        id="video-url"
        :spellcheck="false"
        :value="store.url"
        @input="store.url = ($event.target as HTMLTextAreaElement).value; clipboardFailed = false"
        :aria-label="t('web.inputLabel')"
        class="w-full h-24 bg-surface-container-highest rounded-md p-3 text-on-surface placeholder:text-outline-variant resize-none font-body text-sm border-2 border-transparent focus:border-primary focus:outline-hidden transition-all"
        :placeholder="t('url.placeholder')"
        @contextmenu="isWeb ? undefined : showContextMenu($event)"
      />
      <!-- Context Menu -->
      <div
        v-if="contextMenuVisible"
        class="absolute z-50 bg-surface-container-high rounded-lg shadow-lg border border-outline-variant/20 py-1 min-w-[120px]"
        :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
      >
        <button
          v-for="item in contextMenuItems"
          :key="item.action"
          class="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container-highest transition-colors flex items-center gap-2"
          @click="handleContextMenuAction(item.action)"
        >
          <MaterialIcon :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>
    <p v-if="isWeb" class="url-hint">{{ store.url === EXAMPLE_URL ? t('web.exampleHint') : t('web.inputHint') }}</p>
    <p v-if="clipboardFailed" role="status" class="url-hint">{{ t('web.clipboardFailed') }}</p>
    <div class="flex gap-3" :class="{ 'url-actions': isWeb }">
      <button
        class="flex-1 flex items-center justify-center gap-2 rounded-md h-10 bg-surface-container-highest text-on-surface font-headline font-semibold text-sm hover:bg-surface-variant transition-colors border border-outline-variant/10"
        @click="pasteUrl"
      >
        <MaterialIcon name="content_paste" :size="18" />
        <span>{{ t('url.paste') }}</span>
      </button>
      <button
        class="flex-[1.5] flex items-center justify-center gap-2 rounded-md h-10 font-headline font-semibold text-sm transition-all border-2 bg-tertiary-container/40 text-tertiary border-tertiary/30 hover:bg-tertiary-container/60 hover:border-tertiary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="store.isParsing || (isWeb && (!store.url.trim() || retrySeconds > 0))"
        @click="$emit('parse')"
      >
        <MaterialIcon v-if="store.isParsing" name="sync" :size="18" class="animate-spin" />
        <MaterialIcon v-else name="bolt" :size="18" />
        <span>{{ store.isParsing ? t('url.parsing') : retrySeconds > 0 ? t('web.retryIn', { seconds: retrySeconds }) : (isWeb ? t('web.parse') : t('url.parse')) }}</span>
      </button>
    </div>

    <p v-if="isWeb && store.isYouTubeUrl && !store.videoInfo" class="text-xs text-on-surface-variant">{{ t('web.youtubeLimit') }}</p>

    <!-- YouTube Cookie Hint -->
    <div v-if="!isWeb && store.isYouTubeUrl && !store.hasParsed && !store.cookieReady" class="flex flex-col gap-2 p-4 bg-tertiary-container/30 rounded-lg border border-tertiary/20">
      <div class="flex items-start gap-3">
        <MaterialIcon name="info" :size="20" class="text-tertiary shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-on-surface">{{ t('url.youtubeCookieTitle') }}</p>
          <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">
            {{ t('url.youtubeCookieBody') }}
            <span class="font-medium text-tertiary">Get cookies.txt LOCALLY</span>
            {{ t('url.youtubeCookieSteps') }}
          </p>
          <button
            @click="openCookieHelp"
            class="mt-2 text-xs text-tertiary hover:text-tertiary/80 underline underline-offset-2 transition-colors"
          >
            {{ t('url.viewTutorial') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bilibili Cookie Hint -->
    <div v-if="!isWeb && store.showBilibiliCookieHint && !store.hasParsed" class="flex flex-col gap-2 p-4 bg-tertiary-container/30 rounded-lg border border-tertiary/20">
      <div class="flex items-start gap-3">
        <MaterialIcon name="info" :size="20" class="text-tertiary shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-on-surface">{{ t('url.bilibiliCookieTitle') }}</p>
          <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">
            {{ t('url.bilibiliCookieBody') }}
          </p>
          <button
            @click="goToSettings"
            class="mt-2 flex items-center gap-1 text-xs text-tertiary hover:text-tertiary/80 underline underline-offset-2 transition-colors"
          >
            <MaterialIcon name="settings" :size="14" />
            <span>{{ t('url.goImportCookie') }}</span>
          </button>
        </div>
      </div>
    </div>

  </div>
  <CookieGuide v-if="!isWeb" :visible="showCookieGuide" @close="showCookieGuide = false" />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import CookieGuide from './CookieGuide.vue'
import { useDownloadStore } from '../stores/download'
import { t } from '../i18n'
import { isWeb } from '../runtime-mode'
import { EXAMPLE_URL } from '../../shared/web-analytics'
withDefaults(defineProps<{ retrySeconds?: number }>(), { retrySeconds: 0 })
/** Cookie 使用引导浮窗（不再跳转到仓库 wiki） */
const showCookieGuide = ref(false)

const store = useDownloadStore()
const clipboardFailed = ref(false)
function useExample() {
  if (store.url.trim() && store.url !== EXAMPLE_URL && !confirm(t('web.replaceExample'))) return
  store.url = EXAMPLE_URL
  clipboardFailed.value = false
  window.dispatchEvent(new CustomEvent('keep:analytics', { detail: { name: 'example_selected' } }))
  urlInput.value?.focus()
}

defineEmits<{
  parse: []
}>()

const urlInput = ref<HTMLTextAreaElement | null>(null)


// 用 getter 而不是固定值：右键菜单在打开时读一次，语言切换后下次打开即为新语言
const contextMenuItems = [
  { action: 'cut', get label() { return t('ctx.cut') }, icon: 'content_cut' },
  { action: 'copy', get label() { return t('ctx.copy') }, icon: 'content_copy' },
  { action: 'paste', get label() { return t('ctx.paste') }, icon: 'content_paste' },
  { action: 'delete', get label() { return t('ctx.delete') }, icon: 'delete' },
  { action: 'selectAll', get label() { return t('ctx.selectAll') }, icon: 'select_all' },
]

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function showContextMenu(event: MouseEvent) {
  event.preventDefault()
  contextMenuX.value = event.offsetX
  contextMenuY.value = event.offsetY
  contextMenuVisible.value = true
}

function hideContextMenu() {
  contextMenuVisible.value = false
}

async function handleContextMenuAction(action: string) {
  const input = urlInput.value
  if (!input) return

  const start = input.selectionStart || 0
  const end = input.selectionEnd || 0
  const selectedText = store.url.substring(start, end)

  switch (action) {
    case 'cut':
      if (selectedText) {
        await window.electronAPI?.clipboard?.writeText?.(selectedText)
        store.url = store.url.substring(0, start) + store.url.substring(end)
        input.setSelectionRange(start, start)
      }
      break
    case 'copy':
      if (selectedText) await window.electronAPI?.clipboard?.writeText?.(selectedText)
      break
    case 'paste':
      try {
        const text = await window.electronAPI?.clipboard?.readText?.()
        if (text) {
          store.url = store.url.substring(0, start) + text + store.url.substring(end)
          input.setSelectionRange(start + text.length, start + text.length)
        }
      } catch {}
      break
    case 'delete':
      if (selectedText) {
        store.url = store.url.substring(0, start) + store.url.substring(end)
        input.setSelectionRange(start, start)
      }
      break
    case 'selectAll':
      input.select()
      break
  }
  hideContextMenu()
}

async function pasteUrl() {
  try {
    const text = await window.electronAPI.clipboard.readText()
    store.url = text
    clipboardFailed.value = false
  } catch { if (isWeb) { clipboardFailed.value = true; urlInput.value?.focus() } }
}

function goToSettings() {
  window.dispatchEvent(new CustomEvent('navigate-to-settings'))
}

function openCookieHelp() {
  showCookieGuide.value = true
}

// URL 变化时刷新 Cookie 状态，避免"已配好却仍提示"
watch(() => store.url, () => { if (!isWeb) void store.refreshCookieStatus() }, { immediate: true })

onMounted(() => document.addEventListener('click', hideContextMenu))
onUnmounted(() => document.removeEventListener('click', hideContextMenu))
</script>
