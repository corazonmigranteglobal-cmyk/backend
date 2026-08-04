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
  list(@Query() query: PaginationQueryDto) {
    return this.service.listAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar los metadatos de un archivo' })
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
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(user, dto, file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los metadatos de un archivo' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.service.updateAdmin(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un archivo' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteAdmin(user.sub, id);
  }
}
