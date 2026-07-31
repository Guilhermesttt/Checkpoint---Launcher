begin;

create index if not exists chat_messages_retention_idx
  on public.chat_messages (created_at asc);

commit;
