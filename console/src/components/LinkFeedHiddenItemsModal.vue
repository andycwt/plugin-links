<script lang="ts" setup>
import type { LinkFeedItem } from "@/api/generated";
import type { LinkFeedItems } from "@/composables/use-link-feed";
import { useLinkFeedHiddenState } from "@/composables/use-link-feed-hidden-state";
import { Dialog, Toast, VButton, VModal, VSpace } from "@halo-dev/components";
import { computed, shallowRef, useTemplateRef } from "vue";
import LinkFeedItemList from "./LinkFeedItemList.vue";

const emit = defineEmits<{
  (event: "close"): void;
}>();

const modal = useTemplateRef<InstanceType<typeof VModal> | null>("modal");
const props = withDefaults(
  defineProps<{
    feed: LinkFeedItems;
    sourceName: (linkName?: string) => string;
    canManage?: boolean;
  }>(),
  {
    canManage: false,
  },
);

const { isUpdating, setHiddenState } = useLinkFeedHiddenState();

const selectedIds = shallowRef<string[]>([]);
const items = computed(() => props.feed.items.value);
const isLoading = computed(() => props.feed.isLoading.value);
const selectedCount = computed(() => selectedIds.value.length);
const allLoadedSelected = computed(() => {
  return items.value.length > 0 && items.value.every((item) => item.id && selectedIds.value.includes(item.id));
});

function toggleSelect(item: LinkFeedItem) {
  if (!item.id) {
    return;
  }
  if (selectedIds.value.includes(item.id)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== item.id);
  } else {
    selectedIds.value = [...selectedIds.value, item.id];
  }
}

function selectAllLoaded() {
  selectedIds.value = items.value.map((item) => item.id).filter((id): id is string => !!id);
}

function clearSelection() {
  selectedIds.value = [];
}

async function handleUnhide(item: LinkFeedItem) {
  if (!props.canManage || !item.id || isUpdating.value) {
    return;
  }
  const result = await setHiddenState([item.id], false);
  if (!result) {
    return;
  }
  clearSelection();
  showUnhideSummary(result.updatedCount);
}

function handleBatchUnhide() {
  if (!props.canManage || !selectedCount.value || isUpdating.value) {
    return;
  }

  Dialog.warning({
    title: "恢復所選文章",
    description: `確認恢復所選的 ${selectedCount.value} 篇已隱藏文章嗎？恢復後將重新出現在正常列表和公開訂閱中。`,
    confirmType: "primary",
    onConfirm: async () => {
      const result = await setHiddenState(selectedIds.value, false);
      if (!result) {
        return;
      }
      clearSelection();
      showUnhideSummary(result.updatedCount);
    },
  });
}

function showUnhideSummary(updatedCount: number) {
  if (!updatedCount) {
    Toast.info("所選文章已處於可見狀態");
    return;
  }
  Toast.success(`已恢復 ${updatedCount} 篇文章`);
}

async function handleReload() {
  clearSelection();
  await props.feed.reload();
}
</script>

<template>
  <VModal ref="modal" :centered="false" title="已隱藏文章" :mount-to-body="true" :width="860" @close="emit('close')">
    <div class=":uno: hidden-feed">
      <div v-if="canManage" class=":uno: hidden-feed__toolbar">
        <span class=":uno: hidden-feed__selection" role="status">
          {{ selectedCount ? `已選 ${selectedCount} 篇` : "勾選文章後可批次恢復" }}
        </span>
        <VSpace class=":uno: flex-wrap">
          <VButton size="sm" ghost :disabled="!items.length || allLoadedSelected" @click="selectAllLoaded">
            全選已載入
          </VButton>
          <VButton size="sm" ghost :disabled="!selectedCount" @click="clearSelection">取消選擇</VButton>
          <VButton size="sm" :disabled="!selectedCount" :loading="isUpdating" @click="handleBatchUnhide">
            恢復所選{{ selectedCount ? ` (${selectedCount})` : "" }}
          </VButton>
        </VSpace>
      </div>

      <LinkFeedItemList
        :feed="feed"
        :source-name="sourceName"
        empty-text="暫無已隱藏文章"
        item-action-mode="hidden"
        :selectable="canManage"
        :unhideable="canManage"
        :selected-ids="selectedIds"
        @toggle-select="toggleSelect"
        @unhide="handleUnhide"
      />
    </div>

    <template #footer>
      <VSpace>
        <VButton type="secondary" :loading="isLoading" @click="handleReload()">重新載入</VButton>
        <VButton @click="modal?.close()">關閉</VButton>
      </VSpace>
    </template>
  </VModal>
</template>

<style scoped>
.hidden-feed {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
}

.hidden-feed__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.hidden-feed__selection {
  color: rgb(113 113 122);
  font-size: 0.8125rem;
  line-height: 1.125rem;
}

@media (max-width: 767px) {
  .hidden-feed__toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
