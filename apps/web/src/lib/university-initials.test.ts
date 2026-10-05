import { describe, expect, it } from 'vitest';
import { universityInitials } from './university-initials';

/**
 * Oxford, Cambridge, Edinburgh and Manchester all came out "UO", so a row
 * of four cards carried four identical marks.
 */
describe('a university’s monogram', () => {
  it('tells apart the universities that all open “University of”', () => {
    const marks = [
      'University of Oxford',
      'University of Cambridge',
      'University of Edinburgh',
      'University of Manchester',
    ].map(universityInitials);
    expect(marks).toEqual(['OXF', 'CAM', 'EDI', 'MAN']);
    expect(new Set(marks).size).toBe(4);
  });

  it('tells apart neighbours in an A-Z list that open with the same letters', () => {
    expect(universityInitials('Aalborg University')).toBe('ALB');
    expect(universityInitials('Aalto University')).toBe('ALT');
    expect(universityInitials('Aarhus University')).toBe('ARH');
  });

  it('takes a letter from each telling word, up to three', () => {
    expect(universityInitials('London School of Economics and Political Science')).toBe('LSE');
    expect(universityInitials('Indian Institute of Technology Delhi')).toBe('ITD');
    expect(universityInitials('Imperial College London')).toBe('IL');
    expect(universityInitials("King's College London")).toBe('KL');
  });

  it('passes over the common word in other languages too', () => {
    expect(universityInitials('Universität Hamburg')).toBe('HAM');
    expect(universityInitials('Universidad Complutense de Madrid')).toBe('CM');
  });

  it('still gives a name made only of common words a mark', () => {
    expect(universityInitials('University College')).toBe('UC');
    expect(universityInitials('The University')).toBe('TU');
  });
});
