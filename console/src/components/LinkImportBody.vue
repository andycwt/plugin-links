<script lang="ts" setup>
import type { LinkGroup } from "@/api/generated";
import { useLinkGroupFetch } from "@/composables/use-group-fetch";
import { type LinkImportSubmitData, useLinkImport } from "@/composables/use-link-import";
import { Toast, VButton, VSpace } from "@halo-dev/components";
import { computed, watch } from "vue";
import LinkImportPreviewTable from "./LinkImportPreviewTable.vue";

const props = defineProps<{
  group?: LinkGroup;
  isImporting?: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", data: LinkImportSubmitData): void;
}>();

const { data: groups } = useLinkGroupFetch();
const {
  step,
  rawText,
  selectedGroupName,
  enableScraping,
  parsedItems,
  isParsing,
  previewSummary,
  importableCount,
  parseInput,
  backToPaste,
  getImportableItems,
} = useLinkImport({
  initialGroupName: props.group?.metadata.name,
});

watch(
  () => props.group?.metadata.name,
  (groupName) => {
    selectedGroupName.value = groupName || "";
  },
  { immediate: true },
);

const groupOptions = computed(() => [
  { value: "", label: "未分組" },
  ...(groups.value || []).flatMap((group) => {
    const name = group.metadata?.name;
    if (!name) {
      return [];
    }
    return {
      value: name,
      label: group.spec?.displayName || name,
    };
  }),
]);

async function handleParse() {
  const parsed = await parseInput();
  if (!parsed) {
    Toast.warning("請輸入連結列表");
  }
}

function handleImport() {
  const itemsToImport = getImportableItems();
  if (itemsToImport.length === 0) {
    Toast.warning("沒有可匯入的連結");
    return;
  }
  emit("submit", { items: itemsToImport, groupName: selectedGroupName.value });
}
</script>

<template>
  <div class=":uno: h-full flex flex-col">
    <div class=":uno: flex-1 overflow-y-auto">
      <div v-show="step === 'paste'" class=":uno: space-y-4">
        <div v-if="!group">
          <FormKit v-model="selectedGroupName" type="select" label="匯入到分組" :options="groupOptions" />
        </div>

        <FormKit
          v-model="rawText"
          type="code"
          label="連結列表"
          help="每行一個，格式：URL|名稱|描述|圖示"
          language="yaml"
          height="260px"
          placeholder="https://example.com|示例網站|這是一個示例網站|https://example.com/favicon.ico"
          :classes="{ inner: '!max-w-none' }"
        />

        <FormKit
          v-model="enableScraping"
          type="checkbox"
          label="線上解析（自動抓取標題、描述、圖示）"
          help="解析時間較長，請耐心等待"
        />
      </div>

      <div v-show="step === 'preview'" class=":uno: space-y-4">
        <div class=":uno: rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          共解析 {{ previewSummary.total }} 條，線上解析 {{ previewSummary.scraped }} 條，手動
          {{ previewSummary.manual }} 條，失敗 {{ previewSummary.failed }} 條，已選
          {{ previewSummary.selected }} 條，可匯入 {{ importableCount }} 條
        </div>

        <LinkImportPreviewTable v-model:items="parsedItems" />
      </div>
    </div>

    <div class=":uno: flex justify-start border-t border-gray-100 pt-4">
      <template v-if="step === 'paste'">
        <VButton type="secondary" :loading="isParsing" @click="handleParse">解析</VButton>
      </template>
      <template v-else>
        <VSpace>
          <VButton type="secondary" :loading="props.isImporting" @click="handleImport">
            確認匯入（{{ importableCount }}）
          </VButton>
          <VButton :disabled="props.isImporting" @click="backToPaste">返回</VButton>
        </VSpace>
      </template>
    </div>
  </div>
</template>
