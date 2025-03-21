import type { HookEndpointContext } from 'better-auth';

export type Matcher = (context: HookEndpointContext) => boolean;

const phonePaths = new Set([
  '/sign-in/phone-number',
  '/phone-number/forget-password',
  '/phone-number/reset-password',
  '/phone-number/send-otp',
  '/phone-number/verify'
]);

/**
 * Path is one of `['/sign-in/phone-number', '/phone-number/forget-password',
 * '/phone-number/reset-password', '/phone-number/send-otp', '/phone-number/verify']`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const allPhone: Matcher = ({ path }) => phonePaths.has(path);

/**
 * Path is `'/sign-in/phone-number'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const signInPhone: Matcher = ({ path }) => path === '/sign-in/phone-number';

/**
 * Path is `'/phone-number/send-otp'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const phoneOtp: Matcher = ({ path }) => path === '/phone-number/send-otp';

/**
 * Path is `'/phone-number/verify'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const phoneVerify: Matcher = ({ path }) => path === '/phone-number/verify';

/**
 * Path is `'/phone-number/forget-password'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const phoneForget: Matcher = ({ path }) => path === '/phone-number/forget-password';

/**
 * Path is `'/phone-number/reset-password'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const phoneReset: Matcher = ({ path }) => path === '/phone-number/reset-password';
