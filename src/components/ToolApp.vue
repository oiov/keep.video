<template>
  <div class="relative flex w-full flex-col bg-surface web-tool" data-tool-root>
    <DownloadView />
    <ErrorModal
      :visible="modalState.visible"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :detail="modalState.detail"
      :hint="modalState.hint"
      :kind="modalState.kind"
      @update:visible="modal.close()"
    />
  </div>
</template>

<script setup lang="ts">
// 内容页里只放工具本体：没有页头、没有标签页、没有设置与更新入口。
// 与 App.vue 的 Web 形态共用同一个 DownloadView，避免两套表单逻辑。
import DownloadView from './DownloadView.vue'
import ErrorModal from './ErrorModal.vue'
import { useErrorModal } from '../composables/useErrorModal'

const modal = useErrorModal()
const modalState = modal.state
</script>
