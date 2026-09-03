import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeAudit } from '../../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import {
  PROFILE_AUDIT_ACTIONS,
  STATISTICS_SOURCE_MODES,
} from './profile.constants';
import {
  CostProfileDto,
  CountryIntakeItemDto,
  LanguageProfileDto,
  ReplaceIntakesDto,
  StatisticsProfileDto,
  WorkProfileDto,
} from './profile.dto';
import {
  publicProfileDetail,
  publicProfileSummary,
  serializeCost,
  serializeIntake,
  serializeLanguage,
  serializeStatistics,
  serializeWork,
  type ProfileBundle,
} from './profile.mappers';

export const PROFILE_INCLUDE = {
  costProfile: true,
  workProfile: true,
  languageRequirements: true,
  intakes: {
    include: { intake: true },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  },
  statistics: true,
} satisfies Prisma.CountryInclude;

function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ConflictException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'COUNTRY_NOT_FOUND',
    message: 'Country not found',
    details: null,
  });
}

function bad(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message, details: null });
}

function stale(code: string): ConflictException {
  return new ConflictException({
    code,
    message: 'The profile changed in another session. Reload before saving',
    details: null,
  });
}

function decimal(
  value: string | null | undefined,
  scale: number,
  field: string,
  maxIntegerDigits: number,
): Prisma.Decimal | undefined {
  // null is what the serializer reports for an unset column, so a round-tripped
  // payload carries it back; it means "not provided", the same as '' does.
  if (value === undefined || value === null || value === '') return undefined;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))
    throw bad(
      'PROFILE_DECIMAL_INVALID',
      `${field} must be a non-negative decimal string`,
    );
  const [integerPart, fractional = ''] = value.split('.');
  if (fractional.length > scale || integerPart.length > maxIntegerDigits)
    throw bad(
      'PROFILE_DECIMAL_PRECISION',
      `${field} exceeds its supported precision`,
    );
  return new Prisma.Decimal(value).toDecimalPlaces(scale);
}

function optionalText(value: string | null | undefined): string | undefined {
  return value === undefined || value === null ? undefined : value.trim();
}

function url(value: string | null | undefined): string | undefined {
  if (value === null) return undefined;
  if (value === undefined || value === '') return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('protocol');
  } catch {
    throw bad(
      'PROFILE_SOURCE_INVALID',
      'sourceReference must be an HTTP or HTTPS URL',
    );
  }
  return value;
}

function verifiedAt(value: string | null | undefined): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now())
    throw bad(
      'PROFILE_VERIFICATION_INVALID',
      'verifiedAt must be a valid non-future timestamp',
    );
  return parsed;
}

function range(
  min: Prisma.Decimal | undefined,
  max: Prisma.Decimal | undefined,
  field: string,
): void {
  if (min && max && min.greaterThan(max))
    throw bad(
      'PROFILE_RANGE_INVALID',
      `${field} minimum cannot exceed maximum`,
    );
}

function version(
  current: Date | null | undefined,
  expected: string | undefined,
  code: string,
): void {
  if (!current && expected) throw stale(code);
  if (
    current &&
    (!expected || current.getTime() !== new Date(expected).getTime())
  )
    throw stale(code);
}

function safeProfileFields(
  dto: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(dto)
      .filter(
        ([key, value]) =>
          value !== undefined &&
          ![
            'expectedUpdatedAt',
            'sourceReference',
            'disclaimer',
            'visaInformation',
            'generalNotes',
            'notes',
            'verifiedAt',
          ].includes(key),
      )
      .map(([key, value]) => [
        key,
        value instanceof Prisma.Decimal
          ? value.toString()
          : (value as string | number | boolean | null),
      ]),
  );
}

@Injectable()
export class CountryProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async publicBundle(countryId: string): Promise<ProfileBundle> {
    const record = await this.prisma.country.findFirst({
      where: {
        id: countryId,
        status: 'PUBLISHED',
        deletedAt: null,
        continent: { status: 'ACTIVE', deletedAt: null },
      },
      include: PROFILE_INCLUDE,
    });
    return record
      ? record
      : {
          costProfile: null,
          workProfile: null,
          languageRequirements: null,
          intakes: [],
          statistics: null,
        };
  }

  publicSummary(bundle: ProfileBundle) {
    return publicProfileSummary(bundle);
  }
  publicDetail(bundle: ProfileBundle) {
    return publicProfileDetail(bundle);
  }

  async adminProfiles(countryId: string) {
    const country = await this.country(countryId);
    const bundle = country as unknown as ProfileBundle;
    /* The editor explains the statistics source mode in terms of a real
     * number, so it needs the live count the public page would use when the
     * stored figure does not qualify as an override. */
    const derivedUniversitiesCount = await this.prisma.university.count({
      where: { countryId, status: 'PUBLISHED', deletedAt: null },
    });
    return {
      country: {
        id: country.id,
        name: country.name,
        slug: country.slug,
        status: country.status,
        updatedAt: country.updatedAt.toISOString(),
      },
      derivedUniversitiesCount,
      cost: serializeCost(bundle.costProfile),
      work: serializeWork(bundle.workProfile),
      language: serializeLanguage(bundle.languageRequirements),
      intakes: bundle.intakes.map(serializeIntake),
      statistics: serializeStatistics(bundle.statistics),
    };
  }

  async activeIntakes() {
    return this.prisma.intake.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        startMonth: true,
        endMonth: true,
        seasonName: true,
        shortLabel: true,
        description: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async upsertCost(
    countryId: string,
    dto: CostProfileDto,
    request: AuthenticatedRequest,
  ) {
    const current = await this.existing(countryId, 'costProfile');
    version(
      current?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_COST_PROFILE_STALE_VERSION',
    );
    const data = this.costData(dto);
    const row = current
      ? await this.prisma.countryCostProfile.update({
          where: { id: current.id },
          data: data,
        })
      : await this.prisma.countryCostProfile.create({
          data: {
            countryId,
            currencyCode: data.currencyCode as string,
            ...data,
          },
        });
    await this.audit(
      request,
      actorId(request),
      countryId,
      PROFILE_AUDIT_ACTIONS.costUpserted,
      current ? safeProfileFields(data) : null,
      safeProfileFields(data),
    );
    return serializeCost(row);
  }

  async deleteCost(
    countryId: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    return this.deleteOne(
      countryId,
      'costProfile',
      expectedUpdatedAt,
      request,
      PROFILE_AUDIT_ACTIONS.costDeleted,
      'COUNTRY_COST_PROFILE_STALE_VERSION',
    );
  }

  async upsertWork(
    countryId: string,
    dto: WorkProfileDto,
    request: AuthenticatedRequest,
  ) {
    const current = await this.existing(countryId, 'workProfile');
    version(
      current?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_WORK_PROFILE_STALE_VERSION',
    );
    const data = this.workData(dto);
    const row = current
      ? await this.prisma.countryWorkProfile.update({
          where: { id: current.id },
          data: data,
        })
      : await this.prisma.countryWorkProfile.create({
          data: {
            countryId,
            ...data,
          },
        });
    await this.audit(
      request,
      actorId(request),
      countryId,
      PROFILE_AUDIT_ACTIONS.workUpserted,
      current ? safeProfileFields(data) : null,
      safeProfileFields(data),
    );
    return serializeWork(row);
  }

  async deleteWork(
    countryId: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    return this.deleteOne(
      countryId,
      'workProfile',
      expectedUpdatedAt,
      request,
      PROFILE_AUDIT_ACTIONS.workDeleted,
      'COUNTRY_WORK_PROFILE_STALE_VERSION',
    );
  }

  async upsertLanguage(
    countryId: string,
    dto: LanguageProfileDto,
    request: AuthenticatedRequest,
  ) {
    const current = await this.existing(countryId, 'languageRequirements');
    version(
      current?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_LANGUAGE_PROFILE_STALE_VERSION',
    );
    const data = this.languageData(dto);
    const row = current
      ? await this.prisma.countryLanguageRequirement.update({
          where: { id: current.id },
          data: data,
        })
      : await this.prisma.countryLanguageRequirement.create({
          data: {
            countryId,
            ...data,
          },
        });
    await this.audit(
      request,
      actorId(request),
      countryId,
      PROFILE_AUDIT_ACTIONS.languageUpserted,
      current ? safeProfileFields(data) : null,
      safeProfileFields(data),
    );
    return serializeLanguage(row);
  }

  async deleteLanguage(
    countryId: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    return this.deleteOne(
      countryId,
      'languageRequirements',
      expectedUpdatedAt,
      request,
      PROFILE_AUDIT_ACTIONS.languageDeleted,
      'COUNTRY_LANGUAGE_PROFILE_STALE_VERSION',
    );
  }

  async replaceIntakes(
    countryId: string,
    dto: ReplaceIntakesDto,
    request: AuthenticatedRequest,
  ) {
    await this.country(countryId);
    const ids = dto.intakes.map((item) => item.intakeId);
    if (new Set(ids).size !== ids.length)
      throw bad(
        'COUNTRY_INTAKES_DUPLICATE',
        'An intake can only be selected once',
      );
    const masters = await this.prisma.intake.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (masters.length !== ids.length)
      throw bad(
        'COUNTRY_INTAKE_INVALID',
        'All selected intakes must be active intake options',
      );
    const current = await this.prisma.countryIntake.findMany({
      where: { countryId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 1,
    });
    version(
      current[0]?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_INTAKES_STALE_VERSION',
    );
    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.countryIntake.findMany({
        where: { countryId },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 1,
      });
      version(
        latest[0]?.updatedAt,
        dto.expectedUpdatedAt,
        'COUNTRY_INTAKES_STALE_VERSION',
      );
      await tx.countryIntake.deleteMany({ where: { countryId } });
      for (const item of dto.intakes)
        await tx.countryIntake.create({
          data: this.intakeData(
            countryId,
            item,
          ) as Prisma.CountryIntakeUncheckedCreateInput,
        });
    });
    await this.audit(
      request,
      actorId(request),
      countryId,
      PROFILE_AUDIT_ACTIONS.intakesReplaced,
      { count: current.length },
      { count: dto.intakes.length, intakeIds: ids.join(',') },
    );
    const rows = await this.prisma.countryIntake.findMany({
      where: { countryId },
      include: { intake: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    const latest = rows.reduce<Date | null>(
      (current, row) =>
        !current || row.updatedAt > current ? row.updatedAt : current,
      null,
    );
    return {
      intakes: rows.map(serializeIntake),
      updatedAt: latest?.toISOString() ?? null,
    };
  }

  async upsertStatistics(
    countryId: string,
    dto: StatisticsProfileDto,
    request: AuthenticatedRequest,
  ) {
    const current = await this.existing(countryId, 'statistics');
    version(
      current?.updatedAt,
      dto.expectedUpdatedAt,
      'COUNTRY_STATISTICS_STALE_VERSION',
    );
    const data = this.statisticsData(dto);
    const row = current
      ? await this.prisma.countryStatistic.update({
          where: { id: current.id },
          data: data,
        })
      : await this.prisma.countryStatistic.create({
          data: {
            countryId,
            ...data,
          },
        });
    await this.audit(
      request,
      actorId(request),
      countryId,
      PROFILE_AUDIT_ACTIONS.statisticsUpserted,
      current ? safeProfileFields(data) : null,
      safeProfileFields(data),
    );
    return serializeStatistics(row);
  }

  async deleteStatistics(
    countryId: string,
    expectedUpdatedAt: string | undefined,
    request: AuthenticatedRequest,
  ) {
    return this.deleteOne(
      countryId,
      'statistics',
      expectedUpdatedAt,
      request,
      PROFILE_AUDIT_ACTIONS.statisticsDeleted,
      'COUNTRY_STATISTICS_STALE_VERSION',
    );
  }

  private async country(id: string) {
    const record = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
      include: PROFILE_INCLUDE,
    });
    if (!record) throw notFound();
    return record;
  }

  private async existing(
    countryId: string,
    relation:
      'costProfile' | 'workProfile' | 'languageRequirements' | 'statistics',
  ): Promise<{ id: string; updatedAt: Date } | null> {
    await this.country(countryId);
    if (relation === 'costProfile')
      return this.prisma.countryCostProfile.findUnique({
        where: { countryId },
        select: { id: true, updatedAt: true },
      });
    if (relation === 'workProfile')
      return this.prisma.countryWorkProfile.findUnique({
        where: { countryId },
        select: { id: true, updatedAt: true },
      });
    if (relation === 'languageRequirements')
      return this.prisma.countryLanguageRequirement.findUnique({
        where: { countryId },
        select: { id: true, updatedAt: true },
      });
    return this.prisma.countryStatistic.findUnique({
      where: { countryId },
      select: { id: true, updatedAt: true },
    });
  }

  private async deleteOne(
    countryId: string,
    relation:
      'costProfile' | 'workProfile' | 'languageRequirements' | 'statistics',
    expected: string | undefined,
    request: AuthenticatedRequest,
    action: string,
    code: string,
  ) {
    const current = await this.existing(countryId, relation);
    if (!current) return { deleted: false };
    version(current.updatedAt, expected, code);
    if (relation === 'costProfile')
      await this.prisma.countryCostProfile.delete({
        where: { id: current.id },
      });
    if (relation === 'workProfile')
      await this.prisma.countryWorkProfile.delete({
        where: { id: current.id },
      });
    if (relation === 'languageRequirements')
      await this.prisma.countryLanguageRequirement.delete({
        where: { id: current.id },
      });
    if (relation === 'statistics')
      await this.prisma.countryStatistic.delete({ where: { id: current.id } });
    await this.audit(
      request,
      actorId(request),
      countryId,
      action,
      { profile: relation },
      { deleted: true },
    );
    return { deleted: true };
  }

  private async audit(
    request: AuthenticatedRequest,
    userId: string,
    countryId: string,
    action: string,
    oldValues: Record<string, string | number | boolean | null> | null,
    newValues: Record<string, string | number | boolean | null> | null,
  ) {
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COUNTRY',
      countryId,
      action,
      oldValues,
      newValues,
      'Structured country profile changed',
    );
  }

  private costData(dto: CostProfileDto): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const money = [
      'tuitionMin',
      'tuitionMax',
      'livingCostMin',
      'livingCostMax',
      'accommodationMin',
      'accommodationMax',
      'foodCostMin',
      'foodCostMax',
      'transportCostMin',
      'transportCostMax',
      'healthInsuranceCost',
      'applicationFeeMin',
      'applicationFeeMax',
    ] as const;
    for (const field of money) data[field] = decimal(dto[field], 2, field, 10);
    range(
      data.tuitionMin as Prisma.Decimal | undefined,
      data.tuitionMax as Prisma.Decimal | undefined,
      'tuition',
    );
    range(
      data.livingCostMin as Prisma.Decimal | undefined,
      data.livingCostMax as Prisma.Decimal | undefined,
      'livingCost',
    );
    range(
      data.accommodationMin as Prisma.Decimal | undefined,
      data.accommodationMax as Prisma.Decimal | undefined,
      'accommodation',
    );
    range(
      data.foodCostMin as Prisma.Decimal | undefined,
      data.foodCostMax as Prisma.Decimal | undefined,
      'foodCost',
    );
    range(
      data.transportCostMin as Prisma.Decimal | undefined,
      data.transportCostMax as Prisma.Decimal | undefined,
      'transportCost',
    );
    range(
      data.applicationFeeMin as Prisma.Decimal | undefined,
      data.applicationFeeMax as Prisma.Decimal | undefined,
      'applicationFee',
    );
    if (
      dto.currencyCode !== undefined &&
      dto.currencyCode !== null &&
      !/^[A-Za-z]{3}$/.test(dto.currencyCode.trim())
    )
      throw bad(
        'PROFILE_CURRENCY_INVALID',
        'currencyCode must be a three-letter code',
      );
    if (!dto.currencyCode?.trim())
      throw bad('PROFILE_CURRENCY_REQUIRED', 'currencyCode is required');
    Object.assign(data, {
      currencyCode: dto.currencyCode.trim().toUpperCase(),
      currencySymbol: optionalText(dto.currencySymbol),
      tuitionPeriod: dto.tuitionPeriod,
      tuitionNotes: optionalText(dto.tuitionNotes),
      livingCostPeriod: dto.livingCostPeriod,
      livingCostNotes: optionalText(dto.livingCostNotes),
      budgetBand: dto.budgetBand,
      applicableYear: dto.applicableYear,
      sourceReference: url(dto.sourceReference),
      disclaimer: optionalText(dto.disclaimer),
      verifiedAt: verifiedAt(
        (dto as unknown as { verifiedAt?: string }).verifiedAt,
      ),
    });
    return data;
  }

  private workData(dto: WorkProfileDto): Record<string, unknown> {
    const weekly = decimal(
      dto.partTimeHoursPerWeek,
      2,
      'partTimeHoursPerWeek',
      3,
    );
    const breaks = decimal(
      dto.partTimeHoursDuringBreaks,
      2,
      'partTimeHoursDuringBreaks',
      3,
    );
    const percentage = decimal(
      dto.visaSuccessPercentage,
      2,
      'visaSuccessPercentage',
      3,
    );
    const visaFee = decimal(dto.visaFee, 2, 'visaFee', 10);
    if (
      dto.visaFeeCurrencyCode !== undefined &&
      dto.visaFeeCurrencyCode !== null &&
      dto.visaFeeCurrencyCode !== '' &&
      !/^[A-Za-z]{3}$/.test(dto.visaFeeCurrencyCode.trim())
    )
      throw bad(
        'PROFILE_CURRENCY_INVALID',
        'visaFeeCurrencyCode must be a three-letter code',
      );
    if (weekly?.greaterThan(168) || breaks?.greaterThan(168))
      throw bad(
        'PROFILE_HOURS_INVALID',
        'Work hours cannot exceed 168 per week',
      );
    if (percentage?.greaterThan(100))
      throw bad(
        'PROFILE_PERCENTAGE_INVALID',
        'visaSuccessPercentage cannot exceed 100',
      );
    if (
      dto.postStudyWorkMinMonths !== undefined &&
      dto.postStudyWorkMaxMonths !== undefined &&
      dto.postStudyWorkMinMonths > dto.postStudyWorkMaxMonths
    )
      throw bad(
        'PROFILE_RANGE_INVALID',
        'post-study work minimum cannot exceed maximum',
      );
    const sourceReference = url(dto.sourceReference);
    const verification = verifiedAt(
      (dto as unknown as { verifiedAt?: string }).verifiedAt,
    );
    if (
      ((dto.visaSuccessBand && dto.visaSuccessBand !== 'NOT_PUBLISHED') ||
        percentage) &&
      (!sourceReference || !verification)
    )
      throw bad(
        'PROFILE_SOURCE_REQUIRED',
        'Published visa claims require sourceReference and verifiedAt',
      );
    if (
      dto.immigrationPathwayStrength &&
      dto.immigrationPathwayStrength !== 'NOT_PUBLISHED' &&
      (!sourceReference || !verification)
    )
      throw bad(
        'PROFILE_SOURCE_REQUIRED',
        'Published pathway claims require sourceReference and verifiedAt',
      );
    return {
      partTimeAllowed: dto.partTimeAllowed,
      partTimeHoursPerWeek: weekly,
      partTimeHoursDuringBreaks: breaks,
      partTimeSummary: optionalText(dto.partTimeSummary),
      postStudyWorkAvailable: dto.postStudyWorkAvailable,
      postStudyWorkMinMonths: dto.postStudyWorkMinMonths,
      postStudyWorkMaxMonths: dto.postStudyWorkMaxMonths,
      postStudyWorkSummary: optionalText(dto.postStudyWorkSummary),
      immigrationPathwayStrength: dto.immigrationPathwayStrength,
      immigrationPathwaySummary: optionalText(dto.immigrationPathwaySummary),
      visaSuccessBand: dto.visaSuccessBand,
      visaSuccessPercentage: percentage,
      visaInformation: optionalText(dto.visaInformation),
      visaType: optionalText(dto.visaType),
      visaFee,
      visaFeeCurrencyCode: optionalText(dto.visaFeeCurrencyCode)?.toUpperCase(),
      visaProcessingTime: optionalText(dto.visaProcessingTime),
      proofOfFundsSummary: optionalText(dto.proofOfFundsSummary),
      sourceReference,
      disclaimer: optionalText(dto.disclaimer),
      verifiedAt: verification,
    };
  }

  private languageData(dto: LanguageProfileDto): Record<string, unknown> {
    const scores: Array<[string, string | undefined, number, number]> = [
      ['ieltsMinScore', dto.ieltsMinScore, 1, 2],
      ['pteMinScore', dto.pteMinScore, 2, 3],
      ['toeflMinScore', dto.toeflMinScore, 2, 3],
      ['duolingoMinScore', dto.duolingoMinScore, 2, 3],
    ];
    const data: Record<string, unknown> = {};
    for (const [field, value, scale, integerDigits] of scores)
      data[field] = decimal(value, scale, field, integerDigits);
    if (
      data.ieltsMinScore &&
      (data.ieltsMinScore as Prisma.Decimal).greaterThan(9)
    )
      throw bad(
        'PROFILE_LANGUAGE_SCORE_INVALID',
        'IELTS score cannot exceed 9',
      );
    if (
      data.pteMinScore &&
      (data.pteMinScore as Prisma.Decimal).greaterThan(200)
    )
      throw bad(
        'PROFILE_LANGUAGE_SCORE_INVALID',
        'PTE score cannot exceed 200',
      );
    if (
      data.toeflMinScore &&
      (data.toeflMinScore as Prisma.Decimal).greaterThan(120)
    )
      throw bad(
        'PROFILE_LANGUAGE_SCORE_INVALID',
        'TOEFL score cannot exceed 120',
      );
    if (
      data.duolingoMinScore &&
      (data.duolingoMinScore as Prisma.Decimal).greaterThan(160)
    )
      throw bad(
        'PROFILE_LANGUAGE_SCORE_INVALID',
        'Duolingo score cannot exceed 160',
      );
    const pairs: Array<[string, string, string]> = [
      ['ieltsRequirement', 'ieltsMinScore', 'IELTS'],
      ['pteRequirement', 'pteMinScore', 'PTE'],
      ['toeflRequirement', 'toeflMinScore', 'TOEFL'],
      ['duolingoRequirement', 'duolingoMinScore', 'Duolingo'],
    ];
    for (const [state, score, label] of pairs)
      if (
        dto[state as keyof LanguageProfileDto] &&
        ['NOT_REQUIRED', 'VARIES'].includes(
          String(dto[state as keyof LanguageProfileDto]),
        ) &&
        data[score]
      )
        throw bad(
          'PROFILE_LANGUAGE_SCORE_INVALID',
          `${label} score cannot be set when the requirement is not applicable`,
        );
    const sourceReference = url(dto.sourceReference);
    const verification = verifiedAt(
      (dto as unknown as { verifiedAt?: string }).verifiedAt,
    );
    if (dto.languageWaiverAvailable && (!sourceReference || !verification))
      throw bad(
        'PROFILE_SOURCE_REQUIRED',
        'A published language waiver requires sourceReference and verifiedAt',
      );
    return {
      ...data,
      ieltsRequirement: dto.ieltsRequirement,
      ieltsNotes: optionalText(dto.ieltsNotes),
      pteRequirement: dto.pteRequirement,
      pteNotes: optionalText(dto.pteNotes),
      toeflRequirement: dto.toeflRequirement,
      toeflNotes: optionalText(dto.toeflNotes),
      duolingoRequirement: dto.duolingoRequirement,
      duolingoNotes: optionalText(dto.duolingoNotes),
      languageWaiverAvailable: dto.languageWaiverAvailable,
      waiverNotes: optionalText(dto.waiverNotes),
      generalNotes: optionalText(dto.generalNotes),
      sourceReference,
      disclaimer: optionalText(dto.disclaimer),
      verifiedAt: verification,
    };
  }

  private intakeData(
    countryId: string,
    item: CountryIntakeItemDto,
  ): Record<string, unknown> {
    return {
      countryId,
      intakeId: item.intakeId,
      isMajor: item.isMajor ?? false,
      availabilityStatus: item.availabilityStatus ?? 'AVAILABLE',
      applicationOpeningMonth: item.applicationOpeningMonth,
      applicationDeadlineMonth: item.applicationDeadlineMonth,
      applicationOpeningNote: optionalText(item.applicationOpeningNote),
      applicationDeadlineNote: optionalText(item.applicationDeadlineNote),
      notes: optionalText(item.notes),
      displayOrder: item.displayOrder ?? 0,
    };
  }

  private statisticsData(dto: StatisticsProfileDto): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const counts = [
      'universitiesCount',
      'publicUniversitiesCount',
      'privateUniversitiesCount',
      'coursesCount',
      'ugCoursesCount',
      'pgCoursesCount',
      'pgdmCoursesCount',
      'mbaCoursesCount',
      'phdCoursesCount',
      'scholarshipsCount',
      'citiesCount',
      'topRankedUniversitiesCount',
      'internationalStudentsCount',
    ] as const;
    for (const field of counts)
      if (dto[field] !== undefined) data[field] = dto[field];
    if (dto.studentSatisfactionPercentage !== undefined) {
      const percentage = decimal(
        dto.studentSatisfactionPercentage,
        2,
        'studentSatisfactionPercentage',
        3,
      );
      if (percentage?.greaterThan(100))
        throw bad(
          'PROFILE_PERCENTAGE_INVALID',
          'studentSatisfactionPercentage cannot exceed 100',
        );
      data.studentSatisfactionPercentage = percentage;
    }
    data.sourceMode = dto.sourceMode ?? STATISTICS_SOURCE_MODES[0];
    data.sourceReference = url(dto.sourceReference);
    data.verifiedAt = verifiedAt(
      (dto as unknown as { verifiedAt?: string }).verifiedAt,
    );
    if (
      data.sourceMode !== 'DERIVED' &&
      (!data.sourceReference || !data.verifiedAt)
    )
      throw bad(
        'PROFILE_SOURCE_REQUIRED',
        'Manual, imported, and official statistics require a source and verification date',
      );
    return data;
  }
}
