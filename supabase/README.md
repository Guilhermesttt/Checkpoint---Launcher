# Supabase schema

Apply migrations in filename order with the Supabase CLI:

```sh
npx supabase link --project-ref mhfzvfcddwdckzcgefmf
npx supabase db push
```

The migration configures:

- profile provisioning from `auth.users`;
- private and public profiles;
- normalized friendships;
- chat tables, RLS and Realtime;
- private `attachments` Storage bucket;
- social activities and audience policies;
- web fallback for cloud game data.

Never place the service-role key in a `VITE_*` variable.
