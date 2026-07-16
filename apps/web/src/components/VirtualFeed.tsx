"use client";

import React, { useState, useEffect, useRef } from "react";

interface VirtualizedItemProps {
  children: React.ReactNode;
  estimatedHeight?: number;
}

export function VirtualizedItem({ children, estimatedHeight = 450 }: VirtualizedItemProps) {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef<number>(estimatedHeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && el.offsetHeight > 0) {
          heightRef.current = el.offsetHeight;
        }
      },
      {
        rootMargin: "800px 0px 800px 0px", // Pre-render threshold buffer above and below viewport
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: isVisible ? undefined : `${heightRef.current}px`,
      }}
      className="w-full"
    >
      {isVisible ? (
        children
      ) : (
        <div
          style={{ height: `${heightRef.current}px` }}
          className="w-full bg-zinc-900/10 border border-white/[0.01] rounded-2xl mb-3"
        />
      )}
    </div>
  );
}

interface VirtualFeedProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedHeight?: number;
}

export default function VirtualFeed<T>({ items, renderItem, estimatedHeight = 450 }: VirtualFeedProps<T>) {
  return (
    <div className="flex flex-col w-full">
      {items.map((item, index) => (
        <VirtualizedItem key={(item as any).id ?? index} estimatedHeight={estimatedHeight}>
          {renderItem(item, index)}
        </VirtualizedItem>
      ))}
    </div>
  );
}
