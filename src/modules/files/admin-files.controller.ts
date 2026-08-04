import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileAssetDto } from '@/common/openapi/domain-response.dto';
import { ApiEnvelope } from '@/common/openapi/api-envelope.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { FilesService } from './files.service';
import { buildMulterOptions } from './multer-options';
import {
  CloudinaryUploadSignatureDto,
  CompleteCloudinaryUploadDto,
  UpdateFileDto,
  UploadFileDto,
} from './dto/file.dto';

@ApiTags('Archivos')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly service: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los archivos del sistema' })
  @ApiEnvelope(FileAssetDto, {
    paginated: true,
    description: 'Archivos registrados en el sistema.',
  })
  list(@Query() query: PaginationQueryDto) {
    return this.service.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar los metadatos de un archivo' })
  @ApiEnvelope(FileAssetDto, { description: 'Metadatos del archivo. No devuelve el contenido.' })
  get(@Param('id') id: string) {
    return this.service.getAdmin(id);
  }

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

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los metadatos de un archivo' })
  @ApiEnvelope(FileAssetDto, { description: 'Metadatos actualizados.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.service.updateAdmin(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un archivo' })
  @ApiEnvelope(
    {
      type: 'object',
      properties: { success: { type: 'boolean', example: true } },
      required: ['success'],
    },
    { description: 'Archivo eliminado. El borrado queda registrado en file_access_log.' },
  )
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteAdmin(user.sub, id);
  }
}
