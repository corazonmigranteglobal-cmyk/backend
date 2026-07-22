import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { FilesService } from './files.service';
import { buildMulterOptions } from './multer-options';
import {
  CloudinaryUploadSignatureDto,
  CompleteCloudinaryUploadDto,
  UploadFileDto,
} from './dto/file.dto';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post('cloudinary/signature')
  createCloudinarySignature(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudinaryUploadSignatureDto,
  ) {
    return this.service.createCloudinaryUploadSignature(user, dto);
  }

  @Post('cloudinary/complete')
  completeCloudinaryUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteCloudinaryUploadDto,
  ) {
    return this.service.completeCloudinaryUpload(user, dto);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', buildMulterOptions()))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(user, dto, file);
  }

  @Get(':id/signed-url')
  @Public()
  signedUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getDownloadInfo(user, id);
  }

  @Get(':id/download')
  @Public()
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.downloadLocal(user, id, response);
  }
}
