'use client';

import { createContext, useContext, type ReactNode, type Ref } from 'react';

const LockedContext = createContext(false);

/** Whether the editor's fields around this one are locked; a rich-text box
 * is not a form control, so a disabled fieldset does not reach it alone. */
export function useEditorFieldsLocked() {
  return useContext(LockedContext);
}

/** An editor's fields, as one block that a save can lock.
 *
 * A save sends what the fields held when it started, so a change made while
 * it runs is not in it. And a save that leaves the page -- a new record
 * opening in its own editor, a publish going back to the list -- leaves
 * behind this editor and anything changed in it since: `/subjects/new` and
 * `/subjects/[id]` are separate routes, so the record's editor is a fresh one
 * that reads it back from the API. An untick made in the moment between
 * "Edit subject" showing and that editor arriving was silently undone. While
 * `locked`, nothing here can be changed.
 *
 * `ref` is the block itself, for EditorSectionNav: its sections are this
 * block's children, not the form's. */
export function EditorFields({ locked, ref, children }: { locked: boolean; ref?: Ref<HTMLFieldSetElement>; children: ReactNode }) {
  return (
    <LockedContext.Provider value={locked}>
      <fieldset ref={ref} disabled={locked} className="min-w-0 space-y-6">
        {children}
      </fieldset>
    </LockedContext.Provider>
  );
}
