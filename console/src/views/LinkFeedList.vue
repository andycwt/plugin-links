<script lang="ts" setup>
import type { Link, LinkFeedItem } from "@/api/generated";
import LinkFeedBackToTopButton from "@/components/LinkFeedBackToTopButton.vue";
import LinkFeedItemList from "@/components/LinkFeedItemList.vue";
import LinkFeedReadStatusTabs from "@/components/LinkFeedReadStatusTabs.vue";
import LinkFeedStatusBadge from "@/components/LinkFeedStatusBadge.vue";
import LinkFeedStatusModal from "@/components/LinkFeedStatusModal.vue";
import LinkFeedSubscriptionSidebar from "@/components/LinkFeedSubscriptionSidebar.vue";
import { aggregateLinkFeedStatusMeta, linkFeedStatusMeta } from "@/composables/link-feed-status";
import { useLinkFeedItems } from "@/composables/use-link-feed";
import { useLinkFeedHiddenState } from "@/composables/use-link-feed-hidden-state";
import { useLinkFeedItemSummary } from "@/composables/use-link-feed-item-summary";
import { useLinkFeedMarkAllRead, type LinkFeedMarkAllReadSummary } from "@/composables/use-link-feed-mark-all-read";
import { useLinkFeedRefresh, type LinkFeedRefreshSummary } from "@/composables/use-link-feed-refresh";
import { linkFeedUnreadCount, useLinkFeedUnreadSummary } from "@/composables/use-link-feed-unread-summary";
import { useRssLinksFetch } from "@/composables/use-link-fetch";
import { Dialog, IconArrowLeft, IconRefreshLine, Toast, VButton, VPageHeader, VSpace } from "@halo-dev/components";
import { utils } from "@halo-dev/ui-shared";
import { computed, defineAsyncComponent, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import CalendarTimeAddLineIcon from "~icons/mingcute/calendar-time-add-line?width=unset&height=unset";
import EyeCloseLineIcon from "~icons/mingcute/eye-close-line?width=unset&height=unset";
import MailOpenLineIcon from "~icons/mingcute/mail-open-line?width=unset&height=unset";
import MultiselectLineIcon from "~icons/mingcute/multiselect-line?width=unset&height=unset";
import Rss2FillIcon from "~icons/mingcute/rss-2-fill";
import StarLineIcon from "~icons/mingcute/star-line?width=unset&height=unset";

const LinkFeedItemsModal = defineAsyncComponent(() => import("@/components/LinkFeedItemsModal.vue"));
const LinkFeedHiddenItemsModal = defineAsyncComponent(() => import("@/components/LinkFeedHiddenItemsModal.vue"));

const router = useRouter();
const { data: groupsWithLinks, isLoading: isLoadingLinks } = useRssLinksFetch();

const favoriteModalVisible = shallowRef(false);
const readLaterModalVisible = shallowRef(false);
const statusModalVisible = shallowRef(false);
const hiddenModalVisible = shallowRef(false);
const mainFeed = useLinkFeedItems();
const { data: unreadSummary } = useLinkFeedUnreadSummary();
const { data: itemSummary, isError: isItemSummaryError } = useLinkFeedItemSummary();
const { isUpdating: isUpdatingHiddenState, setHiddenState } = useLinkFeedHiddenState();

const readLaterFeed = useLinkFeedItems({
  enabled: readLaterModalVisible,
  fixedFilter: {
    readLater: true,
  },
  useReadStatusFilter: false,
  useRouteLinkFilter: false,
});

const favoriteFeed = useLinkFeedItems({
  enabled: favoriteModalVisible,
  fixedFilter: {
    favorite: true,
  },
  useReadStatusFilter: false,
  useRouteLinkFilter: false,
});

const hiddenFeed = useLinkFeedItems({
  enabled: hiddenModalVisible,
  fixedFilter: {
    hidden: true,
  },
  useReadStatusFilter: false,
  useRouteLinkFilter: false,
});

const { selectedLinkName, selectedReadStatus, isFetching, selectLink, selectReadStatus } = mainFeed;
const { isMarkingAllRead, markAllRead } = useLinkFeedMarkAllRead();

const selectionMode = shallowRef(false);
const selectedIds = shallowRef<string[]>([]);
const mainItems = computed(() => mainFeed.items.value);
const selectedCount = computed(() => selectedIds.value.length);
const canManageHiddenState = computed(() => utils.permission.has(["plugin:links:manage"]));
const allLoadedSelected = computed(() => {
  return mainItems.value.length > 0 && mainItems.value.every((item) => item.id && selectedIds.value.includes(item.id));
});

watch([selectedLinkName, selectedReadStatus], () => {
  selectedIds.value = [];
});

const {
  isRefreshing: isRefreshingCurrentSubscription,
  totalCount: currentRefreshTotalCount,
  completedCount: currentRefreshCompletedCount,
  refreshLinks: refreshCurrentSubscriptions,
} = useLinkFeedRefresh();
const {
  isRefreshing: isRefreshingAllSubscriptions,
  totalCount: allRefreshTotalCount,
  completedCount: allRefreshCompletedCount,
  refreshLinks: refreshAllSubscriptions,
} = useLinkFeedRefresh();

const allLinks = computed(() => {
  return groupsWithLinks.value?.flatMap((group) => group.links) || [];
});

const linkByName = computed(() => {
  return new Map(allLinks.value.map((link) => [link.metadata.name, link]));
});

const selectedLink = computed(() => {
  return selectedLinkName.value ? linkByName.value.get(selectedLinkName.value) : undefined;
});

const totalFeedItemCount = computed(() => {
  return allLinks.value.reduce((total, link) => total + (link.status?.rss?.itemCount || 0), 0);
});

const totalUnreadCount = computed(() => {
  return unreadSummary.value?.totalUnreadCount || 0;
});

const selectedUnreadCount = computed(() => {
  return linkFeedUnreadCount(unreadSummary.value, selectedLink.value?.metadata.name);
});

const selectedSourceTitle = computed(() => {
  if (!selectedLink.value) {
    return "全部動態";
  }
  return selectedLink.value.spec?.displayName || selectedLink.value.metadata.name;
});

const selectedSourceMeta = computed(() => {
  if (!selectedLink.value) {
    return `${allLinks.value.length} 個訂閱 / ${totalFeedItemCount.value} 篇快取 / ${totalUnreadCount.value} 篇未讀`;
  }

  const feedCount = selectedLink.value.spec?.rss?.feedUrls?.filter((feedUrl) => !!feedUrl?.trim()).length || 0;
  const itemCount = selectedLink.value.status?.rss?.itemCount || 0;
  return `${feedCount} 個訂閱源 / ${itemCount} 篇快取 / ${selectedUnreadCount.value} 篇未讀`;
});

const selectedSourceStatus = computed(() => {
  if (selectedLink.value) {
    return linkFeedStatusMeta(selectedLink.value);
  }
  return aggregateLinkFeedStatusMeta(allLinks.value);
});

const markAllReadScopeLabel = computed(() => {
  if (!selectedLink.value) {
    return "全部訂閱";
  }
  return `「${selectedSourceTitle.value}」`;
});

const isRemoteRefreshing = computed(() => {
  return isRefreshingCurrentSubscription.value || isRefreshingAllSubscriptions.value;
});

const currentRefreshButtonText = computed(() => {
  return refreshButtonText(
    "獲取當前",
    isRefreshingCurrentSubscription.value,
    currentRefreshCompletedCount.value,
    currentRefreshTotalCount.value,
  );
});

const allRefreshButtonText = computed(() => {
  return refreshButtonText(
    "獲取全部",
    isRefreshingAllSubscriptions.value,
    allRefreshCompletedCount.value,
    allRefreshTotalCount.value,
  );
});

const refreshProgressText = computed(() => {
  if (isRefreshingCurrentSubscription.value) {
    return refreshProgressTextByCount(
      "正在獲取當前訂閱",
      currentRefreshCompletedCount.value,
      currentRefreshTotalCount.value,
    );
  }
  if (isRefreshingAllSubscriptions.value) {
    return refreshProgressTextByCount("正在獲取全部訂閱", allRefreshCompletedCount.value, allRefreshTotalCount.value);
  }
  return "";
});

const resolvedItemSummary = computed(() => {
  if (itemSummary.value === undefined || isItemSummaryError.value) {
    return undefined;
  }
  return itemSummary.value;
});
const summaryCount = (count: number | undefined) => {
  if (isItemSummaryError.value) {
    return undefined;
  }
  return resolvedItemSummary.value ? count : 0;
};
const readLaterCount = computed(() => summaryCount(resolvedItemSummary.value?.readLaterCount));
const favoriteCount = computed(() => summaryCount(resolvedItemSummary.value?.favoriteCount));
const hiddenCount = computed(() => summaryCount(resolvedItemSummary.value?.hiddenCount));

function sourceLink(linkName?: string): Link | undefined {
  if (!linkName) {
    return undefined;
  }
  return linkByName.value.get(linkName);
}

function sourceName(linkName?: string) {
  if (!linkName) {
    return "未知來源";
  }
  const link = sourceLink(linkName);
  if (link) {
    return link.spec?.displayName || link.metadata.name;
  }
  return isLoadingLinks.value ? "載入來源中" : "已刪除連結";
}

function openReadLaterModal() {
  readLaterModalVisible.value = true;
}

function openFavoriteModal() {
  favoriteModalVisible.value = true;
}

function openStatusModal() {
  statusModalVisible.value = true;
}

function openHiddenModal() {
  hiddenModalVisible.value = true;
}

async function reloadMainFeed() {
  selectedIds.value = [];
  await mainFeed.reload();
}

function enterSelectionMode() {
  if (!canManageHiddenState.value) {
    return;
  }
  selectedIds.value = [];
  selectionMode.value = true;
}

function exitSelectionMode() {
  selectedIds.value = [];
  selectionMode.value = false;
}

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
  selectedIds.value = mainItems.value.map((item) => item.id).filter((id): id is string => !!id);
}

function handleHideItem(item: LinkFeedItem) {
  if (!canManageHiddenState.value || !item.id || isUpdatingHiddenState.value) {
    return;
  }
  const title = item.title || item.url || "未命名文章";
  const itemId = item.id;

  Dialog.warning({
    title: "隱藏文章",
    description: `確認隱藏「${title}」嗎？隱藏後將從正常列表和公開訂閱中移除，可在「已隱藏」中恢復。`,
    confirmType: "primary",
    onConfirm: async () => {
      const result = await setHiddenState([itemId], true);
      if (!result) {
        return;
      }
      selectedIds.value = selectedIds.value.filter((id) => id !== itemId);
      showHideSummary(result.updatedCount);
    },
  });
}

function handleBatchHide() {
  if (!canManageHiddenState.value || !selectedCount.value || isUpdatingHiddenState.value) {
    return;
  }

  Dialog.warning({
    title: "隱藏所選文章",
    description: `確認隱藏所選的 ${selectedCount.value} 篇文章嗎？隱藏後將從正常列表和公開訂閱中移除，可在「已隱藏」中恢復。`,
    confirmType: "primary",
    onConfirm: async () => {
      const result = await setHiddenState(selectedIds.value, true);
      if (!result) {
        return;
      }
      exitSelectionMode();
      showHideSummary(result.updatedCount);
    },
  });
}

function showHideSummary(updatedCount: number) {
  if (!updatedCount) {
    Toast.info("所選文章已處於隱藏狀態");
    return;
  }
  Toast.success(`已隱藏 ${updatedCount} 篇文章`);
}

async function handleRefreshCurrentSubscription() {
  if (!selectedLink.value || isRemoteRefreshing.value) {
    return;
  }
  const summary = await refreshCurrentSubscriptions(selectedLink.value);
  await reloadMainFeed();
  showRefreshSummary(summary, "當前訂閱");
}

async function handleRefreshAllSubscriptions() {
  if (!allLinks.value.length || isRemoteRefreshing.value) {
    return;
  }
  const summary = await refreshAllSubscriptions(allLinks.value);
  await reloadMainFeed();
  showRefreshSummary(summary, "全部訂閱");
}

function handleMarkAllRead() {
  if (!allLinks.value.length || isMarkingAllRead.value) {
    return;
  }

  Dialog.warning({
    title: "全部標為已讀",
    description: `確認將${markAllReadScopeLabel.value}中的所有未讀文章標為已讀嗎？此操作會包含當前未載入的更早文章。`,
    confirmType: "primary",
    onConfirm: async () => {
      const scopeLabel = markAllReadScopeLabel.value;
      const summary = await markAllRead(selectedLinkName.value);
      await reloadMainFeed();
      showMarkAllReadSummary(summary, scopeLabel);
    },
  });
}

function showMarkAllReadSummary(summary: LinkFeedMarkAllReadSummary | undefined, scopeLabel: string) {
  if (!summary) {
    return;
  }

  if (!summary.updatedCount) {
    Toast.info(`${scopeLabel}中暫無未讀文章`);
    return;
  }

  Toast.success(`已將${scopeLabel}中的 ${summary.updatedCount} 篇文章標為已讀`);
}

function showRefreshSummary(summary: LinkFeedRefreshSummary | undefined, label: string) {
  if (!summary || !summary.totalCount) {
    return;
  }

  if (!summary.failureCount && !summary.partialFailureCount) {
    Toast.success(`${label}獲取完成：成功獲取 ${summary.successCount} 個訂閱`);
    return;
  }

  const resultText = refreshSummaryText(summary);
  if (summary.failureCount === summary.totalCount) {
    Toast.error(`${label}獲取失敗：${resultText}`);
    return;
  }

  Toast.warning(`${label}獲取完成：${resultText}`);
}

function refreshButtonText(label: string, refreshing: boolean, completedCount: number, totalCount: number) {
  if (!refreshing || !totalCount) {
    return label;
  }
  return `${label} ${completedCount}/${totalCount}`;
}

function refreshProgressTextByCount(label: string, completedCount: number, totalCount: number) {
  if (!totalCount) {
    return label;
  }
  return `${label}：${completedCount}/${totalCount}`;
}

function refreshSummaryText(summary: LinkFeedRefreshSummary) {
  return [
    summary.successCount ? `成功 ${summary.successCount} 個` : "",
    summary.partialFailureCount ? `部分失敗 ${summary.partialFailureCount} 個` : "",
    summary.failureCount ? `失敗 ${summary.failureCount} 個` : "",
  ]
    .filter(Boolean)
    .join("，");
}
</script>

<template>
  <VPageHeader title="連結訂閱">
    <template #icon>
      <Rss2FillIcon />
    </template>
    <template #actions>
      <VSpace>
        <VButton size="sm" @click="openReadLaterModal">
          <template #icon>
            <CalendarTimeAddLineIcon />
          </template>
          稍後閱讀{{ readLaterCount !== undefined ? ` (${readLaterCount})` : "" }}
        </VButton>
        <VButton size="sm" @click="openFavoriteModal">
          <template #icon>
            <StarLineIcon />
          </template>
          收藏{{ favoriteCount !== undefined ? ` (${favoriteCount})` : "" }}
        </VButton>
        <VButton size="sm" @click="openHiddenModal">
          <template #icon>
            <EyeCloseLineIcon />
          </template>
          已隱藏{{ hiddenCount !== undefined ? ` (${hiddenCount})` : "" }}
        </VButton>
        <VButton size="sm" @click="router.push({ name: 'Links' })">
          <template #icon>
            <IconArrowLeft />
          </template>
          返回連結
        </VButton>
      </VSpace>
    </template>
  </VPageHeader>

  <div class=":uno: p-4">
    <div class=":uno: feed-workspace">
      <LinkFeedSubscriptionSidebar
        :links="allLinks"
        :selected-link-name="selectedLinkName"
        :unread-summary="unreadSummary"
        :loading="isLoadingLinks"
        @select-link="selectLink"
      />

      <div class=":uno: feed-main">
        <div class=":uno: feed-brief">
          <div class=":uno: feed-brief__copy">
            <span class=":uno: feed-brief__eyebrow">RSS 動態</span>
            <div class=":uno: feed-brief__heading">
              <strong class=":uno: feed-brief__title">{{ selectedSourceTitle }}</strong>
              <LinkFeedStatusBadge
                :tone="selectedSourceStatus.tone"
                :label="selectedSourceStatus.label"
                :description="selectedSourceStatus.description"
                @open="openStatusModal"
              />
            </div>
            <span class=":uno: feed-brief__meta">{{ selectedSourceMeta }}</span>
          </div>
          <span v-if="refreshProgressText" class=":uno: feed-refresh-status" role="status">
            {{ refreshProgressText }}
          </span>
        </div>

        <div class=":uno: feed-toolbar">
          <LinkFeedReadStatusTabs :selected-status="selectedReadStatus" @select="selectReadStatus" />
          <div class=":uno: feed-toolbar__actions">
            <VSpace v-if="selectionMode && canManageHiddenState" class=":uno: flex-wrap">
              <span class=":uno: feed-selection-status" role="status">已選 {{ selectedCount }} 篇</span>
              <VButton size="sm" ghost :disabled="!mainItems.length || allLoadedSelected" @click="selectAllLoaded">
                全選已載入
              </VButton>
              <VButton size="sm" ghost @click="exitSelectionMode">取消</VButton>
              <VButton size="sm" :disabled="!selectedCount" :loading="isUpdatingHiddenState" @click="handleBatchHide">
                隱藏所選{{ selectedCount ? ` (${selectedCount})` : "" }}
              </VButton>
            </VSpace>
            <VSpace v-else class=":uno: flex-wrap">
              <VButton
                size="sm"
                :disabled="!selectedLink || isRemoteRefreshing"
                :loading="isRefreshingCurrentSubscription"
                @click="handleRefreshCurrentSubscription"
              >
                <template #icon>
                  <IconRefreshLine />
                </template>
                {{ currentRefreshButtonText }}
              </VButton>
              <VButton
                size="sm"
                :disabled="!allLinks.length || isRemoteRefreshing"
                :loading="isRefreshingAllSubscriptions"
                @click="handleRefreshAllSubscriptions"
              >
                <template #icon>
                  <IconRefreshLine />
                </template>
                {{ allRefreshButtonText }}
              </VButton>
              <VButton
                size="sm"
                :disabled="!allLinks.length || isMarkingAllRead"
                :loading="isMarkingAllRead"
                @click="handleMarkAllRead"
              >
                <template #icon>
                  <MailOpenLineIcon />
                </template>
                全部標為已讀
              </VButton>
              <VButton v-if="canManageHiddenState" size="sm" :disabled="!mainItems.length" @click="enterSelectionMode">
                <template #icon>
                  <MultiselectLineIcon />
                </template>
                批次選擇
              </VButton>
            </VSpace>
            <VButton size="sm" ghost :loading="isFetching" @click="reloadMainFeed()">
              <template #icon>
                <IconRefreshLine />
              </template>
              重新整理列表
            </VButton>
          </div>
        </div>

        <LinkFeedItemList
          :feed="mainFeed"
          :source-name="sourceName"
          empty-text="暫無訂閱動態"
          :selectable="selectionMode && canManageHiddenState"
          :selected-ids="selectedIds"
          :hideable="canManageHiddenState"
          @toggle-select="toggleSelect"
          @hide="handleHideItem"
        />
      </div>
    </div>
  </div>

  <LinkFeedBackToTopButton />

  <LinkFeedItemsModal
    v-if="readLaterModalVisible"
    title="稍後閱讀"
    :feed="readLaterFeed"
    :source-name="sourceName"
    empty-text="暫無稍後閱讀文章"
    @close="readLaterModalVisible = false"
  />

  <LinkFeedItemsModal
    v-if="favoriteModalVisible"
    title="收藏文章"
    :feed="favoriteFeed"
    :source-name="sourceName"
    empty-text="暫無收藏文章"
    item-action-mode="favorite-only"
    @close="favoriteModalVisible = false"
  />

  <LinkFeedHiddenItemsModal
    v-if="hiddenModalVisible"
    :feed="hiddenFeed"
    :source-name="sourceName"
    :can-manage="canManageHiddenState"
    @close="hiddenModalVisible = false"
  />

  <LinkFeedStatusModal
    v-if="statusModalVisible"
    :links="allLinks"
    :selected-link-name="selectedLinkName"
    :unread-summary="unreadSummary"
    @close="statusModalVisible = false"
  />
</template>

<style scoped>
.feed-workspace {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
}

.feed-main {
  min-width: 0;
  flex: 1;
}

.feed-brief {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgb(229 231 235);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.92), rgb(250 250 250 / 0.88)),
    repeating-linear-gradient(135deg, rgb(24 24 27 / 0.035) 0 1px, transparent 1px 12px);
  padding: 1rem;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.feed-brief__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feed-brief__heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.feed-brief__eyebrow {
  color: rgb(113 113 122);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1rem;
}

.feed-brief__title {
  min-width: 0;
  overflow: hidden;
  color: rgb(24 24 27);
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.5rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-brief__meta,
.feed-refresh-status {
  color: rgb(113 113 122);
  font-size: 0.8125rem;
  line-height: 1.125rem;
}

.feed-refresh-status {
  flex: none;
  border: 1px solid rgb(229 231 235);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.76);
  padding: 0.375rem 0.625rem;
}

.feed-selection-status {
  align-self: center;
  color: rgb(113 113 122);
  font-size: 0.8125rem;
  line-height: 1.125rem;
  white-space: nowrap;
}

.feed-toolbar {
  position: sticky;
  top: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0.75rem 0;
  border: 1px solid rgb(229 231 235);
  border-radius: 8px;
  background: rgb(255 255 255 / 0.9);
  padding: 0.5rem;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
  backdrop-filter: blur(14px);
  flex-wrap: wrap;
}

.feed-toolbar__actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (min-width: 1024px) {
  .feed-workspace {
    flex-direction: row;
    align-items: flex-start;
  }
}

@media (max-width: 767px) {
  .feed-brief,
  .feed-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .feed-refresh-status {
    align-self: flex-start;
  }

  .feed-toolbar__actions {
    justify-content: flex-start;
  }
}
</style>
