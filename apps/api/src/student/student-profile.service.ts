import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateProfileCompletion,
  type CompletionResult,
} from './profile-completion';

function notFound(what: string): HttpException {
  return new HttpException(
    { code: 'NOT_FOUND', message: `${what} not found`, details: null },
    HttpStatus.NOT_FOUND,
  );
}

function invalid(message: string): HttpException {
  return new HttpException(
    { code: 'VALIDATION_ERROR', message, details: null },
    HttpStatus.BAD_REQUEST,
  );
}

function decimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Everything a student owns about themselves.
 *
 * Every method takes the authenticated user's id and resolves the profile from
 * it. No method accepts a studentProfileId or userId from a caller, and every
 * child-record write is scoped by `studentProfileId` in the same `where` as the
 * record id — so a guessed id belonging to another student matches zero rows
 * and updates nothing, rather than being found and then checked.
 */
@Injectable()
export class StudentProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves — and lazily creates — the caller's own profile row. */
  private async profileIdFor(userId: string): Promise<string> {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.studentProfile.create({
      data: { userId },
      select: { id: true },
    });
    return created.id;
  }

  // -- profile ------------------------------------------------------------

  /**
   * The profile a student sees. Passport is deliberately absent: it has its
   * own endpoint so that sensitive data is never carried by a response fetched
   * on every page load.
   */
  async getProfile(userId: string) {
    const id = await this.profileIdFor(userId);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id },
      include: {
        preferredCountries: {
          include: {
            country: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
        nationalityCountry: { select: { id: true, name: true } },
        currentCountry: { select: { id: true, name: true } },
        preferredSubject: { select: { id: true, name: true } },
        preferredCourseLevel: { select: { id: true, name: true } },
        preferredIntake: { select: { id: true, name: true } },
      },
    });

    return {
      personal: {
        dateOfBirth: isoDate(profile.dateOfBirth),
        gender: profile.gender,
        nationalityCountry: profile.nationalityCountry,
        currentCountry: profile.currentCountry,
        currentCityText: profile.currentCityText,
        address: profile.address,
        postalCode: profile.postalCode,
      },
      studyPreferences: {
        subject: profile.preferredSubject,
        courseLevel: profile.preferredCourseLevel,
        intake: profile.preferredIntake,
        countries: profile.preferredCountries.map((entry) => entry.country),
        budgetMin: decimal(profile.budgetMin),
        budgetMax: decimal(profile.budgetMax),
        budgetCurrency: profile.budgetCurrency,
      },
    };
  }

  /**
   * Only the fields listed here can be written, and each is read explicitly
   * off the DTO. A property the DTO does not declare cannot reach Prisma even
   * if validation were somehow bypassed.
   */
  async updateProfile(
    userId: string,
    dto: {
      dateOfBirth?: string | null;
      gender?: string | null;
      nationalityCountryId?: string | null;
      currentCountryId?: string | null;
      currentCityText?: string | null;
      address?: string | null;
      postalCode?: string | null;
      preferredSubjectId?: string | null;
      preferredCourseLevelId?: string | null;
      preferredIntakeId?: string | null;
      preferredCountryIds?: string[];
      budgetMin?: number | null;
      budgetMax?: number | null;
      budgetCurrency?: string | null;
    },
  ) {
    const id = await this.profileIdFor(userId);

    if (
      dto.budgetMin !== undefined &&
      dto.budgetMax !== undefined &&
      dto.budgetMin !== null &&
      dto.budgetMax !== null &&
      dto.budgetMin > dto.budgetMax
    ) {
      throw invalid('Minimum budget cannot be greater than maximum budget');
    }

    const data: Record<string, unknown> = {};
    const assign = <K extends keyof typeof dto>(
      key: K,
      column = key as string,
    ) => {
      if (dto[key] !== undefined) data[column] = dto[key];
    };
    assign('gender');
    assign('nationalityCountryId');
    assign('currentCountryId');
    assign('currentCityText');
    assign('address');
    assign('postalCode');
    assign('preferredSubjectId');
    assign('preferredCourseLevelId');
    assign('preferredIntakeId');
    assign('budgetMin');
    assign('budgetMax');
    assign('budgetCurrency');
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({ where: { id }, data });
      if (dto.preferredCountryIds !== undefined) {
        await tx.studentPreferredCountry.deleteMany({
          where: { studentProfileId: id },
        });
        const unique = [...new Set(dto.preferredCountryIds)];
        if (unique.length) {
          await tx.studentPreferredCountry.createMany({
            data: unique.map((countryId, index) => ({
              studentProfileId: id,
              countryId,
              displayOrder: index,
            })),
          });
        }
      }
    });

    return this.getProfile(userId);
  }

  // -- academic history ---------------------------------------------------

  async listAcademics(userId: string) {
    const id = await this.profileIdFor(userId);
    const rows = await this.prisma.studentAcademicRecord.findMany({
      where: { studentProfileId: id },
      include: { country: { select: { id: true, name: true } } },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      qualificationName: row.qualificationName,
      qualificationLevel: row.qualificationLevel,
      institutionName: row.institutionName,
      boardOrUniversity: row.boardOrUniversity,
      country: row.country,
      specialization: row.specialization,
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
      currentlyStudying: row.currentlyStudying,
      percentage: decimal(row.percentage),
      gpa: decimal(row.gpa),
      gpaScale: decimal(row.gpaScale),
      notes: row.notes,
    }));
  }

  private assertDateOrder(start?: string | null, end?: string | null): void {
    if (start && end && new Date(end) < new Date(start)) {
      throw invalid('End date cannot be before start date');
    }
  }

  async createAcademic(userId: string, dto: Record<string, unknown>) {
    const id = await this.profileIdFor(userId);
    this.assertDateOrder(
      dto.startDate as string | undefined,
      dto.endDate as string | undefined,
    );
    const created = await this.prisma.studentAcademicRecord.create({
      data: {
        studentProfileId: id,
        qualificationName: String(dto.qualificationName),
        qualificationLevel: (dto.qualificationLevel as string) ?? null,
        institutionName: String(dto.institutionName),
        boardOrUniversity: (dto.boardOrUniversity as string) ?? null,
        countryId: (dto.countryId as string) ?? null,
        specialization: (dto.specialization as string) ?? null,
        startDate: dto.startDate ? new Date(dto.startDate as string) : null,
        endDate: dto.endDate ? new Date(dto.endDate as string) : null,
        currentlyStudying: Boolean(dto.currentlyStudying),
        percentage: (dto.percentage as number) ?? null,
        gpa: (dto.gpa as number) ?? null,
        gpaScale: (dto.gpaScale as number) ?? null,
        notes: (dto.notes as string) ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async updateAcademic(
    userId: string,
    recordId: string,
    dto: Record<string, unknown>,
  ) {
    const id = await this.profileIdFor(userId);
    this.assertDateOrder(
      dto.startDate as string | undefined,
      dto.endDate as string | undefined,
    );
    const data: Record<string, unknown> = {};
    for (const key of [
      'qualificationName',
      'qualificationLevel',
      'institutionName',
      'boardOrUniversity',
      'countryId',
      'specialization',
      'currentlyStudying',
      'percentage',
      'gpa',
      'gpaScale',
      'notes',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate as string) : null;
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate as string) : null;
    }

    // Ownership is part of the filter, not a check after the fact.
    const result = await this.prisma.studentAcademicRecord.updateMany({
      where: { id: recordId, studentProfileId: id },
      data,
    });
    if (result.count === 0) throw notFound('Academic record');
    return { id: recordId };
  }

  async deleteAcademic(userId: string, recordId: string) {
    const id = await this.profileIdFor(userId);
    const result = await this.prisma.studentAcademicRecord.deleteMany({
      where: { id: recordId, studentProfileId: id },
    });
    if (result.count === 0) throw notFound('Academic record');
  }

  // -- work experience ----------------------------------------------------

  async listWork(userId: string) {
    const id = await this.profileIdFor(userId);
    const rows = await this.prisma.studentWorkExperience.findMany({
      where: { studentProfileId: id },
      orderBy: [{ startDate: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      employmentType: row.employmentType,
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
      currentlyWorking: row.currentlyWorking,
      description: row.description,
    }));
  }

  private normaliseWorkDates(dto: Record<string, unknown>): void {
    if (dto.currentlyWorking === true && dto.endDate) {
      throw invalid('A current role cannot also have an end date');
    }
    this.assertDateOrder(
      dto.startDate as string | undefined,
      dto.endDate as string | undefined,
    );
  }

  async createWork(userId: string, dto: Record<string, unknown>) {
    const id = await this.profileIdFor(userId);
    this.normaliseWorkDates(dto);
    const created = await this.prisma.studentWorkExperience.create({
      data: {
        studentProfileId: id,
        companyName: String(dto.companyName),
        jobTitle: String(dto.jobTitle),
        employmentType: (dto.employmentType as string) ?? null,
        startDate: new Date(dto.startDate as string),
        endDate: dto.endDate ? new Date(dto.endDate as string) : null,
        currentlyWorking: Boolean(dto.currentlyWorking),
        description: (dto.description as string) ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async updateWork(
    userId: string,
    recordId: string,
    dto: Record<string, unknown>,
  ) {
    const id = await this.profileIdFor(userId);
    this.normaliseWorkDates(dto);
    const data: Record<string, unknown> = {};
    for (const key of [
      'companyName',
      'jobTitle',
      'employmentType',
      'currentlyWorking',
      'description',
    ]) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.startDate !== undefined) {
      data.startDate = new Date(dto.startDate as string);
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate as string) : null;
    }
    const result = await this.prisma.studentWorkExperience.updateMany({
      where: { id: recordId, studentProfileId: id },
      data,
    });
    if (result.count === 0) throw notFound('Work experience');
    return { id: recordId };
  }

  async deleteWork(userId: string, recordId: string) {
    const id = await this.profileIdFor(userId);
    const result = await this.prisma.studentWorkExperience.deleteMany({
      where: { id: recordId, studentProfileId: id },
    });
    if (result.count === 0) throw notFound('Work experience');
  }

  // -- english tests ------------------------------------------------------

  async listEnglishTests(userId: string) {
    const id = await this.profileIdFor(userId);
    const rows = await this.prisma.studentEnglishTest.findMany({
      where: { studentProfileId: id },
      orderBy: [{ testDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      testType: row.testType,
      testDate: isoDate(row.testDate),
      overallScore: decimal(row.overallScore),
      componentScores: row.componentScores,
      expiryDate: isoDate(row.expiryDate),
    }));
  }

  async createEnglishTest(userId: string, dto: Record<string, unknown>) {
    const id = await this.profileIdFor(userId);
    const created = await this.prisma.studentEnglishTest.create({
      data: {
        studentProfileId: id,
        testType: String(dto.testType),
        testDate: dto.testDate ? new Date(dto.testDate as string) : null,
        overallScore: dto.overallScore as number,
        componentScores:
          (dto.componentScores as Record<string, number> | undefined) ??
          undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate as string) : null,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async updateEnglishTest(
    userId: string,
    recordId: string,
    dto: Record<string, unknown>,
  ) {
    const id = await this.profileIdFor(userId);
    const data: Record<string, unknown> = {};
    for (const key of ['testType', 'overallScore', 'componentScores']) {
      if (dto[key] !== undefined) data[key] = dto[key];
    }
    if (dto.testDate !== undefined) {
      data.testDate = dto.testDate ? new Date(dto.testDate as string) : null;
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate
        ? new Date(dto.expiryDate as string)
        : null;
    }
    const result = await this.prisma.studentEnglishTest.updateMany({
      where: { id: recordId, studentProfileId: id },
      data,
    });
    if (result.count === 0) throw notFound('English test');
    return { id: recordId };
  }

  async deleteEnglishTest(userId: string, recordId: string) {
    const id = await this.profileIdFor(userId);
    const result = await this.prisma.studentEnglishTest.deleteMany({
      where: { id: recordId, studentProfileId: id },
    });
    if (result.count === 0) throw notFound('English test');
  }

  // -- passport -----------------------------------------------------------

  /** Its own endpoint, reached only by the owner. Never folded into the
   * profile response, never listed, never logged. */
  async getPassport(userId: string) {
    const id = await this.profileIdFor(userId);
    const row = await this.prisma.studentPassport.findUnique({
      where: { studentProfileId: id },
      include: { issuingCountry: { select: { id: true, name: true } } },
    });
    if (!row) return null;
    return {
      passportNumber: row.passportNumber,
      issuingCountry: row.issuingCountry,
      issueDate: isoDate(row.issueDate),
      expiryDate: isoDate(row.expiryDate),
    };
  }

  async savePassport(userId: string, dto: Record<string, unknown>) {
    const id = await this.profileIdFor(userId);
    if (dto.issueDate && dto.expiryDate) {
      this.assertDateOrder(dto.issueDate as string, dto.expiryDate as string);
    }
    const payload = {
      passportNumber: String(dto.passportNumber).trim(),
      issuingCountryId: (dto.issuingCountryId as string) ?? null,
      issueDate: dto.issueDate ? new Date(dto.issueDate as string) : null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate as string) : null,
    };
    await this.prisma.studentPassport.upsert({
      where: { studentProfileId: id },
      create: { studentProfileId: id, ...payload },
      update: payload,
    });
    return this.getPassport(userId);
  }

  async deletePassport(userId: string) {
    const id = await this.profileIdFor(userId);
    await this.prisma.studentPassport.deleteMany({
      where: { studentProfileId: id },
    });
  }

  // -- completion ---------------------------------------------------------

  async completion(userId: string): Promise<CompletionResult> {
    const id = await this.profileIdFor(userId);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id },
      select: {
        dateOfBirth: true,
        nationalityCountryId: true,
        currentCountryId: true,
        preferredSubjectId: true,
        preferredCourseLevelId: true,
        _count: {
          select: {
            preferredCountries: true,
            academicRecords: true,
            englishTests: true,
          },
        },
        passport: { select: { id: true } },
        documents: { select: { documentType: true } },
      },
    });

    return calculateProfileCompletion({
      dateOfBirth: profile.dateOfBirth,
      nationalityCountryId: profile.nationalityCountryId,
      currentCountryId: profile.currentCountryId,
      preferredSubjectId: profile.preferredSubjectId,
      preferredCourseLevelId: profile.preferredCourseLevelId,
      preferredCountryCount: profile._count.preferredCountries,
      academicRecordCount: profile._count.academicRecords,
      englishTestCount: profile._count.englishTests,
      hasPassport: profile.passport !== null,
      documentTypes: profile.documents.map((doc) => doc.documentType),
    });
  }
}
