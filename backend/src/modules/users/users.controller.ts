import {
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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AssignRolesDto,
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  UpdateUserDto,
} from './users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CurrentUser,
  Permissions,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() actor: AuthenticatedActor, @Req() req: AuthenticatedRequest) {
    return this.users.findById(toContext(actor, req), actor.userId);
  }

  @Get()
  @Permissions('user.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListUsersQueryDto)) query: ListUsersQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.users.list(toContext(actor, req), query);
  }

  @Get(':id')
  @Permissions('user.view')
  findOne(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.users.findById(toContext(actor, req), id);
  }

  @Post()
  @Permissions('user.create')
  create(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(CreateUserDto)) dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.users.create(toContext(actor, req), dto);
  }

  @Patch(':id')
  @Permissions('user.update')
  update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserDto)) dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.users.update(toContext(actor, req), id, dto);
  }

  @Put(':id/roles')
  @Permissions('user.assign_role')
  assignRoles(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AssignRolesDto)) dto: AssignRolesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.users.assignRoles(toContext(actor, req), id, dto);
  }

  @Post(':id/reset-password')
  @Permissions('user.reset_password')
  async resetPassword(@CurrentUser() actor: AuthenticatedActor, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ResetUserPasswordDto)) dto: ResetUserPasswordDto, @Req() req: AuthenticatedRequest): Promise<void> {
    await this.users.resetPassword(toContext(actor, req), id, dto.temporaryPassword);
  }

  @Delete(':id')
  @Permissions('user.deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.users.softDelete(toContext(actor, req), id);
  }
}

function toContext(actor: AuthenticatedActor, req: AuthenticatedRequest) {
  return {
    userId: actor.userId,
    tenantId: actor.tenantId,
    userEmail: actor.email,
    requestId: req.requestId!,
    clientIp: req.ip,
    userAgent: req.header('user-agent'),
  };
}
