"use client";

import React, { useId, useState } from "react";
import type { RunHistoryItem } from "../lib/types";

type Props = {
    history: RunHistoryItem[];
    onSelect: (item: RunHistoryItem) => void;
    loading?: boolean;
};

export default function HistoryDrawer({ history, onSelect, loading }: Props) {
    const [open, setOpen] = useState(false);
    const drawerId = useId();

    const timeAgo = (ts: number) => {
        // ts is seconds from Python time.time()
        // but JS Date.now() is ms.
        const nowSec = Math.floor(Date.now() / 1000);
        const diff = nowSec - ts;

        if (diff < 60) return "just now";
        const mins = Math.floor(diff / 60);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        return `${hours}h ago`;
    };

    return (
        <div className={`drawer ${open ? "drawer-open" : ""}`}>
            <input
                id={drawerId}
                type="checkbox"
                className="drawer-toggle"
                checked={open}
                onChange={() => setOpen(!open)}
            />
            <div className="drawer-content">
                <button
                    className="btn btn-ghost btn-sm gap-2"
                    onClick={() => setOpen(true)}
                    title="View session history"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    History
                </button>
            </div>
            <div className="drawer-side z-40">
                <label
                    htmlFor={drawerId}
                    aria-label="Close history drawer"
                    className="drawer-overlay"
                    onClick={() => setOpen(false)}
                />
                <div className="menu w-80 min-h-full bg-base-100 p-4 text-base-content border-r border-base-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">Session History</h3>
                        <button className="btn btn-ghost btn-xs" onClick={() => setOpen(false)}>
                            Close
                        </button>
                    </div>

                    {loading && history.length === 0 ? (
                        <div className="flex justify-center p-4"><span className="loading loading-spinner loading-sm"></span></div>
                    ) : history.length === 0 ? (
                        <div className="text-sm opacity-60 p-2">No runs in this session yet.</div>
                    ) : (
                        <ul className="space-y-2">
                            {history.map((item) => (
                                <li key={item.run_id}>
                                    <button
                                        onClick={() => {
                                            onSelect(item);
                                            setOpen(false);
                                        }}
                                        className="text-left flex flex-col items-start gap-1 p-3 h-auto border border-base-200 rounded-lg hover:bg-base-200 transition-colors w-full"
                                    >
                                        <div className="font-semibold text-xs line-clamp-2 w-full">
                                            {item.query}
                                        </div>
                                        <div className="flex items-center justify-between w-full text-[10px] opacity-70">
                                            <div className="flex gap-2">
                                                <span className="uppercase">{item.mode}</span>
                                                <span>·</span>
                                                <span>{timeAgo(item.timestamp)}</span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
