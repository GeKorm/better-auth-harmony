/* eslint-disable n/no-unsupported-features/node-builtins -- tests run on Node 22+ */
import { createAuthClient } from 'better-auth/client';
import { phoneNumberClient } from 'better-auth/client/plugins';
import { phoneNumber } from 'better-auth/plugins';
import { parsePhoneNumberWithError } from 'libphonenumber-js/max';
import { afterAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { getTestInstance } from '../../../../better-auth/packages/better-auth/src/test-utils/test-instance';
import emailHarmony from '../email';
import phoneHarmony from '.';
import { allPhone, phoneOtp, phoneVerify, signInPhone } from './matchers';

// Tests largely copied from
// https://github.com/better-auth/better-auth/blob/9b00f1e169349b845b8bdafcc4c8359eb7e397fa/packages/better-auth/src/plugins/phone-number/phone-number.test.ts

interface SQLiteDB {
  close: () => Promise<void>;
}

describe('phone-number', async () => {
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
        phoneHarmony({ matchers: [signInPhone, phoneOtp, phoneVerify] })
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

  it('should return error on missing country', async () => {
    const { error } = await client.phoneNumber.sendOtp({
      phoneNumber: '55555555555'
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
    const newPhoneNumber = '+1 (555) 123-1111';
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
    expect(user.data?.user.phoneNumber).toBe('+15551231111');
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

describe('phone auth flow', async () => {
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
        phoneHarmony({ acceptRawInputOnError: true, matchers: [allPhone] })
      ],
      user: {
        changeEmail: {
          enabled: true
        }
      }
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

  it('should fall back to raw input on unparseable number', async () => {
    const { error } = await client.phoneNumber.sendOtp({
      phoneNumber: '123'
    });
    expect(error).toBeNull();
    expect(otp).toHaveLength(6);
  });

  it('should send otp', async () => {
    const res = await client.phoneNumber.sendOtp({
      phoneNumber: '+1 (555) 123-1234'
    });
    expect(res.error).toBeNull();
    expect(otp).toHaveLength(6);
  });

  it('should verify phone number and create user & session', async () => {
    const res = await client.phoneNumber.verify({
      phoneNumber: '+1 (555) 123-1234',
      code: otp
    });

    const session = await client.getSession({
      fetchOptions: {
        headers: {
          Authorization: `Bearer ${res.data?.token ?? ''}`
        },
        throw: true
      }
    });
    expect(session.user.phoneNumberVerified).toBe(true);
    expect(session.user.email).toBe('temp-+15551231234');
    expect(session.session.token).toBeDefined();
  });

  const headers = new Headers();
  it('should go through send-verify and sign-in the user', async () => {
    await client.phoneNumber.sendOtp({
      phoneNumber: '+1 (555) 123-1234'
    });
    const res = await client.phoneNumber.verify(
      {
        phoneNumber: '+1 (555) 123-1234',
        code: otp
      },
      {
        onSuccess: sessionSetter(headers)
      }
    );
    expect(res.data?.status).toBeDefined();
  });

  const newEmail = 'new-email@email.com';
  it('should set password and update user', async () => {
    await auth.api.setPassword({
      body: {
        newPassword: 'password'
      },
      headers
    });
    const changedEmailRes = await client.changeEmail({
      newEmail,
      fetchOptions: {
        headers
      }
    });
    expect(changedEmailRes.error).toBeNull();
    expect(changedEmailRes.data?.status).toBe(true);
  });

  it('should sign in with phone number and password', async () => {
    const res = await client.signIn.phoneNumber({
      phoneNumber: '+1 (555) 123-1234',
      password: 'password'
    });
    expect(res.data?.token).toBeDefined();
  });

  it('should sign in with new email', async () => {
    const res = await client.signIn.email({
      email: newEmail,
      password: 'password'
    });
    expect(res.error).toBeNull();
  });
}, 15_000);

describe('verify phone-number', async () => {
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
        phoneHarmony({
          normalizer: (phone) => {
            if (phone === '5') throw new Error('Test'); // to test non-ParseError errors
            return parsePhoneNumberWithError(phone).number;
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

  const client = createAuthClient({
    baseURL: 'http://localhost:3000',
    plugins: [phoneNumberClient()],
    fetchOptions: {
      customFetchImpl
    }
  });

  const headers = new Headers();

  const testPhoneNumber = '+1 (555) 123-1234';

  it('should return error on missing country', async () => {
    const { error } = await client.phoneNumber.sendOtp({
      phoneNumber: '5'
    });
    expect(error?.status).toBe(500);
    expect(otp).toBe('');
  });

  it('should verify the last code', async () => {
    await client.phoneNumber.sendOtp({
      phoneNumber: testPhoneNumber
    });
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);
    await client.phoneNumber.sendOtp({
      phoneNumber: testPhoneNumber
    });
    vi.advanceTimersByTime(1000);
    await client.phoneNumber.sendOtp({
      phoneNumber: testPhoneNumber
    });
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
}, 15_000);

describe('combined with email harmony', () => {
  describe('phone-number', async () => {
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
          emailHarmony(),
          phoneHarmony()
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

    it('should return error on missing country', async () => {
      const { error } = await client.phoneNumber.sendOtp({
        phoneNumber: '55555555555'
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
      const newPhoneNumber = '+1 (555) 123-1111';
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
      expect(user.data?.user.phoneNumber).toBe('+15551231111');
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
});
