<script lang="ts" setup>
import { linksConsoleApiClient, linksCoreApiClient } from "@/api";
import type { Link, LinkGroupVo } from "@/api/generated";
import { runLinkVerification } from "@/composables/link-verification";
import { QK_LINK_GROUPS, useLinkGroupFetch } from "@/composables/use-group-fetch";
import { invalidateLinkFeedItemSummary } from "@/composables/use-link-feed-item-summary";
import { QK_GROUPS_WITH_LINKS, type GroupWithLinks } from "@/composables/use-link-fetch";
import {
  Dialog,
  IconArrowLeft,
  IconArrowRight,
  IconMore,
  Toast,
  VButton,
  VCard,
  VDropdown,
  VDropdownItem,
  VSpace,
} from "@halo-dev/components";
import { useQueryClient } from "@tanstack/vue-query";
import { chunk } from "es-toolkit";
import { computed, defineAsyncComponent, ref, shallowRef } from "vue";
import LinkBadge from "./LinkBadge.vue";
import LinksSortableCard from "./LinksSortableCard.vue";

const GroupEditingModal = defineAsyncComponent(() => import("./GroupEditingModal.vue"));
const LinkCreationModal = defineAsyncComponent(() => import("./LinkCreationModal.vue"));
const LinkEditingModal = defineAsyncComponent(() => import("./LinkEditingModal.vue"));

const props = defineProps<{
  groupWithLinks: GroupWithLinks;
}>();

const group = computed(() => props.groupWithLinks.group);
const links = computed(() => props.groupWithLinks.links);

const queryClient = useQueryClient();

const { data: groups } = useLinkGroupFetch();

const otherGroups = computed(
  () => groups.value?.filter((i) => i.metadata?.name && i.metadata.name !== group.value?.metadata?.name) || [],
);

const creationModalVisible = ref(false);

const groupEditingModalVisible = ref(false);

const enabledSort = ref(false);
const enabledSelect = ref(false);
const isVerifyingGroup = shallowRef(false);
const isVerifyingSelectedLinks = shallowRef(false);

const selectedLinkNames = ref<string[]>([]);

const selectedLink = ref<Link | undefined>();
const linkEditingModalVisible = ref(false);

function handleOpenEdit(link: Link) {
  selectedLink.value = link;
  linkEditingModalVisible.value = true;
}

function handleSelectPrevious() {
  if (!links.value.length) return;
  const currentIndex = links.value.findIndex((link) => link.metadata.name === selectedLink.value?.metadata.name);
  if (currentIndex > 0) {
    selectedLink.value = links.value[currentIndex - 1];
  } else if (currentIndex <= 0) {
    selectedLink.value = undefined;
  }
}

function handleSelectNext() {
  if (!links.value.length) return;
  if (!selectedLink.value) {
    selectedLink.value = links.value[0];
    return;
  }
  const currentIndex = links.value.findIndex((link) => link.metadata.name === selectedLink.value?.metadata.name);
  if (currentIndex !== links.value.length - 1) {
    selectedLink.value = links.value[currentIndex + 1];
  }
}

function handleEditingModalClose() {
  linkEditingModalVisible.value = false;
  selectedLink.value = undefined;
}

function handleSelectAll() {
  selectedLinkNames.value = links.value.map((link) => link.metadata.name);
}

async function handleVerifyGroup() {
  if (!links.value.length || isVerifyingGroup.value) {
    return;
  }

  isVerifyingGroup.value = true;
  try {
    await runLinkVerification({
      request: group.value
        ? { groupName: group.value.metadata.name }
        : { names: links.value.map((link) => link.metadata.name) },
      queryClient,
      showSuccess: true,
    });
  } finally {
    isVerifyingGroup.value = false;
  }
}

async function handleVerifySelectedLinks() {
  if (!selectedLinkNames.value.length || isVerifyingSelectedLinks.value) {
    return;
  }

  isVerifyingSelectedLinks.value = true;
  try {
    const result = await runLinkVerification({
      request: { names: selectedLinkNames.value },
      queryClient,
      showSuccess: true,
    });
    if (result) {
      enabledSelect.value = false;
      selectedLinkNames.value.length = 0;
    }
  } finally {
    isVerifyingSelectedLinks.value = false;
  }
}

function handleDeleteInBatch() {
  Dialog.warning({
    title: "是否確認刪除選中的連結？",
    description: "刪除之後將無法恢復。",
    confirmType: "danger",
    onConfirm: async () => {
      const chunks = chunk(selectedLinkNames.value, 5);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((linkName) =>
            linksCoreApiClient.link.deleteLink({
              name: linkName,
            }),
          ),
        );
      }

      Toast.success("刪除成功");
      queryClient.invalidateQueries({ queryKey: [QK_GROUPS_WITH_LINKS] });
      await invalidateLinkFeedItemSummary(queryClient);
      enabledSelect.value = false;
      selectedLinkNames.value.length = 0;
    },
  });
}

function handleMoveToGroup(group: LinkGroupVo) {
  const targetName = group.metadata?.name;
  if (!targetName) {
    return;
  }
  Dialog.warning({
    title: "移動到分組",
    description: `確認將選中的連結移動到${group.spec?.displayName}分組嗎？`,
    confirmType: "danger",
    onConfirm: async () => {
      const chunks = chunk(selectedLinkNames.value, 5);

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map((linkName) =>
            linksCoreApiClient.link.patchLink({
              name: linkName,
              jsonPatchInner: [{ op: "add", path: "/spec/groupName", value: targetName }],
            }),
          ),
        );
      }

      Toast.success("移動成功");
      queryClient.invalidateQueries({ queryKey: [QK_LINK_GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QK_GROUPS_WITH_LINKS] });
      enabledSelect.value = false;
      selectedLinkNames.value.length = 0;
    },
  });
}

function handleDelete({ deleteLinks }: { deleteLinks: boolean }) {
  const title = deleteLinks ? "刪除分組及連結" : "僅刪除分組";
  const description = deleteLinks
    ? `將同時刪除該分組下所有連結，此操作不可恢復。`
    : `該分組下的連結將變為未分組，此操作不可恢復。`;

  Dialog.warning({
    title,
    description,
    confirmType: "danger",
    onConfirm: async () => {
      if (!group.value) {
        return;
      }
      await linksConsoleApiClient.group.deleteLinkGroup({
        name: group.value.metadata.name,
        deleteLinks,
      });
      Toast.success("刪除成功");
      queryClient.invalidateQueries({ queryKey: [QK_LINK_GROUPS] });
      queryClient.invalidateQueries({ queryKey: [QK_GROUPS_WITH_LINKS] });
      if (deleteLinks) {
        await invalidateLinkFeedItemSummary(queryClient);
      }
    },
  });
}
</script>
<template>
  <LinksSortableCard v-if="enabledSort" :group-with-links="groupWithLinks" @close="enabledSort = false" />
  <VCard v-else>
    <template #header>
      <div class=":uno: w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div class=":uno: flex flex-wrap items-center gap-3">
          <div class=":uno: text-sm text-gray-900 font-semibold">
            {{ group?.spec?.displayName || "未分組" }}（{{ links.length }}）
          </div>
          <VSpace v-if="enabledSelect" class=":uno: flex-wrap">
            <VButton size="sm" @click="handleSelectAll">全選</VButton>
            <VButton size="sm" @click="selectedLinkNames.length = 0">清空選擇</VButton>
            <VButton
              size="sm"
              :disabled="selectedLinkNames.length === 0"
              :loading="isVerifyingSelectedLinks"
              @click="handleVerifySelectedLinks"
            >
              檢測
            </VButton>
            <VDropdown>
              <VButton size="sm" :disabled="selectedLinkNames.length === 0 || !otherGroups?.length">移動</VButton>
              <template #popper>
                <VDropdownItem
                  @click="handleMoveToGroup(item)"
                  v-for="item in otherGroups"
                  :key="item.metadata?.name"
                  :value="item.metadata?.name"
                >
                  {{ item.spec?.displayName }}
                </VDropdownItem>
              </template>
            </VDropdown>
            <VButton size="sm" type="danger" :disabled="selectedLinkNames.length === 0" @click="handleDeleteInBatch">
              刪除
            </VButton>
            <VButton size="sm" @click="enabledSelect = false">取消</VButton>
          </VSpace>
          <VSpace v-else class=":uno: flex-wrap">
            <VDropdown v-if="links.length || group">
              <VButton size="sm" ghost>
                <IconMore />
              </VButton>
              <template #popper>
                <VDropdownItem v-if="links.length" @click="enabledSort = true">排序</VDropdownItem>
                <VDropdownItem v-if="links.length" @click="enabledSelect = true">批次選擇</VDropdownItem>
                <VDropdownItem v-if="links.length" @click="handleVerifyGroup">
                  {{ isVerifyingGroup ? "檢測中..." : "檢測本組" }}
                </VDropdownItem>
                <VDropdownItem v-if="group" @click="groupEditingModalVisible = true">編輯分組</VDropdownItem>
                <VDropdown>
                  <VDropdownItem v-if="group" type="danger">刪除分組</VDropdownItem>
                  <template #popper>
                    <VDropdownItem v-if="group" type="danger" @click="handleDelete({ deleteLinks: false })">
                      僅刪除分組
                    </VDropdownItem>
                    <VDropdownItem v-if="group" type="danger" @click="handleDelete({ deleteLinks: true })">
                      刪除分組及連結
                    </VDropdownItem>
                  </template>
                </VDropdown>
              </template>
            </VDropdown>
          </VSpace>
        </div>
        <div>
          <VButton type="secondary" size="sm" @click="creationModalVisible = true">新建</VButton>
        </div>
      </div>
    </template>
    <div v-if="!links.length" class=":uno: px-4 py-3 text-center text-sm text-gray-500">此分組下暫無連結</div>
    <div
      class=":uno: grid grid-cols-1 gap-2.5 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4"
      v-else
    >
      <LinkBadge
        v-for="link in links"
        :key="link.metadata.name"
        :link="link"
        :group-name="group?.metadata.name"
        :groups="groups"
        :select-mode="enabledSelect"
        @open-edit="handleOpenEdit(link)"
      >
        <template #checkbox>
          <input type="checkbox" v-model="selectedLinkNames" :value="link.metadata.name" />
        </template>
      </LinkBadge>
    </div>
  </VCard>

  <LinkCreationModal v-if="creationModalVisible" :group="group" @close="creationModalVisible = false" />

  <GroupEditingModal
    v-if="groupEditingModalVisible && group"
    :group="group"
    @close="groupEditingModalVisible = false"
  />

  <LinkEditingModal
    v-if="linkEditingModalVisible && selectedLink"
    :link="selectedLink"
    @close="handleEditingModalClose"
  >
    <template #append-actions>
      <span @click="handleSelectPrevious">
        <IconArrowLeft />
      </span>
      <span @click="handleSelectNext">
        <IconArrowRight />
      </span>
    </template>
  </LinkEditingModal>
</template>
