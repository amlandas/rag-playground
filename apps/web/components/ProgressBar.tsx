import React from "react";

type Props = {
    progress?: number; // 0-100. If undefined, shows indeterminate animation.
    label?: string;
    className?: string;
    color?: "primary" | "secondary" | "accent" | "info" | "success" | "warning" | "error";
};

export default function ProgressBar({ progress, label, className = "", color = "primary" }: Props) {
    const isIndeterminate = progress === undefined || progress === null;

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <div className="mb-1 flex justify-between text-xs font-medium text-base-content/70">
                    <span>{label}</span>
                    {!isIndeterminate && <span>{Math.round(progress)}%</span>}
                </div>
            )}
            <progress
                className={`progress progress-${color} w-full`}
                value={isIndeterminate ? undefined : progress}
                max="100"
            />
        </div>
    );
}
