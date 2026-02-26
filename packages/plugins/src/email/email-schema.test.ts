import { getTestInstance } from 'better-auth/test';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { BetterAuthPlugin } from 'better-auth/types';
import emailHarmony, { type UserWithNormalizedEmail } from '.';
import { allEmail, allEmailSignIn, emailForget, emailSignUp } from './matchers';

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
    if ('database' in auth.options) {
      await (auth.options.database as SQLiteDB).close();
    }
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
