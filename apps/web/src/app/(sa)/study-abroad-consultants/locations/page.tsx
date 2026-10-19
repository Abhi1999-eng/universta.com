import { permanentRedirect } from 'next/navigation';

/**
 * The bare /study-abroad-consultants/locations, reached by trimming a
 * location page's address. There is no index of locations of its own: the
 * directory's "near you" city chips are that list, so the address goes
 * there, as the client's build sends its own bare consultants address to
 * the directory. It used to fall into the profile route and answer 404
 * "Consultant not found".
 */
export default function ConsultantLocations(): never {
  permanentRedirect('/study-abroad-consultants#cities');
}
