import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ResponseEnvelope } from '../common/http.types';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { StudentAccessGuard, studentUserId } from './student-access.guard';
import { StudentDocumentService } from './student-document.service';
import {
  StudentDocumentUploadDto,
  UpdateStudentDocumentDto,
} from './dto/student-profile.dto';

function envelope<T>(
  request: AuthenticatedRequest,
  data: T,
): ResponseEnvelope<T> {
  return {
    data,
    meta: null,
    error: null,
    requestId: request.requestId ?? 'unknown-request',
    timestamp: new Date().toISOString(),
  };
}

@ApiTags('student-documents')
@ApiBearerAuth()
@Controller('student/documents')
@UseGuards(StudentAccessGuard)
export class StudentDocumentController {
  constructor(private readonly documents: StudentDocumentService) {}

  @Get()
  @ApiOperation({ summary: 'The student’s own documents' })
  async list(@Req() request: AuthenticatedRequest) {
    return envelope(request, await this.documents.list(studentUserId(request)));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document',
    description:
      'The file is stored and recorded as this student’s in one call, so ' +
      'there is no media id for a caller to supply or guess.',
  })
  async upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: StudentDocumentUploadDto,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Choose a file to upload',
        details: null,
      });
    }
    return envelope(
      request,
      await this.documents.upload(studentUserId(request), file, dto),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or re-categorise a document' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDocumentDto,
  ) {
    return envelope(
      request,
      await this.documents.updateMetadata(studentUserId(request), id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a document' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.documents.remove(studentUserId(request), id);
  }
}
