import type { HookEndpointContext } from 'better-auth';

export type Matcher = (context: HookEndpointContext) => boolean;

const paths = [
  '/sign-up/email',
  '/email-otp/verify-email',
  '/sign-in/email-otp',
  '/sign-in/magic-link',
  '/sign-in/email',
  '/forget-password/email-otp',
  '/email-otp/reset-password',
  '/email-otp/create-verification-otp',
  '/email-otp/get-verification-otp',
  '/email-otp/send-verification-otp',
  '/forget-password',
  '/send-verification-email',
  '/change-email'
];

const all = new Set(paths);
const signIn = new Set(paths.slice(1, 12));

/**
 * Path is one of `[
 *   '/sign-up/email',
 *   '/email-otp/verify-email',
 *   '/sign-in/email-otp',
 *   '/sign-in/magic-link',
 *   '/sign-in/email',
 *   '/forget-password/email-otp',
 *   '/email-otp/reset-password',
 *   '/email-otp/create-verification-otp',
 *   '/email-otp/get-verification-otp',
 *   '/email-otp/send-verification-otp',
 *   '/forget-password',
 *   '/send-verification-email',
 *   '/change-email'
 * ]`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const allEmail: Matcher = ({ path }) => all.has(path);

/**
 * Path is one of `[
 *   '/email-otp/verify-email',
 *   '/sign-in/email-otp',
 *   '/sign-in/magic-link',
 *   '/sign-in/email',
 *   '/forget-password/email-otp',
 *   '/email-otp/reset-password',
 *   '/email-otp/create-verification-otp',
 *   '/email-otp/get-verification-otp',
 *   '/email-otp/send-verification-otp',
 *   '/forget-password',
 *   '/send-verification-email'
 * ]`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const allEmailSignIn: Matcher = ({ path }) => signIn.has(path);

/**
 * Path is `'/sign-up/email'`.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailSignUp: Matcher = ({ path }) => path === '/sign-up/email';

/**
 * Path is `'/sign-in/email'`, used to log the user in.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailSignIn: Matcher = ({ path }) => path === '/sign-in/email';

/**
 * Path is `'/forget-password'`, used in the forgot password flow..
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailForget: Matcher = ({ path }) => path === '/forget-password';

/**
 * Path is `'/send-verification-email'`, used to log the user in.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailSendVerification: Matcher = ({ path }) => path === '/send-verification-email';

/**
 * Path is `'/change-email'`, used to update the user's email address.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const changeEmail: Matcher = ({ path }) => path === '/change-email';

/**
 * Path is `'/email-otp/verify-email'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpVerify: Matcher = ({ path }) => path === '/email-otp/verify-email';

/**
 * Path is `'/forget-password/email-otp'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpForget: Matcher = ({ path }) => path === '/forget-password/email-otp';

/**
 * Path is `'/email-otp/reset-password'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpReset: Matcher = ({ path }) => path === '/email-otp/reset-password';

/**
 * Path is `'/email-otp/create-verification-otp'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpCreateVerification: Matcher = ({ path }) =>
  path === '/email-otp/create-verification-otp';

/**
 * Path is `'/email-otp/get-verification-otp'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpGetVerification: Matcher = ({ path }) =>
  path === '/email-otp/get-verification-otp';

/**
 * Path is `'/email-otp/send-verification-otp'`, used by the [Email
 * OTP](https://www.better-auth.com/docs/plugins/email-otp) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const emailOtpSendVerification: Matcher = ({ path }) =>
  path === '/email-otp/send-verification-otp';

/**
 * Path is `'/sign-in/magic-link'`, used by the [Magic
 * link](https://www.better-auth.com/docs/plugins/magic-link) plugin.
 * @param context Request context
 * @param context.path Request path
 * @returns boolean
 */
export const magicLinkSignIn: Matcher = ({ path }) => path === '/sign-in/magic-link';
