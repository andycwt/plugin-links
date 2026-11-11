import { definePlugin, type CommentSubjectRefProvider, type CommentSubjectRefResult } from "@halo-dev/ui-shared";
import { markRaw } from "vue";
import Rss2FillIcon from "~icons/mingcute/rss-2-fill";
import RiLinksLine from "~icons/ri/links-line";

export default definePlugin({
  components: {},
  routes: [
    {
      parentName: "Root",
      route: {
        path: "/links",
        name: "Links",
        component: () => import("@/views/LinkList.vue"),
        meta: {
          permissions: ["plugin:links:view"],
          title: "連結",
          menu: {
            name: "連結",
            group: "content",
            icon: markRaw(RiLinksLine),
            priority: 50,
          },
        },
      },
    },
    {
      parentName: "Root",
      route: {
        path: "/links/rss",
        name: "LinkFeedItems",
        component: () => import("@/views/LinkFeedList.vue"),
        meta: {
          permissions: ["plugin:links:view"],
          title: "連結訂閱",
          hideFooter: true,
          menu: {
            name: "訂閱",
            group: "content",
            icon: markRaw(Rss2FillIcon),
            priority: 51,
          },
        },
      },
    },
  ],
  extensionPoints: {
    "comment:subject-ref:create": (): CommentSubjectRefProvider[] => {
      return [
        {
          kind: "Plugin",
          group: "plugin.halo.run",
          resolve: (): CommentSubjectRefResult => {
            return {
              label: "連結",
              title: "連結頁面",
              externalUrl: "/links",
              route: {
                name: "Links",
              },
            };
          },
        },
      ];
    },
  },
});
