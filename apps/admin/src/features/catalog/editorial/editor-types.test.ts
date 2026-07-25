import { describe, expect, it } from 'vitest';
import { bodyForApi, blankSection, draftFromSection } from './editor-types';

describe('typed editorial editor models', () => {
  it('serializes typed repeated rows without line-delimited parsing', () => {
    const body = bodyForApi({ ...blankSection, sectionType: 'STEPS', body: { items: [{ step: '01', label: 'Choose a course', value: '', description: 'Review the published requirements.' }] } });
    expect(body).toEqual({ items: [{ step: '01', title: 'Choose a course', description: 'Review the published requirements.' }] });
  });

  it('hydrates existing section JSON into editable typed rows', () => {
    const draft = draftFromSection({ id: 'section-1', sectionKey: 'documents', sectionType: 'FACT_GRID', eyebrow: null, heading: 'Documents', subheading: null, bodyJson: { items: [{ label: 'Passport', value: 'Required' }] }, primaryMedia: null, secondaryMedia: null, ctaLabel: null, ctaUrl: null, configurationJson: null, displayOrder: 1, status: 'ACTIVE', createdAt: '', updatedAt: '' });
    expect(draft.body.items).toEqual([{ label: 'Passport', value: 'Required', description: '', step: '' }]);
  });
});
