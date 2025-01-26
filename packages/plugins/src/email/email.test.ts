/* eslint-disable n/no-unsupported-features/node-builtins -- allow in tests */
import { createAuthClient } from 'better-auth/client';
import { phoneNumberClient } from 'better-auth/client/plugins';
import { phoneNumber } from 'better-auth/plugins';
import { afterAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { getTestInstance } from '../../../../better-auth/packages/better-auth/src/test-utils/test-instance';
import emailHarmony, { type UserWithNormalizedEmail } from '.';
import {
  allEmail,
  allEmailSignIn,
  changeEmail,
  emailForget,
  emailSendVerification
} from './matchers';

interface SQLiteDB {
  close: () => Promise<void>;
}

describe('email harmony', async () => {
  const mockSendEmail = vi.fn();
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
            signIn: [emailForget, allEmailSignIn],
            validation: [emailForget, allEmail]
          }
        })
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
      const user = await db.findOne<UserWithNormalizedEmail>({
        model: 'user',
        where: [
          {
            field: 'normalizedEmail',
            value: 'newemail@gmail.com'
          }
        ]
      });
      expect(user?.email).toBe(rawEmail);
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

  describe('login', () => {
    it('should work with normalized email form', async () => {
      const email = 'email@gmail.com';
      await client.signUp.email({
        email,
        password: 'new-password',
        name: 'new-name'
      });
      const { data } = await client.signIn.email({
        email: 'e.mail@gmail.com',
        password: 'new-password'
      });
      expect(data?.user.email).toBe(email);
    }, 15_000);

    it('should return error on incorrect email type', async () => {
      const { data, error } = await client.signIn.email({
        // @ts-expect-error -- extra safety test
        email: 22,
        password: 'new-password'
      });
      expect(data?.user.email).toBe(undefined);
      expect(error).not.toBeNull();
    });

    it('should return unauthorized error on incorrect credentials', async () => {
      const { error } = await client.signIn.email({
        email: 'test@example.com',
        password: 'new-password'
      });
      expect(error?.status).toBe(401);
    });
  });

  describe('reset password', () => {
    it('should send a reset password email to the normalized address form', async () => {
      const email = 'email@gmail.com';
      await client.signUp.email({
        email,
        password: 'new-password',
        name: 'new-name'
      });
      await client.forgetPassword({
        email: 'e.mail@googlemail.com'
      });
      expect(token.length).toBeGreaterThan(10);
    }, 15_000);
  });
});

describe('Email Verification', async () => {
  const mockSendEmail = vi.fn();
  let token: string;

  const { auth, client } = await getTestInstance(
    {
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true
      },
      emailVerification: {
        // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
        async sendVerificationEmail({ user, url, token: _token }) {
          token = _token;
          mockSendEmail(user.email, url);
        }
      },
      plugins: [
        emailHarmony({
          allowNormalizedSignin: true,
          matchers: {
            signIn: [emailSendVerification, allEmailSignIn],
            validation: [emailSendVerification, allEmail]
          }
        })
      ]
    },
    {
      disableTestUser: true
    }
  );

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('should send a verification email to a normalized address form', async () => {
    const email = 'email@gmail.com';
    await client.signUp.email({
      email,
      password: 'new-password',
      name: 'new-name'
    });
    await auth.api.sendVerificationEmail({
      body: {
        email: 'e.mail+example@gmail.com'
      }
    });
    expect(mockSendEmail).toHaveBeenCalledWith(email, expect.any(String));
  });

  it('should verify email', async () => {
    const res = await client.verifyEmail({
      query: {
        token
      }
    });
    expect(res.data?.status).toBe(true);
  });
});

describe('email harmony with email change', async () => {
  const sendChangeEmail = vi.fn();
  // eslint-disable-next-line no-underscore-dangle -- unused var
  let _emailVerificationToken = '';

  const { client, sessionSetter, db, auth } = await getTestInstance(
    {
      plugins: [
        emailHarmony({
          allowNormalizedSignin: true,
          matchers: {
            validation: [changeEmail, allEmail],
            signIn: [changeEmail, allEmailSignIn]
          }
        })
      ],
      emailVerification: {
        // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
        async sendVerificationEmail({ token }) {
          _emailVerificationToken = token;
        }
      },
      user: {
        changeEmail: {
          enabled: true,
          // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
          sendChangeEmailVerification: async ({ user, newEmail, url, token }) => {
            sendChangeEmail(user, newEmail, url, token);
          }
        }
      }
    },
    {
      disableTestUser: true
    }
  );

  const headers = new Headers();

  const rawEmail = 'new.email+test@googlemail.com';
  const password = 'new-password';
  await client.signUp.email({
    email: rawEmail,
    password,
    name: 'new-name'
  });
  await client.signUp.email({
    email: 'some.user+test@googlemail.com',
    password,
    name: 'new-name'
  });

  const session = await client.signIn.email({
    email: rawEmail,
    password,
    fetchOptions: {
      onSuccess: sessionSetter(headers),
      onRequest(context) {
        return context;
      }
    }
  });

  if (!session.data?.user.id) {
    throw new Error('No session');
  }

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('normalizes new address', async () => {
    const newEmailRaw = 'changed.email+test2@googlemail.com';
    await client.changeEmail({
      newEmail: newEmailRaw,
      fetchOptions: {
        headers
      }
    });
    const { user } = await client.getSession({
      fetchOptions: {
        headers,
        throw: true
      }
    });

    const dbUser = await db.findOne<UserWithNormalizedEmail>({
      model: 'user',
      where: [
        {
          field: 'normalizedEmail',
          value: 'changedemail@gmail.com'
        }
      ]
    });

    expect(user.email).toBe(newEmailRaw);
    expect(dbUser?.email).toBe(newEmailRaw);
  });

  it('should reject temporary emails', async () => {
    const newEmailRaw = 'email@mailinator.com';
    const { error } = await client.changeEmail({
      newEmail: newEmailRaw,
      fetchOptions: {
        headers
      }
    });
    expect(error).not.toBeNull();
  });

  it('should prevent changing into email variations of existing addresses', async () => {
    // Attempt to duplicate email
    const { error } = await client.changeEmail({
      newEmail: 'so.me.use.r+test2@googlemail.com',
      fetchOptions: {
        headers
      }
    });

    // const dbUser = await db.findOne<UserWithNormalizedEmail>({
    //   model: 'user',
    //   where: [
    //     {
    //       field: 'normalizedEmail',
    //       value: 'changedemail@gmail.com'
    //     }
    //   ]
    // });

    expect(error).not.toBeNull();
  });
});

describe('combined with phone number plugin', async () => {
  let otp = '';

  const { customFetchImpl, sessionSetter, auth } = await getTestInstance(
    {
      plugins: [
        phoneNumber({
          sendOTP({ code }) {
            otp = code;
          },
          signUpOnVerification: {
            getTempEmail(digits) {
              return `temp-${digits}`;
            }
          }
        }),
        emailHarmony({ allowNormalizedSignin: true })
      ]
    },
    {
      disableTestUser: true
    }
  );

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  const client = createAuthClient({
    baseURL: 'http://localhost:3000',
    plugins: [phoneNumberClient()],
    fetchOptions: {
      customFetchImpl
    }
  });

  const headers = new Headers();

  const testPhoneNumber = '+1 (555) 123-1234';
  it('should return error on incorrect phone number type', async () => {
    const { error } = await client.phoneNumber.sendOtp({
      // @ts-expect-error -- extra safety test
      phoneNumber: 22
    });
    expect(error?.status).toBe(500);
    expect(otp).toBe('');
  });

  it('should send verification code', async () => {
    const res = await client.phoneNumber.sendOtp({
      phoneNumber: testPhoneNumber
    });
    expect(res.error).toBeNull();
    expect(otp).toHaveLength(6);
  });

  it('should verify phone number', async () => {
    const res = await client.phoneNumber.verify(
      {
        phoneNumber: testPhoneNumber,
        code: otp
      },
      {
        onSuccess: sessionSetter(headers)
      }
    );
    expect(res.error).toBeNull();
    expect(res.data?.status).toBe(true);
  });

  it("shouldn't verify again with the same code", async () => {
    const res = await client.phoneNumber.verify({
      phoneNumber: testPhoneNumber,
      code: otp
    });
    expect(res.error?.status).toBe(500);
  });

  it('should update phone number', async () => {
    const newPhoneNumber = '+0123456789';
    await client.phoneNumber.sendOtp({
      phoneNumber: newPhoneNumber,
      fetchOptions: {
        headers
      }
    });
    await client.phoneNumber.verify({
      phoneNumber: newPhoneNumber,
      updatePhoneNumber: true,
      code: otp,
      fetchOptions: {
        headers
      }
    });
    const user = await client.getSession({
      fetchOptions: {
        headers
      }
    });
    expect(user.data?.user.phoneNumber).toBe(newPhoneNumber);
    expect(user.data?.user.phoneNumberVerified).toBe(true);
  });

  it('should not verify if code expired', async () => {
    vi.useFakeTimers();
    await client.phoneNumber.sendOtp({
      phoneNumber: '+25120201212'
    });
    vi.advanceTimersByTime(1000 * 60 * 5 + 1); // 5 minutes + 1ms
    const res = await client.phoneNumber.verify({
      phoneNumber: '+25120201212',
      code: otp
    });
    expect(res.error?.status).toBe(500);
  });
}, 15_000);
