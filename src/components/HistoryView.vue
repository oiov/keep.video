<template>
  <div class="flex-1 flex flex-col bg-surface p-8 overflow-hidden">
    <div class="max-w-4xl mx-auto w-full flex flex-col gap-6 h-full">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <component :is="isWeb ? 'h2' : 'h1'" class="font-headline text-2xl font-bold leading-tight text-on-surface">{{ t('history.title') }}</component>
          <p class="text-on-surface-variant text-sm mt-1">{{ isWeb ? t('web.tasks') : t('history.subtitle') }}</p>
        </div>
        <button 
          v-if="history.length > 0"
          class="flex items-center gap-2 px-4 py-2 rounded-md bg-surface-container-highest text-on-surface font-headline text-sm font-medium hover:bg-surface-variant transition-colors"
          @click="clearAllHistory"
        >
          <MaterialIcon name="delete_sweep" :size="18" />
          <span>{{ t('history.clearAll') }}</span>
        </button>
      </div>
      
      <!-- History List -->
      <div class="flex-1 overflow-y-auto pr-2">
        <div v-if="history.length === 0" class="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <MaterialIcon name="history" :size="64" class="mb-4 opacity-20" />
          <p class="text-lg font-medium">{{ t('history.empty') }}</p>
          <p class="text-sm mt-2 opacity-70">{{ t('history.emptyHint') }}</p>
        </div>
        
        <div v-else class="grid grid-cols-1 gap-4">
          <div 
            v-for="item in history" 
            :key="item.id"
            class="flex gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant/10 hover:border-primary/30 transition-colors group"
          >
            <!-- Thumbnail -->
            <div 
              class="w-32 h-20 rounded-md bg-surface-variant bg-cover bg-center shrink-0 relative overflow-hidden"
              :style="{ backgroundImage: `url(${item.thumbnail})` }"
            >
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <button 
                  class="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-primary/90 rounded-full text-on-primary"
                  @click="openFile(item)"
                  :disabled="item.fileExists === false"
                  :title="item.fileExists === false ? t('history.fileMissing') : t('history.playFile')"
                  :class="{ 'opacity-40 cursor-not-allowed': item.fileExists === false }"
                >
                  <MaterialIcon name="play_arrow" :size="20" />
                </button>
              </div>
            </div>
            
            <!-- Info -->
            <div class="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h4 class="font-headline text-sm font-bold text-on-surface line-clamp-2">{{ item.title }}</h4>
                <p class="text-xs text-on-surface-variant mt-1 font-mono">{{ item.url }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
                <span v-if="isWeb && item.status" class="text-primary">{{ item.phase === 'uploading' && item.status === 'downloading' ? t('web.uploading') : webStatus(item.status) }} {{ item.status === 'downloading' ? Math.round(item.progress || 0) + '%' : '' }}</span>
                <span v-if="isWeb && item.expiresAt">{{ expired(item) ? t('web.expired') : t('web.expiresAt', { time: formatDate(item.expiresAt) }) }}</span>
                <span v-if="isWeb && item.error" class="text-error">{{ item.error }}</span>
                <span v-if="!isWeb && item.fileExists === false" class="text-error">{{ t('history.fileMissing') }}</span>
                <span class="flex items-center gap-1">
                  <!-- 注意：`high_definition` 不是有效的 Symbols 名（会渲染成文字），正确名是 `hd` -->
                  <MaterialIcon name="hd" :size="14" />
                  {{ item.quality }}
                </span>
                <span class="flex items-center gap-1">
                  <MaterialIcon name="schedule" :size="14" />
                  {{ formatDate(item.createdAt) }}
                </span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex flex-col gap-2 justify-center">
              <button 
                class="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-md transition-colors"
                :title="item.fileExists === false ? t('history.fileMissing') : isWeb ? t('web.save') : t('history.openFile')"
                :disabled="item.fileExists === false || (isWeb && expired(item))"
                :class="{ 'opacity-40 cursor-not-allowed': item.fileExists === false }"
                @click="openFile(item)"
              >
                <MaterialIcon :name="isWeb ? 'download' : 'play_circle'" :size="20" />
              </button>
              <button 
                class="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/20 rounded-md transition-colors"
                v-if="!isWeb" :title="t('history.openFolder')"
                @click="openFolder(item)"
              >
                <MaterialIcon name="folder_open" :size="20" />
              </button>
              <button 
                class="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-md transition-colors"
                :title="t('history.deleteRecord')"
                @click="deleteHistory(item.id)"
              >
                <MaterialIcon name="delete" :size="20" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import MaterialIcon from './icons/MaterialIcon.vue'
import { t, locale } from '../i18n'
import { isWeb } from '../runtime-mode'
import type { HistoryRecord } from '../types'
import { useErrorModal } from '../composables/useErrorModal'
const { showError } = useErrorModal()
const now = ref(Date.now())
const clock = isWeb ? setInterval(() => { now.value = Date.now() }, 1000) : undefined
onUnmounted(() => clearInterval(clock))
const expired = (item: HistoryRecord) => !!item.expiresAt && Date.parse(item.expiresAt) <= now.value

const webStatus = (status: string) => ({ pending: t('web.status.pending'), downloading: t('web.status.downloading'), completed: t('web.status.completed'), error: t('web.status.error'), paused: t('web.status.paused') }[status] || status)

const history = ref<HistoryRecord[]>([])
let unsubscribe: (() => void) | undefined
let requestVersion = 0

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadHistory() {
  const version = ++requestVersion
  try {
    const updated = await window.electronAPI.history.get()
    if (version === requestVersion) history.value = updated
  } catch (e) {
    console.error('Failed to load history:', e)
  }
}

async function deleteHistory(id: string) {
  try {
    await window.electronAPI.history.delete(id)
    history.value = history.value.filter(h => h.id !== id)
  } catch (e: any) {
    if (isWeb) showError(e.message || t('web.requestFailed'))
    else console.error('Failed to delete history:', e)
  }
}

async function clearAllHistory() {
  if (!confirm(t('history.confirmClear'))) return
  
  try {
    for (const item of history.value) {
      await window.electronAPI.history.delete(item.id)
    }
    history.value = []
  } catch (e) {
    if (isWeb) showError(t('web.requestFailed'))
    else console.error('Failed to clear history:', e)
  }
}

async function openFile(item: HistoryRecord) {
  if (item.fileExists === false || (isWeb && expired(item))) return
  const result = await window.electronAPI.shell.openPath(item.filePath)
  if (isWeb && !result?.success) showError(result?.error || t('web.requestFailed'))
}

async function openFolder(item: HistoryRecord) {
  const sep = item.filePath.includes('\\') ? '\\' : '/'
  const dir = item.filePath.substring(0, item.filePath.lastIndexOf(sep))
  await window.electronAPI.shell.openPath(dir)
}

function onTabChanged(event: Event) {
  if ((event as CustomEvent).detail === 'history') void loadHistory()
}

onMounted(() => {
  // 订阅主进程广播，实时刷新历史列表
  if (window.electronAPI?.history?.onUpdated) {
    unsubscribe = window.electronAPI.history.onUpdated((updatedHistory) => {
      requestVersion++
      history.value = updatedHistory
    })
  }
  void loadHistory()
  window.addEventListener('focus', loadHistory)
  window.addEventListener('tab-changed', onTabChanged)
})

onUnmounted(() => {
  requestVersion++
  unsubscribe?.()
  window.removeEventListener('focus', loadHistory)
  window.removeEventListener('tab-changed', onTabChanged)
})
</script>
