import type { Link } from "@/api/generated";

export type LinkVerificationTone = "danger" | "muted" | "success" | "warning";
export type LinkVerificationStatusFilter = "access-error" | "all" | "backlink-missing";

export interface LinkVerificationStatusMeta {
  description: string;
  label: string;
  tone: LinkVerificationTone;
}

export function accessVerificationStatusMeta(link: Link): LinkVerificationStatusMeta {
  const access = link.status?.verification?.access;
  switch (access?.state) {
    case "CHECKING":
      return {
        tone: "warning",
        label: "訪問檢測中",
        description: "正在檢測連結訪問狀態",
      };
    case "ACCESSIBLE":
      return {
        tone: "success",
        label: "訪問正常",
        description: access.statusCode ? `訪問正常，HTTP ${access.statusCode}` : "訪問正常",
      };
    case "INACCESSIBLE":
      return {
        tone: "danger",
        label: "訪問異常",
        description: access.error || (access.statusCode ? `訪問異常，HTTP ${access.statusCode}` : "訪問異常"),
      };
    default:
      return {
        tone: "muted",
        label: "訪問未檢測",
        description: "尚未檢測連結訪問狀態",
      };
  }
}

export function backlinkVerificationStatusMeta(link: Link): LinkVerificationStatusMeta {
  const backlink = link.status?.verification?.backlink;
  switch (backlink?.state) {
    case "CHECKING":
      return {
        tone: "warning",
        label: "反鏈檢測中",
        description: "正在掃描反鏈頁面",
      };
    case "FOUND":
      return {
        tone: "success",
        label: "反鏈正常",
        description: backlink.matchedUrl ? `已發現反鏈：${backlink.matchedUrl}` : "已發現反鏈",
      };
    case "MISSING":
      return {
        tone: "danger",
        label: "未發現反鏈",
        description: backlink.scanUrl ? `未在 ${backlink.scanUrl} 發現反鏈` : "未發現反鏈",
      };
    case "FAILED":
      return {
        tone: "danger",
        label: "反鏈檢測失敗",
        description: backlink.error || "反鏈檢測失敗",
      };
    case "NOT_CONFIGURED":
      return {
        tone: "muted",
        label: "未配置反鏈",
        description: "未配置反鏈檢測頁面",
      };
    default:
      return {
        tone: "muted",
        label: link.spec?.verification?.backlinkScanUrl ? "反鏈未檢測" : "未配置反鏈",
        description: link.spec?.verification?.backlinkScanUrl ? "尚未檢測反鏈狀態" : "未配置反鏈檢測頁面",
      };
  }
}

export function isLinkVerificationChecking(link: Link) {
  const verification = link.status?.verification;
  return verification?.access?.state === "CHECKING" || verification?.backlink?.state === "CHECKING";
}

export function hasRunningLinkVerification(groups?: Array<{ links: Link[] }>) {
  return Boolean(groups?.some((group) => group.links.some(isLinkVerificationChecking)));
}

export function matchesLinkVerificationStatusFilter(link: Link, filter: LinkVerificationStatusFilter) {
  switch (filter) {
    case "access-error":
      return link.status?.verification?.access?.state === "INACCESSIBLE";
    case "backlink-missing":
      return hasNoBacklink(link);
    default:
      return true;
  }
}

function hasNoBacklink(link: Link) {
  const backlinkState = link.status?.verification?.backlink?.state;
  return (
    backlinkState === "MISSING" || backlinkState === "NOT_CONFIGURED" || (!backlinkState && !hasBacklinkScanUrl(link))
  );
}

function hasBacklinkScanUrl(link: Link) {
  return Boolean(link.spec?.verification?.backlinkScanUrl?.trim());
}
