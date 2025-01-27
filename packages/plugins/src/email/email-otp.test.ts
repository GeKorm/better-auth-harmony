/* eslint-disable no-await-in-loop -- copied from better-auth */
import { emailOTPClient } from 'better-auth/client/plugins';
import { bearer } from 'better-auth/plugins';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { afterAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { getTestInstance } from '../../../../better-auth/packages/better-auth/src/test-utils/test-instance';
import emailHarmony, { type UserWithNormalizedEmail } from '.';
import {
  emailOtpCreateVerification,
  emailOtpForget,
  emailOtpGetVerification,
  emailOtpReset,
  emailOtpSendVerification,
  emailOtpVerify,
  emailSignIn,
  emailSignUp
} from './matchers';
// TODO: Normalization check, validation check
interface SQLiteDB {
  close: () => Promise<void>;
}

const matchers = [
  emailSignUp,
  emailSignIn,
  emailOtpVerify,
  emailOtpForget,
  emailOtpReset,
  emailOtpCreateVerification,
  emailOtpGetVerification,
  emailOtpSendVerification
];

describe('email-otp', async () => {
  const otpFn = vi.fn();
  let otp = '';
  const { client, auth, db } = await getTestInstance(
    {
      plugins: [
        bearer(),
        emailOTP({
          // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
          async sendVerificationOTP({ email, otp: _otp, type }) {
            otp = _otp;
            otpFn(email, _otp, type);
          },
          sendVerificationOnSignUp: true
        }),
        emailHarmony({ allowNormalizedSignin: true })
      ],
      emailVerification: {
        autoSignInAfterVerification: true
      }
    },
    {
      disableTestUser: true,
      clientOptions: {
        plugins: [emailOTPClient()]
      }
    }
  );

  const { data: testData } = await client.signUp.email({
    email: 'example+aa@gmail.com',
    password: 'test-password',
    name: 'test-name'
  });

  const testUser = testData?.user;
  if (!testUser) throw new Error('User not found');

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('should verify email with otp', async () => {
    const res = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    expect(res.data?.success).toBe(true);
    expect(otp.length).toBe(6);
    expect(otpFn).toHaveBeenCalledWith(testUser.email, otp, 'email-verification');
    const verifiedUser = await client.emailOtp.verifyEmail({
      email: testUser.email,
      otp
    });
    expect(verifiedUser.data?.status).toBe(true);
  });

  it('should reject disposable email', async () => {
    const res = await client.emailOtp.sendVerificationOtp({
      email: 'example@mailinator.com',
      type: 'email-verification'
    });
    expect(res.error).toBeDefined();
  });

  it('should sign in with otp', async () => {
    const res = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'sign-in'
    });
    expect(res.data?.success).toBe(true);
    expect(otp.length).toBe(6);
    expect(otpFn).toHaveBeenCalledWith(testUser.email, otp, 'sign-in');
    const verifiedUser = await client.signIn.emailOtp(
      {
        email: testUser.email,
        otp
      },
      {
        onSuccess: (ctx) => {
          const header = ctx.response.headers.get('set-cookie');
          expect(header).toContain('better-auth.session_token');
        }
      }
    );

    expect(verifiedUser.data?.token).toBeDefined();
  });

  it('should sign up with otp', async () => {
    const testUser2 = {
      email: 'test-email@googlemail.com'
    };
    await client.emailOtp.sendVerificationOtp({
      email: testUser2.email,
      type: 'sign-in'
    });
    const newUser = await client.signIn.emailOtp(
      {
        email: testUser2.email,
        otp
      },
      {
        onSuccess: (ctx) => {
          const header = ctx.response.headers.get('set-cookie');
          expect(header).toContain('better-auth.session_token');
        }
      }
    );
    const dbUser = await db.findOne<UserWithNormalizedEmail>({
      model: 'user',
      where: [
        {
          field: 'normalizedEmail',
          value: 'test-email@gmail.com'
        }
      ]
    });
    expect(newUser.data?.token).toBeDefined();
    expect(dbUser?.email).toBe(testUser2.email);
  });

  it('should send verification otp on sign-up', async () => {
    const testUser2 = {
      email: 'test8@email.com',
      password: 'password',
      name: 'test'
    };
    await client.signUp.email(testUser2);
    expect(otpFn).toHaveBeenCalledWith(testUser2.email, otp, 'email-verification');
  });

  it('should send forget password otp', async () => {
    const res = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'forget-password'
    });

    expect(res.data).toBeTruthy();
  });

  it('should reset password', async () => {
    await client.emailOtp.resetPassword({
      email: testUser.email,
      otp,
      password: 'changed-password'
    });
    const { data } = await client.signIn.email({
      email: testUser.email,
      password: 'changed-password'
    });
    expect(data?.user).toBeDefined();
  });

  it('should reset password and create credential account', async () => {
    const testUser2 = {
      email: 'test-email@domain.com'
    };
    await client.emailOtp.sendVerificationOtp({
      email: testUser2.email,
      type: 'sign-in'
    });
    await client.signIn.emailOtp(
      {
        email: testUser2.email,
        otp
      },
      {
        onSuccess: (ctx) => {
          const header = ctx.response.headers.get('set-cookie');
          expect(header).toContain('better-auth.session_token');
        }
      }
    );
    await client.emailOtp.sendVerificationOtp({
      email: testUser2.email,
      type: 'forget-password'
    });
    await client.emailOtp.resetPassword({
      email: testUser2.email,
      otp,
      password: 'password'
    });
    const res = await client.signIn.email({
      email: testUser2.email,
      password: 'password'
    });
    expect(res.data?.token).toBeDefined();
  });

  it('should fail on invalid email', async () => {
    const res = await client.emailOtp.sendVerificationOtp({
      email: 'invalid-email',
      type: 'email-verification'
    });
    // expect(res.error?.status).toBe(400);
    // expect(res.error?.code).toBe('INVALID_EMAIL');
    expect(res.error).toBeTruthy();
  });

  it('should fail on expired otp', async () => {
    await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(1000 * 60 * 5);
    const res = await client.emailOtp.verifyEmail({
      email: testUser.email,
      otp
    });
    // expect(res.error?.status).toBe(400);
    // expect(res.error?.code).toBe('OTP_EXPIRED');
    expect(res.error).toBeTruthy();
  });

  it('should not fail on time elapsed', async () => {
    await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(1000 * 60 * 4);
    const res = await client.emailOtp.verifyEmail({
      email: testUser.email,
      otp
    });
    const session = await client.getSession({
      fetchOptions: {
        headers: {
          Authorization: `Bearer ${res.data?.token ?? ''}`
        }
      }
    });
    expect(res.data?.status).toBe(true);
    expect(session.data?.user.emailVerified).toBe(true);
  });

  it('should create verification otp on server', async () => {
    otp = await auth.api.createVerificationOTP({
      body: {
        type: 'sign-in',
        email: 'test@email.com'
      }
    });
    expect(otp.length).toBe(6);
  });

  it('should reject verification otp creation for disposable address', async () => {
    await expect(() =>
      auth.api.createVerificationOTP({
        body: {
          type: 'sign-in',
          email: 'test@mailinator.com'
        }
      })
    ).rejects.toThrowError('Invalid email');
  });

  it('should get verification otp on server', async () => {
    const res = await auth.api.getVerificationOTP({
      query: {
        email: 'test@email.com',
        type: 'sign-in'
      }
    });

    expect(res.otp).toBeDefined();
  });

  it('should work with custom options', async () => {
    const { client: customClient } = await getTestInstance(
      {
        plugins: [
          emailHarmony({ allowNormalizedSignin: true }),
          bearer(),
          emailOTP({
            // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
            async sendVerificationOTP({ email, otp: _otp, type }) {
              otp = _otp;
              otpFn(email, _otp, type);
            },
            sendVerificationOnSignUp: true,
            expiresIn: 10,
            otpLength: 8
          })
        ],
        emailVerification: {
          autoSignInAfterVerification: true
        }
      },
      {
        disableTestUser: true,
        clientOptions: {
          plugins: [emailOTPClient()]
        }
      }
    );
    await customClient.emailOtp.sendVerificationOtp({
      type: 'email-verification',
      email: testUser.email
    });
    expect(otp.length).toBe(8);
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(11 * 1000);
    const verifyRes = await customClient.emailOtp.verifyEmail({
      email: testUser.email,
      otp
    });
    // expect(verifyRes.error?.code).toBe('OTP_EXPIRED');
    const dbUser = await db.findOne<UserWithNormalizedEmail>({
      model: 'user',
      where: [
        {
          field: 'normalizedEmail',
          value: 'example@gmail.com'
        }
      ]
    });
    expect(dbUser?.email).toBe(testUser.email);
    expect(verifyRes.error).toBeTruthy();
  });
}, 15_000);

describe('email-otp-verify with custom matchers', async () => {
  const otpFn = vi.fn();
  const otp = [''];
  const { client, auth } = await getTestInstance(
    {
      plugins: [
        emailHarmony({
          allowNormalizedSignin: true,
          matchers: {
            validation: matchers,
            signIn: matchers.slice(1)
          }
        }),
        emailOTP({
          // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
          async sendVerificationOTP({ email, otp: _otp, type }) {
            otp.push(_otp);
            otpFn(email, _otp, type);
          },
          sendVerificationOnSignUp: true,
          disableSignUp: true
        })
      ]
    },
    {
      disableTestUser: true,
      clientOptions: {
        plugins: [emailOTPClient()]
      }
    }
  );

  const { data: testData } = await client.signUp.email({
    email: 'example@gmail.com',
    password: 'test-password',
    name: 'test-name'
  });

  const testUser = testData?.user;
  if (!testUser) throw new Error('User not found');

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('should not create verification otp when disableSignUp and user not registered', async () => {
    for (const param of [
      {
        email: 'test-email@gmail.com',
        isNull: true
      },
      {
        email: testUser.email,
        isNull: false
      }
    ]) {
      await client.emailOtp.sendVerificationOtp({
        email: param.email,
        type: 'email-verification'
      });
      const res = await auth.api.getVerificationOTP({
        query: {
          email: param.email,
          type: 'email-verification'
        }
      });
      if (param.isNull) {
        expect(res.otp).toBeNull();
      } else {
        expect(res.otp).not.toBeNull();
      }
    }
  });

  it('should not send verification otp when address is disposable', async () => {
    const param = {
      email: 'example@mailinator.com'
    };
    const { error } = await client.emailOtp.sendVerificationOtp({
      email: param.email,
      type: 'email-verification'
    });
    expect(error).toBeDefined();
  });

  it('should verify email with last otp', async () => {
    const res1 = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    const res2 = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    const res3 = await client.emailOtp.sendVerificationOtp({
      email: testUser.email,
      type: 'email-verification'
    });
    expect(res1.data).toBeTruthy();
    expect(res2.data).toBeTruthy();
    expect(res3.data).toBeTruthy();
  });
}, 15_000);

describe('custom rate limiting storage', async () => {
  const { client, auth } = await getTestInstance(
    {
      rateLimit: {
        enabled: true
      },
      plugins: [
        emailHarmony({ allowNormalizedSignin: true }),
        emailOTP({
          async sendVerificationOTP() {}
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

  it.each([
    {
      path: '/email-otp/send-verification-otp',
      body: {
        email: 'test@email.com',
        type: 'sign-in'
      }
    },
    {
      path: '/sign-in/email-otp',
      body: {
        email: 'test@email.com',
        otp: '12312'
      }
    },
    {
      path: '/email-otp/verify-email',
      body: {
        email: 'test@email.com',
        otp: '12312'
      }
    }
  ])('should rate limit send verification endpoint', async ({ path, body }) => {
    for (let i = 0; i < 10; i++) {
      const response = await client.$fetch(path, {
        method: 'POST',
        body
      });
      if (i >= 3) {
        expect(response.error?.status).toBe(429);
      }
    }
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    const response = await client.$fetch(path, {
      method: 'POST',
      body
    });
    expect(response.error?.status).not.toBe(429);
  });
}, 15_000);
