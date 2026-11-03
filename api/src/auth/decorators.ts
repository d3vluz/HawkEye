import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';

export interface SessionMember {
  id: string;
  name: string;
  matricula: string | null;
  email: string | null;
  githubUsername: string | null;
  role: MemberRole;
  mustChangePassword: boolean;
}

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);

export const CurrentMember = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionMember => ctx.switchToHttp().getRequest().member,
);
