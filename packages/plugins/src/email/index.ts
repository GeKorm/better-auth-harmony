import { type User } from 'better-auth';
import { APIError } from 'better-auth/api';
import { type BetterAuthPlugin, createAuthMiddleware } from 'better-auth/plugins';
import Mailchecker from 'mailchecker';
import isEmail from 'validator/es/lib/isEmail';
import normalizeEmail from 'validator/es/lib/normalizeEmail';
import { allEmail, allEmailSignIn, type Matcher } from './matchers';

export interface UserWithNormalizedEmail extends User {
  normalizedEmail?: string | null;
}

export interface EmailHarmonyOptions {
  /**
   * Allow logging in with any version of the unnormalized email address. Also works for password
   * reset. For example a user who signed up with the email `johndoe@googlemail.com` may also log
   * in with `john.doe@gmail.com`. Makes 1 extra database query for every login attempt.
   * @default false
   */
  allowNormalizedSignin?: boolean;
  /**
   * Function to validate email. Default is `validateEmail`.
   */
  validator?: (email: string) => boolean | Promise<boolean>;
  /**
   * Function to normalize email address. Default is `validator.normalizeEmail(t)`.
   * @see https://github.com/validatorjs/validator.js#sanitizers
   */
  normalizer?: typeof normalizeEmail;
  /**
   * Specify in which routes the plugin should run, for example by path.
   * @example <caption>Ready-made matchers</caption>
   * import * as matchers from 'better-auth-harmony/email/matchers';
   *
   * export const auth = betterAuth({
   *   // ... other config options
   *   plugins: [
   *     emailHarmony({
   *       matchers: {
   *         signIn: [matchers.emailOtpVerify, matchers.emailOtpForget, matchers.emailOtpReset]
   *       }
   *     })
   *   ]
   * });
   */
  matchers?: {
    /**
     * Specify where the plugin should run to look up users by normalized email address if
     * `allowNormalizedSignin` is true.
     * @default [`allEmailSignIn`]
     */
    signIn?: Matcher[];
    /**
     * Specify which requests the plugin should validate, for example in which routes by path.
     * @default [`allEmail`]
     */
    validation?: Matcher[];
  };
}

interface Context {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

/**
 * The default validation function runs `validator.isEmail(email) && Mailchecker.isValid(email)`.
 * @see https://github.com/validatorjs/validator.js#validators
 * @see https://github.com/FGRibreau/mailchecker
 * @param email The email address to validate
 * @returns Boolean indicating whether the address should be accepted (`true`), or rejected
 *   (`false`).
 */
export const validateEmail = (email: string) => isEmail(email) && Mailchecker.isValid(email);

type GetEmail = (ctx: Context) => { email: unknown; container: 'body' | 'query' };
const getEmail: GetEmail = (ctx) => ({
  email: ctx.body?.email ?? ctx.query?.email,
  container: ctx.body ? 'body' : 'query'
});

const emailHarmony = ({
  allowNormalizedSignin = false,
  validator = validateEmail,
  matchers = {},
  normalizer = normalizeEmail
}: EmailHarmonyOptions = {}) =>
  ({
    id: 'harmony-email',
    init() {
      // eslint-disable-next-line @typescript-eslint/require-await,unicorn/consistent-function-scoping -- better-auth types
      const normalize = async (user: Partial<User> & { phoneNumber?: string }) => {
        const { email, phoneNumber } = user;
        if (!email || phoneNumber) return { data: user as Required<User> };

        const normalizedEmail = normalizer(email);
        /* v8 ignore next */
        if (!normalizedEmail) return false;

        return {
          data: {
            ...(user as Required<User>),
            normalizedEmail
          }
        };
      };

      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                before: normalize
              },
              update: {
                before: normalize
              }
            }
          }
        }
      };
    },
    schema: {
      user: {
        fields: {
          normalizedEmail: {
            type: 'string',
            required: false,
            unique: true,
            input: false,
            returned: false
          }
        }
      }
    },
    hooks: {
      before: [
        {
          matcher: (context) =>
            matchers.validation
              ? matchers.validation.some((matcher) => matcher(context))
              : allEmail(context),
          handler: createAuthMiddleware(async (ctx) => {
            const email: unknown =
              ctx.path === '/change-email' ? ctx.body.newEmail : getEmail(ctx).email;

            if (typeof email !== 'string') return;

            const isValid = await validator(email);
            if (!isValid) throw new APIError('BAD_REQUEST', { message: 'Invalid email' });
          })
        },
        {
          matcher: (context) =>
            allowNormalizedSignin &&
            (matchers.signIn
              ? matchers.signIn.some((matcher) => matcher(context))
              : allEmailSignIn(context)),
          handler: createAuthMiddleware(async (ctx) => {
            const { email, container } = getEmail(ctx);

            if (typeof email !== 'string') return;

            const normalizedEmail = normalizer(email);

            if (normalizedEmail !== email) {
              const user = await ctx.context.adapter.findOne<UserWithNormalizedEmail>({
                model: 'user',
                where: [
                  {
                    field: 'normalizedEmail',
                    value: normalizedEmail
                  }
                ]
              });

              if (!user) return;

              return {
                context: {
                  ...ctx,
                  [container]: {
                    ...ctx[container],
                    email: user.email,
                    normalizedEmail
                  }
                }
              };
            }
          })
        }
      ]
    }
  }) satisfies BetterAuthPlugin;

export default emailHarmony;
