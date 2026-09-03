import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../catalog/catalog.constants';

@Injectable()
export class CountryTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.countryTag.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(input: { name: string; slug?: string; description?: string }) {
    const name = input.name.trim();
    const slug = (input.slug?.trim() || slugify(name)).toLowerCase();
    const existing = await this.prisma.countryTag.findFirst({
      where: { OR: [{ slug }, { name: { equals: name } }] },
    });
    if (existing?.status === 'ACTIVE') return existing;
    if (existing)
      throw new ConflictException({
        code: 'COUNTRY_TAG_INACTIVE_CONFLICT',
        message: 'A matching inactive Country tag already exists',
        details: null,
      });
    return this.prisma.countryTag.create({
      data: { name, slug, description: input.description?.trim() || null },
    });
  }
}
