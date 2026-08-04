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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileAssetDto, SignedUrlDto } from '@/common/openapi/domain-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
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

@ApiTags('Archivos')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post('cloudinary/signature')
  @ApiOperation({ summary: 'Emitir una firma para subir un archivo directamente a Cloudinary' })
  createCloudinarySignature(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloudinaryUploadSignatureDto,
  ) {
    return this.service.createCloudinaryUploadSignature(user, dto);
  }

  @Post('cloudinary/complete')
  @ApiOperation({ summary: 'Registrar en el sistema un archivo ya subido a Cloudinary' })
  @ApiEnvelope(FileAssetDto, {
    status: 201,
    description: 'Archivo ya subido a Cloudinary, ahora registrado en el sistema.',
  })
  completeCloudinaryUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteCloudinaryUploadDto,
  ) {
    return this.service.completeCloudinaryUpload(user, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Subir un archivo a través de la API' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', buildMulterOptions()))
  @ApiEnvelope(FileAssetDto, {
    status: 201,
    description: 'Archivo subido a traves de la API y registrado.',
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(user, dto, file);
  }

  @Get(':id/signed-url')
  @ApiOperation({ summary: 'Obtener una URL firmada temporal de un archivo' })
  @Public()
  @ApiEnvelope(SignedUrlDto, {
    description:
      'URL firmada temporal. Lo que autoriza es el enlace, no la sesion: es transferible durante su vigencia.',
  })
  signedUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getDownloadInfo(user, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar un archivo' })
  @Public()
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.service.downloadLocal(user, id, response);
  }
}
