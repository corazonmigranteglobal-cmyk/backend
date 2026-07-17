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
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { FilesService } from './files.service';
import { buildMulterOptions } from './multer-options';
import { CloudinaryUploadSignatureDto, CompleteCloudinaryUploadDto, UpdateFileDto, UploadFileDto } from './dto/file.dto';

@ApiTags('Admin files')
@ApiBearerAuth()
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly service: FilesService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.listAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getAdmin(id);
  }

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
  @UseInterceptors(
    FileInterceptor('file', buildMulterOptions()),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(user, dto, file);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.service.updateAdmin(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteAdmin(user.sub, id);
  }
}
