"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Loader2, Send, ShieldAlert } from "lucide-react";
import { getPostById } from "@/server/actions/posts";
import { playSound } from "@/lib/sounds";
import { CommentItem } from "@/components/HomeFeed";
import MentionTextarea from "@/components/MentionTextarea";


interface CommentModalProps {
  postId: string;
  initialPost?: any;
  currentUserId: string;
  onClose: () => void;
}

export default function CommentModal({
  postId,
  initialPost,
  currentUserId,
  onClose,
}: CommentModalProps) {
  const [post, setPost] = useState<any>(initialPost ?? null);
  const [loadingPost, setLoadingPost] = useState(!initialPost);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Preserve scroll position and capture Escape key
  useEffect(() => {
    const originalScrollY = window.scrollY;

    // Prevent body scrolling
    const origBodyStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = origBodyStyle;
      window.scrollTo(0, originalScrollY);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Fetch post if not provided
  useEffect(() => {
    if (initialPost) {
      setPost(initialPost);
      setComments(initialPost.comments ?? []);
      setLoadingComments(false);
      return;
    }

    async function loadPost() {
      setLoadingPost(true);
      const res = await getPostById(postId);
      if (res.success && res.post) {
        setPost(res.post);
        setComments(res.post.comments ?? []);
      }
      setLoadingPost(false);
      setLoadingComments(false);
    }
    loadPost();
  }, [postId, initialPost]);

  // Fetch comments updates if post is loaded
  useEffect(() => {
    if (!post) return;
    async function loadComments() {
      const { getComments } = await import("@/server/actions/posts");
      const res = await getComments(postId, "relevant");
      if (res.success && (res as any).comments) {
        setComments((res as any).comments);
      }
      setLoadingComments(false);
    }
    loadComments();
  }, [postId, post]);

  // Scroll to and highlight specific comment if parameter present
  useEffect(() => {
    if (loadingComments || comments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get("highlightComment");
    if (highlightId) {
      setTimeout(() => {
        const element = document.getElementById(`comment-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-violet-500", "p-2", "bg-violet-500/10", "rounded-2xl", "transition-all", "duration-1000");
          setTimeout(() => {
             element.classList.remove("ring-2", "ring-violet-500", "bg-violet-500/10");
          }, 3000);
        }
      }, 400);
    }
  }, [loadingComments, comments]);


  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    const text = commentText;
    setCommentText("");
    setCommentError(null);
    setSubmittingComment(true);
    playSound("comment");

    const { addComment } = await import("@/server/actions/posts");
    const res = await addComment({ postId, content: text });
    if (res.success) {
      setComments((prev) => [
        {
          ...(res as any).comment,
          reactions: [],
          replies: [],
        },
        ...prev,
      ]);
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else if (!res.success) {
      // Restore the text so the user can edit it
      setCommentText(text);
      const errMsg = typeof res.error === "object" && res.error !== null
        ? (res.error as any).global
        : typeof res.error === "string" ? res.error : null;
      setCommentError(errMsg || "Failed to send comment.");
    }
    setSubmittingComment(false);
  };

  const getMediaUrls = () => {
    try {
      return JSON.parse(post?.mediaUrls || "[]");
    } catch {
      return [];
    }
  };

  if (loadingPost) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!post) return null;

  const mediaUrls = getMediaUrls();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Side: Post content & media */}
        <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-full">
          {/* Post Author Header */}
          <div className="p-4 border-b border-zinc-800/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 overflow-hidden">
              {post.user?.profile?.avatarUrl ? (
                <img src={post.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                  {post.user?.profile?.displayName?.[0] ?? "U"}
                </span>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-zinc-100">{post.user?.profile?.displayName ?? "User"}</p>
              <p className="text-xs text-zinc-500">@{post.user?.profile?.username ?? "username"}</p>
            </div>
          </div>

          {/* Media Grid or text body */}
          <div className="p-4 flex-1 flex flex-col justify-center">
            {post.content && (
              <p className="text-zinc-200 text-sm md:text-base leading-relaxed mb-4 whitespace-pre-wrap">
                {post.content}
              </p>
            )}
            {mediaUrls.length > 0 && (
              <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/50">
                {post.type === "VIDEO" ? (
                  <video src={mediaUrls[0]} className="w-full max-h-80 object-contain" controls />
                ) : (
                  <img src={mediaUrls[0]} alt="" className="w-full max-h-80 object-contain mx-auto" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Comments list & compose box */}
        <div className="w-full md:w-[420px] bg-zinc-900 flex flex-col h-full max-h-[45vh] md:max-h-full">
          <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300">Comments ({comments.length})</h3>
          </div>

          {/* Comment List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingComments ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 py-10">No comments yet. Start the conversation!</p>
            ) : (
              comments.map((comment: any) => (
                <div key={comment.id} id={`comment-${comment.id}`} className="mt-2 text-left transition-all duration-500">
                  <CommentItem
                    comment={comment}
                    currentUserId={currentUserId}
                    postAuthorId={post.userId}
                  />
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Interactive footer comment box */}
          <div className="p-4 border-t border-zinc-800/60 bg-zinc-900/50">
            {/* Moderation error display */}
            {commentError && (
              <div className="flex items-start gap-2 mb-2.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p className="flex-1 leading-snug">{commentError}</p>
                <button onClick={() => setCommentError(null)} className="text-red-500 hover:text-red-300">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={handleCommentSubmit} className="flex gap-2 items-end">
              <div className="flex-1">
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  placeholder="Write a comment... (use @ to mention)"
                  rows={1}
                  id="comment-modal-input"
                  dropdownPosition="top"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-2xl px-4 py-2 text-xs text-zinc-100 outline-none transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                className="gradient-btn px-4 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-40 flex-shrink-0"
              >
                {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
