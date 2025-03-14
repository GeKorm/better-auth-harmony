/* eslint-disable n/no-unsupported-features/node-builtins -- allow in tests */
import { afterAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { createAuthClient } from '../../../../better-auth/packages/better-auth/src/client';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { magicLinkClient } from '../../../../better-auth/packages/better-auth/src/client/plugins';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { magicLink } from '../../../../better-auth/packages/better-auth/src/plugins/magic-link';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import { getTestInstance } from '../../../../better-auth/packages/better-auth/src/test-utils/test-instance';
import emailHarmony, { type UserWithNormalizedEmail } from '.';
import { emailSignIn, emailSignUp, magicLinkSignIn } from './matchers';
// eslint-disable-next-line import/no-relative-packages -- couldn't find a better way to include it
import type { BetterAuthPlugin } from '../../../../better-auth/packages/better-auth/src/types';

interface VerificationEmail {
  email: string;
  token: string;
  url: string;
}

interface SQLiteDB {
  close: () => Promise<void>;
}

const matchers = [emailSignUp, emailSignIn, magicLinkSignIn];

describe('magic link harmony', async () => {
  let verificationEmail: VerificationEmail = {
    email: '',
    token: '',
    url: ''
  };
  const { customFetchImpl, sessionSetter, auth, db } = await getTestInstance(
    {
      plugins: [
        emailHarmony({
          allowNormalizedSignin: true,
          matchers: {
            validation: matchers,
            signIn: matchers.slice(1)
          }
        }) as BetterAuthPlugin,
        magicLink({
          // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
          async sendMagicLink(data) {
            verificationEmail = data;
          }
        })
      ]
    },
    {
      disableTestUser: true
    }
  );

  const testUser = {
    email: 'example+test@googlemail.com',
    password: 'password'
  };

  const client = createAuthClient({
    plugins: [magicLinkClient()],
    fetchOptions: {
      customFetchImpl
    },
    baseURL: 'http://localhost:3000/api/auth'
  });

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('should reject temporary emails', async () => {
    const { error } = await client.signIn.magicLink({
      email: 'example@mailinator.com'
    });
    expect(error).toBeDefined();
  });

  it('should send magic link', async () => {
    await client.signIn.magicLink({
      email: testUser.email
    });
    expect(verificationEmail).toMatchObject({
      email: testUser.email,
      url: expect.stringContaining('http://localhost:3000/api/auth/magic-link/verify') as string
    });
  });

  it('should verify magic link', async () => {
    const headers = new Headers();
    const response = await client.magicLink.verify({
      query: {
        token: new URL(verificationEmail.url).searchParams.get('token') ?? ''
      },
      fetchOptions: {
        onSuccess: sessionSetter(headers)
      }
    });
    expect(response.data?.token).toBeDefined();
    const betterAuthCookie = headers.get('set-cookie');
    expect(betterAuthCookie).toBeDefined();
  });

  it("shouldn't verify magic link with the same token", async () => {
    await client.magicLink.verify(
      {
        query: {
          token: new URL(verificationEmail.url).searchParams.get('token') ?? ''
        }
      },
      {
        onError(context) {
          expect(context.response.status).toBe(302);
          const location = context.response.headers.get('location');
          expect(location).toContain('?error=INVALID_TOKEN');
        }
      }
    );
  });

  it("shouldn't verify magic link with an expired token", async () => {
    await client.signIn.magicLink({
      email: testUser.email
    });
    const token = verificationEmail.token;
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(1000 * 60 * 5 + 1);
    await client.magicLink.verify(
      {
        query: {
          token,
          callbackURL: '/callback'
        }
      },
      {
        onError(context) {
          expect(context.response.status).toBe(302);
          const location = context.response.headers.get('location');
          expect(location).toContain('?error=EXPIRED_TOKEN');
        }
      }
    );
  });

  it('should signup with magic link', async () => {
    const email = 'new-email@googlemail.com';
    await client.signIn.magicLink({
      email,
      name: 'test'
    });
    expect(verificationEmail).toMatchObject({
      email,
      url: expect.stringContaining('http://localhost:3000/api/auth/magic-link/verify') as string
    });
    const headers = new Headers();
    await client.magicLink.verify({
      query: {
        token: new URL(verificationEmail.url).searchParams.get('token') ?? ''
      },
      fetchOptions: {
        onSuccess: sessionSetter(headers)
      }
    });
    const session = await client.getSession({
      fetchOptions: {
        headers
      }
    });
    expect(session.data?.user).toMatchObject({
      name: 'test',
      email: 'new-email@googlemail.com',
      emailVerified: true
    });
    const dbUser = await db.findOne<UserWithNormalizedEmail>({
      model: 'user',
      where: [
        {
          field: 'normalizedEmail',
          value: 'new-email@gmail.com'
        }
      ]
    });
    expect(dbUser?.email).toBe(email);
  });

  it('should sign in with unnormalized email variation', async () => {
    const email = 'ex.ample2+test123@gmail.com';
    await client.signIn.magicLink({
      email,
      name: 'test'
    });
    expect(verificationEmail).toMatchObject({
      email,
      url: expect.stringContaining('http://localhost:3000/api/auth/magic-link/verify') as string
    });
    let headers = new Headers();
    await client.magicLink.verify({
      query: {
        token: new URL(verificationEmail.url).searchParams.get('token') ?? ''
      },
      fetchOptions: {
        onSuccess: sessionSetter(headers)
      }
    });
    const session = await client.getSession({
      fetchOptions: {
        headers
      }
    });
    expect(session.data?.user).toMatchObject({
      name: 'test',
      email,
      emailVerified: true
    });
    headers = new Headers();
    await client.signIn.magicLink({
      email: 'e.x.a.m.p.l.e2+foo111@googlemail.com'
    });
    await client.magicLink.verify({
      query: {
        token: new URL(verificationEmail.url).searchParams.get('token') ?? ''
      },
      fetchOptions: {
        onSuccess: sessionSetter(headers)
      }
    });
    const session2 = await client.getSession({
      fetchOptions: {
        headers
      }
    });
    expect(session2.data?.user).toMatchObject({
      name: 'test',
      email,
      emailVerified: true
    });
    const dbUser = await db.findOne<UserWithNormalizedEmail>({
      model: 'user',
      where: [
        {
          field: 'normalizedEmail',
          value: 'example2@gmail.com'
        }
      ]
    });
    expect(dbUser?.email).toBe(email);
  });
}, 15_000);

describe('magic link verify', async () => {
  const verificationEmail: VerificationEmail[] = [
    {
      email: '',
      token: '',
      url: ''
    }
  ];
  const { customFetchImpl, testUser, sessionSetter, auth } = await getTestInstance({
    plugins: [
      magicLink({
        // eslint-disable-next-line @typescript-eslint/require-await -- better-auth types
        async sendMagicLink(data) {
          verificationEmail.push(data);
        }
      })
    ]
  });

  const client = createAuthClient({
    plugins: [
      emailHarmony({
        allowNormalizedSignin: true,
        matchers: {
          validation: matchers,
          signIn: matchers.slice(1)
        }
      }),
      magicLinkClient()
    ],
    fetchOptions: {
      customFetchImpl
    },
    baseURL: 'http://localhost:3000/api/auth'
  });

  afterAll(async () => {
    await (auth.options.database as unknown as SQLiteDB).close();
  });

  it('should verify last magic link', async () => {
    await client.signIn.magicLink({
      email: testUser.email
    });
    await client.signIn.magicLink({
      email: testUser.email
    });
    await client.signIn.magicLink({
      email: testUser.email
    });
    const headers = new Headers();
    const lastEmail = verificationEmail.pop();
    const response = await client.magicLink.verify({
      query: {
        token: new URL(lastEmail?.url ?? '').searchParams.get('token') ?? ''
      },
      fetchOptions: {
        onSuccess: sessionSetter(headers)
      }
    });
    expect(response.data?.token).toBeDefined();
    const betterAuthCookie = headers.get('set-cookie');
    expect(betterAuthCookie).toBeDefined();
  });
}, 15_000);
