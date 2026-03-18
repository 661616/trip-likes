/**
 * PostManagement - 帖子管理页面
 *
 * 功能：展示帖子列表，支持新增/编辑/删除帖子
 * 数据流：useQuery → GET /api/v1/posts → 表格渲染
 * 交互：点击新增→弹窗填表→POST→刷新列表；操作列→编辑/删除/跳转生成
 */

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { postApi, type Post, type PostCreate } from "@/lib/api";
import { Plus, Pencil, Trash2, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "tech", label: "科技" },
  { value: "entertainment", label: "娱乐" },
  { value: "sports", label: "体育" },
  { value: "lifestyle", label: "生活" },
  { value: "news", label: "时事" },
];

const CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

export default function PostManagementPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: postApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: postApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  function handleEdit(post: Post) {
    setEditingPost(post);
    setModalOpen(true);
  }

  function handleCreate() {
    setEditingPost(null);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">帖子管理</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增帖子
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">加载中...</div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          暂无帖子，点击上方按钮新增
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">标题</th>
                <th className="px-4 py-3 text-left font-medium w-20">分类</th>
                <th className="px-4 py-3 text-left font-medium w-40">创建时间</th>
                <th className="px-4 py-3 text-right font-medium w-40">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-t border-border hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{post.title}</span>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {post.content}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {CATEGORY_MAP[post.category] ?? post.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          router.push(`/generate?postId=${post.id}`)
                        }
                        className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        title="生成评论"
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(post)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("确定删除此帖子？")) {
                            deleteMutation.mutate(post.id);
                          }
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <PostFormModal
          post={editingPost}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Post Form Modal ─────────────────────────────────────────────────

function PostFormModal({
  post,
  onClose,
}: {
  post: Post | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [category, setCategory] = useState(post?.category ?? "tech");

  const createMutation = useMutation({
    mutationFn: (data: PostCreate) => postApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PostCreate>) => postApi.update(post!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { title, content, category };
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-bold">
          {isEdit ? "编辑帖子" : "新增帖子"}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="输入帖子标题"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="粘贴或输入帖子内容"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors",
                isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90",
              )}
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
