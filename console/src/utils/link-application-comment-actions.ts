import axios from "axios";

export type LinkApplicationOriginCommentState = "loading" | "ready" | "deleted" | "error";

export interface LinkApplicationCommentActionsViewInput {
  originType: string;
  /** Use the effective status; pass APPROVED when link approval just completed locally. */
  applicationStatus?: string;
  commentState: LinkApplicationOriginCommentState;
  approved?: boolean;
  hidden?: boolean;
}

export interface LinkApplicationCommentActionsView {
  /** Whether the source-Comment handling section is shown at all. */
  visible: boolean;
  /** Whether Comment handling runs as a separate action instead of following link approval. */
  standalone: boolean;
  /** Whether the source Comment currently exists and can be mutated. */
  controlsEnabled: boolean;
  /** Whether an approval option is offered (source exists and is not approved yet). */
  approvalOffered: boolean;
  approvalDefaultSelected: boolean;
  replyOffered: boolean;
  hiddenWarning: boolean;
}

const hiddenCommentActionsView: LinkApplicationCommentActionsView = {
  visible: false,
  standalone: false,
  controlsEnabled: false,
  approvalOffered: false,
  approvalDefaultSelected: false,
  replyOffered: false,
  hiddenWarning: false,
};

export function linkApplicationCommentActionsView(
  input: LinkApplicationCommentActionsViewInput,
): LinkApplicationCommentActionsView {
  if (input.originType !== "COMMENT" || input.applicationStatus === "REJECTED") {
    return hiddenCommentActionsView;
  }
  const ready = input.commentState === "ready";
  return {
    visible: true,
    standalone: input.applicationStatus === "APPROVED",
    controlsEnabled: ready,
    approvalOffered: ready && !input.approved,
    approvalDefaultSelected: ready && !input.approved,
    replyOffered: ready,
    hiddenWarning: ready && !!input.hidden,
  };
}

export interface OriginCommentActionIntent {
  approve: boolean;
  replyText: string;
}

export interface NormalizedOriginCommentActionIntent {
  approve: boolean;
  reply: string;
}

/**
 * Trims the reply and drops the approval selection when a reply is present, because Halo's
 * reply flow already approves the parent Comment.
 */
export function normalizeOriginCommentActionIntent(
  intent: OriginCommentActionIntent,
): NormalizedOriginCommentActionIntent {
  const reply = intent.replyText.trim();
  return { approve: intent.approve && !reply, reply };
}

export function originCommentActionIntentEmpty(intent: OriginCommentActionIntent): boolean {
  const normalized = normalizeOriginCommentActionIntent(intent);
  return !normalized.approve && !normalized.reply;
}

export function linkApplicationActionSummary(options: {
  includesLinkApproval: boolean;
  intent: OriginCommentActionIntent;
}): string {
  const { approve, reply } = normalizeOriginCommentActionIntent(options.intent);
  const commentPart = reply ? "回覆來源評論（評論將隨之透過）" : approve ? "透過來源評論" : "";
  if (options.includesLinkApproval) {
    return commentPart ? `透過申請，並${commentPart}` : "僅透過申請，不處理來源評論";
  }
  return commentPart ? `將${commentPart}` : "未選擇評論操作";
}

export type OriginCommentActionOutcome =
  | { type: "completed"; approvedComment: boolean; replied: boolean }
  | { type: "failed"; action: "approve" | "reply"; status?: number }
  | { type: "indeterminate"; action: "approve" | "reply"; commentApproved?: boolean; recentReplyCount?: number };

export function originCommentOutcomeRequiresReplyConfirmation(outcome: OriginCommentActionOutcome): boolean {
  return outcome.type === "indeterminate" && outcome.action === "reply";
}

/**
 * A Comment request is indeterminate when the response is lost (timeout or network
 * interruption) or the server fails with 5xx after the write may have been persisted.
 * Only client-facing 4xx responses (validation, authorization, conflict, not found) are
 * determinate failures.
 */
export function isIndeterminateCommentRequestError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return status === undefined || status >= 500;
}

export function originCommentActionSuccessMessage(
  outcome: Extract<OriginCommentActionOutcome, { type: "completed" }>,
  includesLinkApproval: boolean,
): string {
  const commentPart = outcome.replied ? "回覆來源評論" : outcome.approvedComment ? "透過來源評論" : "";
  if (includesLinkApproval) {
    return commentPart ? `已透過申請，並${commentPart}` : "已透過申請";
  }
  return commentPart ? `已${commentPart}` : "已完成";
}

export interface OriginCommentActionFailureAlert {
  title: string;
  description: string;
}

export function originCommentActionFailureAlert(options: {
  outcome: Exclude<OriginCommentActionOutcome, { type: "completed" }>;
  includesLinkApproval: boolean;
}): OriginCommentActionFailureAlert {
  const linkPart = options.includesLinkApproval ? "連結已透過，但" : "";
  if (options.outcome.type === "failed") {
    const actionLabel = options.outcome.action === "approve" ? "透過來源評論" : "回覆來源評論";
    return {
      title: `${linkPart}${actionLabel}失敗`,
      description: options.includesLinkApproval
        ? "連結已透過且不受影響。可在下方重試仍然適用的評論操作。"
        : "可重試仍然適用的評論操作。",
    };
  }
  const stateParts: string[] = [];
  if (options.outcome.commentApproved !== undefined) {
    stateParts.push(`來源評論當前${options.outcome.commentApproved ? "已透過" : "未透過"}`);
  }
  if (options.outcome.recentReplyCount !== undefined) {
    stateParts.push(`最近共有 ${options.outcome.recentReplyCount} 條回覆`);
  }
  const stateText = stateParts.length ? `已重新整理當前狀態：${stateParts.join("，")}。` : "當前狀態重新整理失敗。";
  if (options.outcome.action === "approve") {
    return {
      title: `${linkPart}評論審批結果未知`,
      description: `網路或服務異常導致無法確認評論審批是否生效，系統不會自動重試；重新提交審批是安全的，已生效時會自動跳過。${stateText}請核對評論狀態後，再決定是否重新提交。`,
    };
  }
  return {
    title: `${linkPart}回覆結果未知`,
    description: `網路異常導致無法確認回覆是否提交成功，系統不會自動重試。${stateText}請核對評論與回覆狀態後，再決定是否重新提交。`,
  };
}
