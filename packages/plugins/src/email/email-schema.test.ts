import { afterAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { getTestInstance } from '../../../../better-auth/packages/better-auth/src/test-utils/test-instance';
import emailHarmony, { type UserWithNormalizedEmail } from '.';
import { allEmail, allEmailSignIn, emailForget, emailSignUp } from './matchers';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import type { BetterAuthPlugin } from '../../../../better-auth/packages/better-auth/src/types';

interface SQLiteDB {
  close: () => Promise<void>;
}

describe('Mapped schema', async () => {
  const mockSendEmail = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- false positive
  let token = '';

  const { client, db, auth } = await getTestInstance(
    {
      emailAndPassword: {
        enabled: true,
        async sendResetPassword({ url }) {
          token = url.split('?')[0]?.split('/').pop() ?? '';
          await mockSendEmail();
        }
      },
      plugins: [
        emailHarmony({
          allowNormalizedSignin: true,
          matchers: {
            signIn: [emailForget, allEmailSignIn, emailSignUp],
            validation: [emailForget, allEmail]
          },
          schema: {
            user: {
              fields: {
                normalizedEmail: 'normalized_email'
              }
            }
          }
        }) as BetterAuthPlugin
      ]
    },
    {
      disableTestUser: true
    }
  );

  afterAll(async () => {
    // TODO: Open PR for better-auth/src/test-utils/test-instance
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  describe('signup', () => {
    it('should normalize email', async () => {
      const rawEmail = 'new.email+test@googlemail.com';
      await client.signUp.email({
        email: rawEmail,
        password: 'new-password',
        name: 'new-name'
      });
      const userYes = await db.findOne<UserWithNormalizedEmail>({
        model: 'user',
        where: [
          {
            field: 'email',
            value: rawEmail
          }
        ]
      });
      // expect(userNo?.email).toBeUndefined();
      expect(userYes?.email).toBe(rawEmail);
    });

    it('should reject temporary emails', async () => {
      const rawEmail = 'email@mailinator.com';
      const { error } = await client.signUp.email({
        email: rawEmail,
        password: 'new-password',
        name: 'new-name'
      });
      expect(error).not.toBeNull();
    });

    it('should prevent signups with email variations', async () => {
      const rawEmail = 'test.mail+test1@googlemail.com';
      await client.signUp.email({
        email: rawEmail,
        password: 'new-password',
        name: 'new-name'
      });
      const user = await db.findOne<UserWithNormalizedEmail>({
        model: 'user',
        where: [
          {
            field: 'normalizedEmail',
            value: 'testmail@gmail.com'
          }
        ]
      });
      expect(user?.email).toBe(rawEmail);

      // Duplicate signup attempt
      const { error } = await client.signUp.email({
        email: 'testmail+test2@googlemail.com',
        password: 'new-password',
        name: 'new-name'
      });

      expect(error?.status).toBe(422);
    });
  });
});
