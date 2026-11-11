<script lang="ts" setup>
import { linkAiApiClient } from "@/api";
import type { LinkApplication } from "@/api/generated";
import LinksCard from "@/components/LinksCard.vue";
import { runLinkVerification } from "@/composables/link-verification";
import {
  matchesLinkVerificationStatusFilter,
  type LinkVerificationStatusFilter,
} from "@/composables/link-verification-status";
import { useLinkApplications } from "@/composables/use-link-application";
import { useLinksFetch, type GroupWithLinks } from "@/composables/use-link-fetch";
import { isCommentRecognitionUnavailable } from "@/utils/link-application-origin";
import {
  Dialog,
  IconExternalLinkLine,
  IconRefreshLine,
  VAlert,
  VButton,
  VLoading,
  VPageHeader,
  VSpace,
} from "@halo-dev/components";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, defineAsyncComponent, ref, shallowRef } from "vue";
import RiLinksLine from "~icons/ri/links-line";
import RiPulseLine from "~icons/ri/pulse-line";

const GroupCreationModal = defineAsyncComponent(() => import("@/components/GroupCreationModal.vue"));
const GroupSortModal = defineAsyncComponent(() => import("@/components/GroupSortModal.vue"));
const LinkImportModal = defineAsyncComponent(() => import("@/components/LinkImportModal.vue"));
const LinkApplicationListModal = defineAsyncComponent(() => import("@/components/LinkApplicationListModal.vue"));
const LinkApplicationDetailModal = defineAsyncComponent(() => import("@/components/LinkApplicationDetailModal.vue"));

const { data, isLoading, isFetching, refetch } = useLinksFetch();
const { data: pendingApplicationsPage } = useLinkApplications({ page: 1, size: 1, status: "PENDING" });
const { data: aiStatus } = useQuery({
  queryKey: ["plugin:links:ai-status"],
  queryFn: async () => {
    const { data: status } = await linkAiApiClient.ai.getLinkAiFeatureStatus();
    return status;
  },
  retry: false,
});
const queryClient = useQueryClient();

const handleRouteToFront = () => {
  window.open("/links", "_blank");
};

const groupCreationModalVisible = ref(false);
const groupSortModalVisible = ref(false);
const linkImportModalVisible = ref(false);
const linkApplicationListModalVisible = ref(false);
const linkApplicationInitialStatus = shallowRef("");
const linkApplicationDetailVisible = ref(false);
const selectedApplication = ref<LinkApplication | undefined>(undefined);
const isVerifyingAllLinks = shallowRef(false);
const selectedStatusFilter = shallowRef<LinkVerificationStatusFilter>("all");

const pendingCount = computed(() => pendingApplicationsPage.value?.total ?? 0);
const recognitionUnavailable = computed(() => isCommentRecognitionUnavailable(aiStatus.value));

function openLinkApplicationList(initialStatus = "") {
  linkApplicationInitialStatus.value = initialStatus;
  linkApplicationListModalVisible.value = true;
}

const statusFilterOptions: Array<{ label: string; value: LinkVerificationStatusFilter }> = [
  { label: "全部", value: "all" },
  { label: "訪問異常的連結", value: "access-error" },
  { label: "沒有反鏈的連結", value: "backlink-missing" },
];

const filteredGroups = computed(() => filterGroupsByStatus(data.value || [], selectedStatusFilter.value));

function handleVerifyAllLinks() {
  if (isVerifyingAllLinks.value) {
    return;
  }

  Dialog.warning({
    title: "確認檢測全部連結？",
    description: "系統會在後台按佇列逐個檢測所有連結。檢測可能需要一定時間，請稍後重新整理頁面檢視。確認繼續嗎？",
    confirmType: "primary",
    onConfirm: verifyAllLinks,
  });
}

async function verifyAllLinks() {
  if (isVerifyingAllLinks.value) {
    return;
  }

  isVerifyingAllLinks.value = true;
  try {
    await runLinkVerification({
      queryClient,
      showSuccess: true,
    });
  } finally {
    isVerifyingAllLinks.value = false;
  }
}

function filterGroupsByStatus(groups: GroupWithLinks[], filter: LinkVerificationStatusFilter) {
  if (filter === "all") {
    return groups;
  }

  return groups
    .map((groupWithLinks) => ({
      ...groupWithLinks,
      links: groupWithLinks.links.filter((link) => matchesLinkVerificationStatusFilter(link, filter)),
    }))
    .filter((groupWithLinks) => groupWithLinks.links.length > 0);
}
</script>
<template>
  <VPageHeader title="連結">
    <template #icon>
      <RiLinksLine />
    </template>
    <template #actions>
      <VButton @click="handleRouteToFront" size="sm" ghost>
        <template #icon>
          <IconExternalLinkLine />
        </template>
        跳轉到前臺
      </VButton>
    </template>
  </VPageHeader>
  <div class=":uno: p-4">
    <VAlert
      v-if="recognitionUnavailable"
      title="評論友鏈申請自動識別當前不可用"
      type="warning"
      :closable="false"
      class=":uno: mb-4"
    >
      <template #description>
        自動識別已配置，但 AI Foundation 或所選模型當前不可用。新的評論不會補償處理，其他連結管理功能不受影響。
      </template>
    </VAlert>

    <VAlert
      v-if="pendingCount > 0"
      :title="`有 ${pendingCount} 條待稽核的友鏈申請`"
      type="default"
      :closable="false"
      class=":uno: mb-4"
    >
      <template #description>
        <button @click="openLinkApplicationList('PENDING')" class=":uno: cursor-pointer hover:underline">
          檢視並處理申請
        </button>
      </template>
    </VAlert>

    <div
      class=":uno: mb-4 flex flex-col gap-3 border border-gray-200 rounded-lg bg-white/90 p-3 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      <VSpace class=":uno: flex-wrap">
        <VButton size="sm" @click="groupCreationModalVisible = true">新建分組</VButton>
        <VButton size="sm" @click="groupSortModalVisible = true">調整排序</VButton>
        <VButton size="sm" @click="linkImportModalVisible = true">批次匯入</VButton>
        <VButton size="sm" @click="openLinkApplicationList()">友鏈申請</VButton>
        <VButton size="sm" :loading="isVerifyingAllLinks" @click="handleVerifyAllLinks">
          <template #icon>
            <RiPulseLine />
          </template>
          檢測全部
        </VButton>
      </VSpace>

      <div class=":uno: flex items-center gap-2">
        <FilterDropdown v-model="selectedStatusFilter" label="狀態" :items="statusFilterOptions" />

        <button
          v-tooltip="'重新整理'"
          type="button"
          class=":uno: group cursor-pointer rounded p-1 hover:bg-gray-200"
          @click="refetch()"
        >
          <IconRefreshLine
            :class="{ ':uno: animate-spin text-gray-900': isFetching }"
            class=":uno: h-4 w-4 text-gray-600 group-hover:text-gray-900"
          />
        </button>
      </div>
    </div>

    <VLoading v-if="isLoading" />

    <div class=":uno: space-y-4" v-else-if="filteredGroups.length">
      <LinksCard
        v-for="groupWithLinks in filteredGroups"
        :group-with-links="groupWithLinks"
        :key="groupWithLinks.group?.metadata.name"
      >
      </LinksCard>
    </div>
    <div
      v-else
      class=":uno: border border-gray-200 rounded-lg border-dashed bg-white py-12 text-center text-sm text-gray-500"
    >
      暫無符合條件的連結
    </div>
  </div>

  <GroupCreationModal v-if="groupCreationModalVisible" @close="groupCreationModalVisible = false" />
  <GroupSortModal v-if="groupSortModalVisible" @close="groupSortModalVisible = false" />
  <LinkImportModal v-if="linkImportModalVisible" @close="linkImportModalVisible = false" />
  <LinkApplicationListModal
    v-if="linkApplicationListModalVisible"
    :initial-status="linkApplicationInitialStatus"
    @close="linkApplicationListModalVisible = false"
    @view-detail="
      (app: LinkApplication) => {
        selectedApplication = app;
        linkApplicationDetailVisible = true;
      }
    "
  />
  <LinkApplicationDetailModal
    v-if="linkApplicationDetailVisible && selectedApplication"
    :application="selectedApplication"
    @close="linkApplicationDetailVisible = false"
  />
</template>
