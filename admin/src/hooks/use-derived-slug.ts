import { useState } from 'react';
import { slugify } from '@/lib/slugify';

/**
 * Manages a slug/key that auto-derives from a name until the user hand-edits it.
 * Shared by the Products (slug) and Workflows (key) editors.
 */
export function useDerivedSlug() {
    const [edited, setEdited] = useState(false);
    const [editing, setEditing] = useState(false);

    return {
        editing,
        setEditing,
        /** Call when opening an editor: existing records keep their slug (locked = has an id). */
        reset(locked: boolean) {
            setEdited(locked);
            setEditing(false);
        },
        /** The next slug for a given name — derived unless it was hand-edited. */
        derive(name: string, current: string) {
            return edited ? current : slugify(name);
        },
        /** Call when the user types in the slug field. */
        markEdited() {
            setEdited(true);
        },
    };
}
