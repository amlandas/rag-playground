
# Implementation Guide: Scientia Laboratory Documentation

## Overview
This directory contains the source code and documentation for the new `/docs` route in the Scientia Laboratory application. The documentation is built with Next.js and styled using DaisyUI to ensure consistency with the main application.

## Directory Structure
- `apps/web/app/docs/page.tsx`: The main page component containing the documentation content.
- `apps/web/components/DocsCard.tsx`: A reusable wrapper component for documentation sections.
- `apps/web/components/DocsSidebar.tsx`: The sticky sidebar navigation component.

## Integration Steps
1. **Route Creation**: The `page.tsx` file automatically creates the `/docs` route.
2. **Navigation**: Ensure `apps/web/components/SiteNavbar.tsx` includes a link to `/docs`. (Confirmed: Existing link present).
3. **Styling**: Uses `tailwind.config.js` and `daisyui` classes. No extra CSS files required unless customization beyond utility classes is needed.

## Maintenance
To update the documentation:
1. Edit `apps/web/app/docs/page.tsx`.
2. Locate the relevant `DocsCard` section.
3. Update the content within the JSX.
4. If adding new sections, update `navItems` in `apps/web/components/DocsSidebar.tsx` to match the new IDs.
