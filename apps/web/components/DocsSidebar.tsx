
import React from "react";
import Link from "next/link";

type NavItem = {
    label: string;
    href: string;
};

const navItems: NavItem[] = [
    { label: "Quick Start", href: "#quick-start" },
    { label: "RAG Modes", href: "#rag-modes" },
    { label: "Document Management", href: "#documents" },
    { label: "Query Settings", href: "#query-config" },
    { label: "Evaluation", href: "#evaluation" },
    { label: "System Status", href: "#monitoring" },
    { label: "Workflows", href: "#workflows" },
    { label: "Troubleshooting", href: "#troubleshooting" },
];

export default function DocsSidebar() {
    return (
        <nav className="hidden lg:block sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto w-64 pr-4">
            <ul className="menu bg-base-100 w-full rounded-box p-2 text-sm font-medium border border-base-200/50">
                <li className="menu-title text-primary uppercase text-xs tracking-wider mb-2">Contents</li>
                {navItems.map((item) => (
                    <li key={item.href}>
                        <Link href={item.href} className="hover:bg-primary/10 hover:text-primary">
                            {item.label}
                        </Link>
                    </li>
                ))}
                <div className="divider my-2"></div>
                <li className="menu-title text-base-content/50 uppercase text-xs tracking-wider mb-2">External</li>
                <li>
                    <a href="https://github.com/amlandas/rag-playground" target="_blank" rel="noopener noreferrer">
                        GitHub Repo ↗
                    </a>
                </li>
            </ul>
        </nav>
    );
}
