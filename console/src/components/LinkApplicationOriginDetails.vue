<script lang="ts" setup>
import type { LinkApplication } from "@/api/generated";
import { useLinkApplicationOriginComment } from "@/composables/use-link-application";
import { htmlToPlainText } from "@/utils/comment-content";
import { linkApplicationCommentRoute, linkApplicationSubjectMeta } from "@/utils/link-application-origin";
import { linkApplicationOriginCommentErrorState } from "@/utils/link-application-review";
import { IconExternalLinkLine } from "@halo-dev/components";
import { utils } from "@halo-dev/ui-shared";
import { computed } from "vue";

const props = defineProps<{
  application: LinkApplication;
}>();

const origin = computed(() => props.application.spec.origin);

const { data: originComment, isLoading, error } = useLinkApplicationOriginComment(computed(() => props.application));

const errorState = computed(() => (error.value ? linkApplicationOriginCommentErrorState(error.value) : undefined));

const subject = computed(() => linkApplicationSubjectMeta(originComment.value?.subject));
const commentRoute = computed(() => linkApplicationCommentRoute(props.application));
const commentContent = computed(() => htmlToPlainText(originComment.value?.raw || ""));
</script>

<template>
  <section
    v-if="origin.type === 'COMMENT'"
    class=":uno: border border-gray-200 rounded-lg bg-gray-50/70 p-3.5 space-y-3"
  >
    <h3 class=":uno: text-sm text-gray-900 font-medium">評論識別資訊</h3>

    <p v-if="isLoading" class=":uno: text-sm text-gray-500">正在載入評論...</p>
    <p v-else-if="errorState === 'forbidden'" class=":uno: text-sm text-gray-500">當前賬號沒有檢視來源評論的許可權</p>
    <p v-else-if="errorState === 'error'" class=":uno: text-sm text-gray-500">來源評論載入失敗，請稍後重試</p>
    <p v-else-if="!originComment" class=":uno: text-sm text-gray-500">原評論不可用（可能已被刪除）</p>

    <template v-else>
      <blockquote
        v-if="commentContent"
        class=":uno: max-h-60 overflow-auto whitespace-pre-wrap break-words border-l-2 border-gray-300 pl-3 text-sm text-gray-700 leading-6"
      >
        {{ commentContent }}
      </blockquote>

      <div class=":uno: flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <a
          v-if="subject?.url"
          :href="subject.url"
          target="_blank"
          rel="noopener noreferrer"
          class=":uno: inline-flex items-center gap-1 text-blue-600 hover:underline"
        >
          {{ subject.label }}
          <IconExternalLinkLine class=":uno: h-3 w-3 shrink-0" />
        </a>
        <span v-else>來源頁面不可用</span>
        <span v-if="originComment.creationTime">評論於 {{ utils.date.format(originComment.creationTime) }}</span>
        <RouterLink v-if="commentRoute" :to="commentRoute" class=":uno: text-blue-600 hover:underline">
          開啟評論管理
        </RouterLink>
      </div>
    </template>
  </section>
</template>
