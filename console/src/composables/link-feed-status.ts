import type { Link, RssFeedStatus } from "@/api/generated";

export type LinkFeedStatusState = "empty" | "failed" | "partial" | "success" | "waiting";
export type LinkFeedStatusTone = "danger" | "muted" | "success" | "warning";

export interface LinkFeedStatusMeta {
  state: LinkFeedStatusState;
  tone: LinkFeedStatusTone;
  label: string;
  description: string;
}

export function linkTitle(link: Link) {
  return link.spec?.displayName || link.metadata.name;
}

export function rssFeedUrls(link: Link) {
  return link.spec?.rss?.feedUrls?.filter((feedUrl) => !!feedUrl?.trim()) || [];
}

export function linkFeedStatusMeta(link: Link): LinkFeedStatusMeta {
  const state = classifyLinkFeedStatus(link);
  switch (state) {
    case "failed":
      return {
        state,
        tone: "danger",
        label: "獲取失敗",
        description: link.status?.rss?.lastError || "所有訂閱源獲取失敗",
      };
    case "partial":
      return {
        state,
        tone: "warning",
        label: "部分失敗",
        description: "部分訂閱源獲取失敗",
      };
    case "success":
      return {
        state,
        tone: "success",
        label: "狀態正常",
        description: "RSS 已成功獲取",
      };
    case "waiting":
      return {
        state,
        tone: "warning",
        label: "等待獲取",
        description: "RSS 已啟用，等待首次獲取",
      };
    default:
      return {
        state,
        tone: "muted",
        label: "暫無訂閱",
        description: "暫無可檢查的 RSS 訂閱",
      };
  }
}

export function aggregateLinkFeedStatusMeta(links: Link[]): LinkFeedStatusMeta {
  if (!links.length) {
    return {
      state: "empty",
      tone: "muted",
      label: "暫無訂閱",
      description: "暫無可檢查的 RSS 訂閱",
    };
  }

  const states = links.map(classifyLinkFeedStatus);
  const failedCount = states.filter((state) => state === "failed").length;
  const partialCount = states.filter((state) => state === "partial").length;
  const waitingCount = states.filter((state) => state === "waiting").length;
  const issueCount = failedCount + partialCount;

  if (issueCount) {
    return {
      state: failedCount === links.length ? "failed" : "partial",
      tone: failedCount === links.length ? "danger" : "warning",
      label: `${issueCount} 個異常`,
      description: `有 ${issueCount} 個訂閱存在獲取異常`,
    };
  }

  if (waitingCount) {
    return {
      state: "waiting",
      tone: "warning",
      label: `${waitingCount} 個待獲取`,
      description: `有 ${waitingCount} 個訂閱等待首次獲取`,
    };
  }

  return {
    state: "success",
    tone: "success",
    label: "全部正常",
    description: "所有訂閱最近均成功獲取",
  };
}

export function classifyLinkFeedStatus(link: Link): LinkFeedStatusState {
  if (!rssFeedUrls(link).length) {
    return "empty";
  }

  if (hasPartialRssFailure(link)) {
    return "partial";
  }

  if (hasRssFailure(link)) {
    return "failed";
  }

  if (link.status?.rss?.lastSuccessAt) {
    return "success";
  }

  return "waiting";
}

export function statusSortWeight(link: Link) {
  const state = classifyLinkFeedStatus(link);
  if (state === "failed") {
    return 0;
  }
  if (state === "partial") {
    return 1;
  }
  if (state === "waiting") {
    return 2;
  }
  return 3;
}

function hasPartialRssFailure(link: Link) {
  const feeds = link.status?.rss?.feeds || [];
  return feeds.some((feed) => isFeedFailed(feed)) && !feeds.every((feed) => isFeedFailed(feed));
}

function hasRssFailure(link: Link) {
  const feeds = link.status?.rss?.feeds || [];
  if (feeds.length) {
    return feeds.every(isFeedFailed);
  }
  return !!link.status?.rss?.lastError;
}

function isFeedFailed(feed: RssFeedStatus) {
  return !!feed.lastError;
}
