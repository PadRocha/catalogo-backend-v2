import { Document } from 'mongoose';
import { config } from '../config';

type authRole = keyof typeof config.AUTH;

export interface IRoles extends Document {
    roleIncludes(...roles: authRole[]): boolean;
}

const configAuth: { [AUTH: string]: number } = config.AUTH;

export function intoRoles(role?: number): string[] {
    if (!role)
        return new Array<string>();
    return Object.keys(configAuth).filter(auths => !!(role & configAuth[auths]));
}

export function intoRole(roles: authRole[]): number {
    return roles.reduce((accumulator, role) => accumulator |= configAuth[role], 0);
}

export function hasValidRoles(roles?: authRole | authRole[]): boolean {
    if (Array.isArray(roles) && roles.length > 0)
        return roles.every(r => Object.keys(configAuth).includes(r));
    else if (roles instanceof String && typeof roles === 'string' && !!roles.trim())
        return Object.keys(configAuth).includes(roles);
    else
        return false;
}

export function roleIncludes(this: any, ...roles: authRole[]): boolean {
    if (!hasValidRoles(roles))
        return false;

    return roles.some(r => !!(this.role & configAuth[r]));
}