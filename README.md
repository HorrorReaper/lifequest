This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Admin workspace

Set one or both of these server-side environment variables to expose admin-only testing tools:

```bash
ADMIN_EMAILS=patrick@example.com
ADMIN_USER_IDS=00000000-0000-0000-0000-000000000000
```

Use comma-separated values for multiple admins. Do not prefix these with `NEXT_PUBLIC_`; they must stay server-only.
Allowlisted users can open `/admin` as a temporary route-level fallback. The productivity, workout, and nutrition tables additionally require a trusted Supabase admin claim.

After the admin-hubs migration has been applied, assign the role once in the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'patrick.egi04@gmail.com';
```

Sign out and sign in again after running the command so Supabase issues a fresh JWT. The admin workspace then provides:

- `/admin/productivity`
- `/admin/workouts`
- `/admin/nutrition`
- `/admin/tools`

Do not place the admin role in `raw_user_meta_data`; users can edit that field themselves and it is not safe for authorization.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
