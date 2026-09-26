import { BULK_RESOURCES, bulkFields } from './bulk-resources';

/**
 * What a downloaded template tells an operator is required.
 *
 * The star beside a column heading is the only instruction most people get
 * before filling a spreadsheet in, so it has to agree with what the importer
 * actually refuses. A country's continent was starred long after the importer
 * stopped demanding one -- and because this resource lists its fields, the
 * star comes from the field's own flag rather than from `requiredColumns`,
 * which is where the first attempt at fixing it went.
 */

describe('required columns in a template', () => {
  it('does not ask a country for a continent it will import without', () => {
    const starred = bulkFields(BULK_RESOURCES.countries)
      .filter((field) => field.required)
      .map((field) => field.label);

    expect(starred).toEqual(['title']);
  });

  it('marks nothing required that the resource does not list as a column', () => {
    for (const definition of Object.values(BULK_RESOURCES)) {
      const columns = new Set(bulkFields(definition).map((field) => field.key));
      const missing = definition.requiredColumns.filter(
        (key) => !columns.has(key),
      );
      expect({ resource: definition.key, missing }).toEqual({
        resource: definition.key,
        missing: [],
      });
    }
  });
});
