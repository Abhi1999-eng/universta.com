/**
 * One-time, idempotent initialization of CountrySubject from the pre-existing
 * published catalogue. It is deliberately a script, never a runtime repair:
 * once editors own CountrySubject, removals must remain removed.
 */
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value)
    throw new Error('DATABASE_URL is required for CountrySubject backfill');
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseConfig()),
  });
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO country_subjects (id, country_id, subject_id, display_order, created_at)
    SELECT UUID(), source.country_id, source.subject_id, 0, NOW(3)
    FROM (
      SELECT DISTINCT u.country_id, c.subject_id
      FROM universities u
      JOIN university_course_offerings o ON o.university_id = u.id
      JOIN courses c ON c.id = o.course_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE u.deleted_at IS NULL AND u.status = 'PUBLISHED'
        AND o.deleted_at IS NULL AND o.status = 'PUBLISHED'
        AND c.deleted_at IS NULL AND c.status = 'PUBLISHED'
        AND s.deleted_at IS NULL AND s.status = 'PUBLISHED'
      UNION
      SELECT DISTINCT cc.country_id, c.subject_id
      FROM country_courses cc
      JOIN courses c ON c.id = cc.course_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE cc.deleted_at IS NULL AND cc.status = 'ACTIVE'
        AND c.deleted_at IS NULL AND c.status = 'PUBLISHED'
        AND s.deleted_at IS NULL AND s.status = 'PUBLISHED'
    ) source
    JOIN countries country_row ON country_row.id = source.country_id
    WHERE country_row.deleted_at IS NULL
  `);
  await prisma.$disconnect();
}

void main();
