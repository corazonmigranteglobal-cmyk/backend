import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PaginationQueryDto } from '@/common/pagination/pagination.dto';
import { UsersService } from './users.service';
import {
  UpdatePatientProfileDto,
  UpdateTherapistProfileDto,
  UpdateUserAvatarDto,
  UpdateUserStatusDto,
} from './dto/update-profile.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil completo del usuario.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.me(user.sub);
  }

  @Patch('me/patient-profile')
  @Roles('PATIENT')
  @ApiOperation({ summary: 'Actualizar perfil de paciente propio' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado.' })
  updatePatient(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePatientProfileDto) {
    return this.usersService.updatePatientProfile(user.sub, dto, user.sub);
  }

  @Patch('me/therapist-profile')
  @Roles('THERAPIST')
  @ApiOperation({ summary: 'Actualizar perfil de terapeuta propio' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado.' })
  updateTherapist(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTherapistProfileDto) {
    return this.usersService.updateTherapistProfile(user.sub, dto, user.sub);
  }

  @Patch('me/avatar')
  @ApiOperation({ summary: 'Actualizar avatar del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Avatar actualizado.' })
  updateOwnAvatar(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserAvatarDto) {
    return this.usersService.updateUserAvatar(user.sub, dto.avatarFileId, user.sub);
  }

  @Get('admin/users/patients')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users:read')
  @ApiOperation({ summary: '[Admin] Listar pacientes con paginación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de pacientes.' })
  listPatients(@Query() query: PaginationQueryDto) {
    return this.usersService.listPatients(query);
  }

  @Get('admin/users')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Permissions('users:read')
  @ApiOperation({ summary: '[Admin] Listar todos los usuarios con paginación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de usuarios.' })
  list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query);
  }

  @Patch('admin/users/:userId/therapist-profile')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Actualizar perfil de terapeuta por ID' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado.' })
  updateTherapistByAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateTherapistProfileDto,
  ) {
    return this.usersService.updateTherapistProfile(userId, dto, user.sub);
  }

  @Patch('admin/users/:userId/avatar')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Actualizar avatar de usuario por ID' })
  @ApiResponse({ status: 200, description: 'Avatar actualizado.' })
  updateUserAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserAvatarDto,
  ) {
    return this.usersService.updateUserAvatar(userId, dto.avatarFileId, user.sub);
  }

  @Patch('admin/users/:userId/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: '[Admin] Cambiar estado de usuario (ACTIVE/INACTIVE/BLOCKED/PENDING)' })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateUserStatus(userId, dto.status, user.sub);
  }
}
