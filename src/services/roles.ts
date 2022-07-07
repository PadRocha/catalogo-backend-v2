import { Document } from 'mongoose';
import { config } from '../config';

type authRole = keyof typeof config.AUTH;

export interface IRoles extends Document {
    /**
     * Retorna `true` si los roles incluidos existen
     * @param ...roles string[]
     * @returns boolean
     * @example
     * ```js
     * User.roleIncludes('WRITE');
     * User.roleIncludes('WRITE', 'READ');
     * ```
     */
    roleIncludes(...roles: authRole[]): boolean;
}

const configAuth: { [AUTH: string]: number } = config.AUTH;

/**
 * Convierte el valor de bits en un arreglo de los permisos activos
 * @param role number
 * @returns string[]
 * @example
 * ```js
 * intoRoles(2);
 * ```
 */
export function intoRoles(role?: number): string[] {
    if (!role)
        return new Array<string>();
    return Object.keys(configAuth).filter(auths => !!(role & configAuth[auths]));
}

/**
 * Convierte el arreglo de permisos activos en un valor de bits
 * @param roles string[]
 * @returns number
 * @example
 * ```js
 * intoRole(['WRITE', 'READ']);
 * ```
 */
export function intoRole(roles: authRole[]): number {
    return roles.reduce((accumulator, role) => accumulator |= configAuth[role], 0);
}

/**
 * Lee un string o arreglo de strings y verifica si todos existen como permisos
 * @param roles string | string[]
 * @returns boolean
 * @example
 * ```js
 * intoRole('WRITE');
 * intoRole(['WRITE', 'READ']);
 * ```
 */
export function hasValidRoles(roles?: authRole | authRole[]): boolean {
    if (Array.isArray(roles) && roles.length > 0)
        return roles.every(r => Object.keys(configAuth).includes(r));
    else if (roles instanceof String && typeof roles === 'string' && !!roles.trim())
        return Object.keys(configAuth).includes(roles);
    else
        return false;
}

/**
 * Analiza si los string ingresados son permisos activos
 * @param ...roles string[]
 * @returns boolean
 * @example
 * ```js
 * intoRole('WRITE');
 * intoRole('WRITE', 'READ');
 * ```
 */
export function roleIncludes(this: any, ...roles: authRole[]): boolean {
    if (!hasValidRoles(roles))
        return false;

    return roles.some(r => !!(this.role & configAuth[r]));
}