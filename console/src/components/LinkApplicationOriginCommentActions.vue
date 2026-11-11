<script lang="ts" setup>
import {
  linkApplicationActionSummary,
  originCommentActionIntentEmpty,
  type LinkApplicationCommentActionsView,
  type OriginCommentActionIntent,
} from "@/utils/link-application-comment-actions";
import { VAlert, VButton } from "@halo-dev/components";
import { computed } from "vue";

const props = defineProps<{
  view: LinkApplicationCommentActionsView;
  canManageComments: boolean;
  processing?: boolean;
}>();

const approve = defineModel<boolean>("approve", { default: false });
const replyText = defineModel<string>("replyText", { default: "" });

const emit = defineEmits<{
  (event: "submit", intent: OriginCommentActionIntent): void;
}>();

const controlsDisabled = computed(() => !props.view.controlsEnabled || !props.canManageComments || props.processing);

const hasReply = computed(() => !!replyText.value.trim());

const intent = computed<OriginCommentActionIntent>(() => {
  // Mirror the orchestrator's execution gate so the summary never promises actions that will
  // not run (missing permission or an unavailable source degrades every action to a no-op).
  if (!props.view.controlsEnabled || !props.canManageComments) {
    return { approve: false, replyText: "" };
  }
  return {
    approve: props.view.approvalOffered && approve.value,
    replyText: replyText.value,
  };
});

const summary = computed(() =>
  linkApplicationActionSummary({
    includesLinkApproval: !props.view.standalone,
    intent: intent.value,
  }),
);

const submitDisabled = computed(() => controlsDisabled.value || originCommentActionIntentEmpty(intent.value));

function handleSubmit() {
  if (submitDisabled.value) {
    return;
  }
  emit("submit", intent.value);
}
</script>

<template>
  <section v-if="view.visible" class=":uno: border border-gray-200 rounded-lg p-3.5">
    <h3 class=":uno: mb-3.5 text-sm text-gray-900 font-medium">來源評論處理</h3>

    <p v-if="!canManageComments" class=":uno: mb-3.5 text-xs text-gray-500">
      當前賬號缺少友鏈管理（plugin:links:manage）或評論管理（system:comments:manage）許可權，無法透過或回覆來源評論。
    </p>

    <p v-else-if="!view.controlsEnabled" class=":uno: mb-3.5 text-xs text-gray-500">
      來源評論不可用（可能已被刪除或載入失敗），無法執行評論操作，但不影響連結稽核。
    </p>

    <div v-if="view.hiddenWarning" class=":uno: mb-3.5">
      <VAlert title="評論處於隱藏狀態" type="warning" :closable="false">
        <template #description>透過或回覆評論不會改變其隱藏狀態。</template>
      </VAlert>
    </div>

    <FormKit
      v-if="view.approvalOffered"
      v-model="approve"
      type="checkbox"
      name="approveOriginComment"
      label="同時透過來源評論"
      :help="hasReply ? '回覆後評論將自動透過' : undefined"
      :disabled="controlsDisabled || hasReply"
    />

    <FormKit
      v-if="view.replyOffered"
      v-model="replyText"
      type="textarea"
      name="originCommentReply"
      label="回覆來源評論（可選）"
      placeholder="回覆後評論將自動透過"
      auto-height
      :disabled="controlsDisabled"
    />

    <p v-if="view.controlsEnabled" class=":uno: text-xs text-gray-500">{{ summary }}</p>

    <div v-if="view.standalone">
      <VButton size="sm" type="secondary" :loading="processing" :disabled="submitDisabled" @click="handleSubmit">
        處理評論
      </VButton>
    </div>
  </section>
</template>
