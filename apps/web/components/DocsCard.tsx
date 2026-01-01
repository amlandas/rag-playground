
import React, { ReactNode } from "react";

type DocsCardProps = {
    title?: string;
    id?: string;
    badge?: string;
    children: ReactNode;
    className?: string;
};

export default function DocsCard({ title, id, badge, children, className = "" }: DocsCardProps) {
    return (
        <div id={id} className={`card bg-base-100 shadow-sm border border-base-200 mb-8 scroll-mt-24 ${className}`}>
            <div className="card-body p-6">
                {(title || badge) && (
                    <div className="flex items-center justifying-between gap-4 mb-4 border-b border-base-100 pb-2">
                        {title && <h2 className="card-title text-2xl font-bold">{title}</h2>}
                        {badge && <div className="badge badge-primary badge-outline">{badge}</div>}
                    </div>
                )}
                <div className="prose max-w-none text-base-content/80">
                    {children}
                </div>
            </div>
        </div>
    );
}
