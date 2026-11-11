import type { ApprovalRequest, ApproveRequest, LinkApplication, LinkApplicationCleanupResult } from "@/api/generated";
import axios from "axios";

export interface LinkApplicationHistoryFilterInput {
  /** Empty string means no status filter. */
  status?: string;
  /** Empty string means no origin filter. */
  originType?: string;
}

export interface LinkApplicationQuery {
  page: number;
  size: number;
  status?: string;
  originType?: string;
}

function normalizeFilterValue(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function buildLinkApplicationQuery(
  filter: LinkApplicationHistoryFilterInput,
  pagination: { page: number; size: number },
): LinkApplicationQuery {
  return {
    page: pagination.page,
    size: pagination.size,
    status: normalizeFilterValue(filter.status),
    originType: normalizeFilterValue(filter.originType),
  };
}

export function buildLinkApplicationCleanupParams(filter: LinkApplicationHistoryFilterInput) {
  return {
    status: normalizeFilterValue(filter.status),
    originType: normalizeFilterValue(filter.originType),
  };
}

export interface LinkApplicationStatusMeta {
  label: string;
  tagType: "default" | "primary" | "success" | "warning" | "danger";
}

export function linkApplicationStatusMeta(status: string | undefined): LinkApplicationStatusMeta {
  switch (status) {
    case "PENDING":
      return { label: "待稽核", tagType: "warning" };
    case "APPROVING":
      return { label: "審批中", tagType: "primary" };
    case "APPROVED":
      return { label: "已透過", tagType: "success" };
    case "REJECTED":
      return { label: "已拒絕", tagType: "danger" };
    default:
      return { label: status || "未知", tagType: "default" };
  }
}

export type LinkApplicationReviewMode = "editable" | "resume" | "readonly";

export interface LinkApplicationApprovalFormData extends Omit<ApproveRequest, "feedUrls"> {
  feedUrlsText?: string;
}

export function linkApplicationReviewMode(application: LinkApplication): LinkApplicationReviewMode {
  switch (application.spec.status) {
    case "PENDING":
      return "editable";
    case "APPROVING":
      return "resume";
    default:
      return "readonly";
  }
}

export function buildLinkApplicationApprovalRequest(data: LinkApplicationApprovalFormData): ApproveRequest {
  return {
    url: data.url?.trim(),
    displayName: data.displayName?.trim(),
    logo: data.logo ?? "",
    description: data.description ?? "",
    groupName: data.groupName || undefined,
    backlink: data.backlink?.trim() || "",
    feedUrls: [
      ...new Set(
        (data.feedUrlsText || "")
          .split(/\r?\n/)
          .map((feedUrl) => feedUrl.trim())
          .filter(Boolean),
      ),
    ],
  };
}

export function linkApplicationEffectiveFields(application: LinkApplication): ApprovalRequest {
  const frozenRequest = application.spec.approval?.request;
  if (frozenRequest) {
    return frozenRequest;
  }
  return {
    url: application.spec.url,
    displayName: application.spec.displayName,
    logo: application.spec.logo,
    description: application.spec.description,
    backlink: application.spec.backlink,
    feedUrls: application.spec.feedUrls,
  };
}

export function linkApplicationRejectDescription(application: LinkApplication): string {
  const displayName = application.spec.displayName;
  if (application.spec.origin.type === "COMMENT") {
    return `拒絕 "${displayName}" 的申請後，該連結不會再被評論識別建立申請，但訪客仍可透過表單再次提交。`;
  }
  return `拒絕 "${displayName}" 的申請後，在拒絕記錄存在期間，該連結無法再次提交申請，也不會再被評論識別建立。刪除拒絕記錄可解除限制。`;
}

export function linkApplicationCleanupDescription(options: {
  total: number;
  status?: string;
  originType?: string;
}): string {
  const parts = [`將刪除當前篩選條件下的全部 ${options.total} 條申請記錄（審批中的申請會保留），此操作不可恢復。`];
  const mayIncludeResubmissionBlocking =
    (!options.status || options.status === "PENDING" || options.status === "REJECTED") &&
    (!options.originType || options.originType === "FORM");
  if (mayIncludeResubmissionBlocking) {
    parts.push("其中待稽核或已拒絕的表單申請被刪除後，對應連結可能可以再次提交申請。");
  }
  const mayIncludeApproved = !options.status || options.status === "APPROVED";
  if (mayIncludeApproved) {
    parts.push("刪除已透過的申請不會刪除已建立的連結。");
  }
  return parts.join("");
}

export function linkApplicationCleanupSummary(result: LinkApplicationCleanupResult): string {
  const segments = [`共匹配 ${result.matched ?? 0} 條申請`, `已刪除 ${result.deleted ?? 0} 條`];
  if ((result.skipped ?? 0) > 0) {
    segments.push(`跳過 ${result.skipped} 條審批中的申請`);
  }
  if ((result.failed ?? 0) > 0) {
    segments.push(`${result.failed} 條刪除失敗`);
  }
  return `${segments.join("，")}。`;
}

export type LinkApplicationOriginCommentErrorState = "unavailable" | "forbidden" | "error";

export function linkApplicationOriginCommentErrorState(error: unknown): LinkApplicationOriginCommentErrorState {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 404) {
    return "unavailable";
  }
  if (status === 401 || status === 403) {
    return "forbidden";
  }
  return "error";
}
