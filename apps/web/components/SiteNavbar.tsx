import React from "react";
import Link from "next/link";
import ThemeSwitcher from "./ThemeSwitcher";

const navLinks = [
  { href: "/playground", label: "Playground" },
  { href: "/#about", label: "About" },
  { href: "/#docs", label: "Docs" },
];

export default function SiteNavbar() {
  return (
    <header className="sticky top-0 z-40 bg-base-100 shadow-sm backdrop-blur">
      <div className="navbar mx-auto max-w-6xl px-4">
        <div className="navbar-start">
          <Link href="/" className="flex items-center gap-2 font-semibold text-base-content">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="text-lg font-bold">R</span>
            </span>
            <span className="text-lg">RAG Playground</span>
          </Link>
        </div>
        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="rounded-btn">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="navbar-end gap-2">
          <div className="md:hidden">
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost btn-square">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
                <span className="sr-only">Open navigation</span>
              </label>
              <ul className="menu menu-sm dropdown-content z-[1] mt-3 w-48 rounded-box bg-base-100 p-2 shadow">
                {navLinks.map((link) => (
                  <li key={`mobile-${link.href}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
