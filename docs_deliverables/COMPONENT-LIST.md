
# Component List: Documentation System

## 1. DocsPage (`apps/web/app/docs/page.tsx`)
- **Type**: Page Component (Server Component)
- **Purpose**: Main container for the documentation route. Handles SEO metadata and layout.
- **Props**: None.
- **Dependencies**: `DocsSidebar`, `DocsCard`.

## 2. DocsCard (`apps/web/components/DocsCard.tsx`)
- **Type**: Functional Component
- **Purpose**: Uniform container for documentation sections with title styling and ID linking.
- **Props**:
    - `title` (string?): Section header.
    - `badge` (string?): Optional badge (e.g., "5 min read").
    - `id` (string?): HTML ID for anchor linking.
    - `children` (ReactNode): Content payload.
    - `className` (string?): Custom styles.

## 3. DocsSidebar (`apps/web/components/DocsSidebar.tsx`)
- **Type**: Functional Component
- **Purpose**: Sticky table of contents for navigation.
- **Props**: None.
- **Configuration**: `navItems` array defines the links.
